// ════════════════════════════════════════════════
//  SPOTIFY — inloggning och fjärrstyrning
// ════════════════════════════════════════════════
// Hela poängen med den här funktionen är att tokens aldrig ska nå webbläsaren.
// Klienten kör med anon-nyckeln, och en refresh token är i praktiken full
// åtkomst till Spotify-kontot — så den ligger i spotify_tokens, en tabell utan
// RLS-policies som bara den här funktionen (service role) kommer åt.
//
// Klienten anropar aldrig Spotify själv. Den säger "pausa" till den här
// funktionen, som slår upp hushållets token, förnyar den om den hunnit gå ut
// och skickar vidare.
//
// Deploya med JWT-verifiering AV. Callbacken anropas av Spotify, som inte har
// någon Supabase-session — så den måste vara öppen. Alla andra vägar verifierar
// token själva, längre ned i handleAction.

import { createClient } from "jsr:@supabase/supabase-js@2"

const SPOTIFY_AUTH = "https://accounts.spotify.com"
const SPOTIFY_API = "https://api.spotify.com/v1"

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "user-library-read",
  "user-library-modify",
].join(" ")

// Dit vi får skicka tillbaka webbläsaren efter inloggning. Utan den här listan
// hade state-parametern kunnat peka vart som helst — en öppen vidarebefordran.
const APP_ORIGINS = [
  "https://smarthub-sigma.vercel.app",
  "http://localhost:5173",
  "http://localhost:5199",
]

const CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID")!
const CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/spotify/callback`

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

// ── Signerad state ──
// State bär hushålls-id och vart vi ska tillbaka. Den passerar Spotify och
// användarens webbläsare, så den måste signeras — annars kan vem som helst
// hitta på ett hushålls-id och koppla sitt Spotify till någon annans kök.

const enc = new TextEncoder()

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function unb64url(s: string) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(pad + "=".repeat((4 - pad.length % 4) % 4)), c => c.charCodeAt(0))
}

async function hmacKey() {
  return await crypto.subtle.importKey(
    "raw", enc.encode(CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  )
}

async function signState(payload: Record<string, unknown>) {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}

async function readState(state: string) {
  const [body, sig] = String(state || "").split(".")
  if (!body || !sig) return null
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64url(sig), enc.encode(body))
  if (!ok) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)))
    if (!payload.exp || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

// ── Tokens ──

async function exchangeCode(code: string) {
  const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })
  if (!res.ok) throw new Error(`token-utbyte misslyckades: ${await res.text()}`)
  return await res.json()
}

async function refreshToken(refresh: string) {
  const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  })
  if (!res.ok) throw new Error(`förnyelse misslyckades: ${await res.text()}`)
  return await res.json()
}

// Hämtar hushållets token och förnyar den om den är på väg att gå ut.
// Marginalen på en minut finns för att anropet efteråt inte ska hinna bli
// ogiltigt mitt i.
async function validToken(householdId: string): Promise<string | null> {
  const { data: row } = await admin
    .from("spotify_tokens").select("*").eq("household_id", householdId).maybeSingle()
  if (!row) return null

  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row.access_token

  const fresh = await refreshToken(row.refresh_token)
  const expires = new Date(Date.now() + (fresh.expires_in ?? 3600) * 1000).toISOString()
  await admin.from("spotify_tokens").update({
    access_token: fresh.access_token,
    // Spotify skickar inte alltid med en ny refresh token. Gör den inte det
    // gäller den gamla vidare, och skriver vi över med undefined tappar vi den.
    refresh_token: fresh.refresh_token ?? row.refresh_token,
    expires_at: expires,
    updated_at: new Date().toISOString(),
  }).eq("household_id", householdId)

  return fresh.access_token
}

// Anrop mot Spotify. 204 betyder "gjort, inget att säga" och är det vanliga
// svaret på pausa/nästa — det är inte ett fel.
async function callSpotify(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return { ok: true, status: 204, body: null }
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { ok: res.ok, status: res.status, body }
}

// ── Vem frågar ──
// Verifierar Supabase-JWT:n och att användaren faktiskt hör till hushållet.
// Utan det hade vilken inloggad användare som helst kunnat styra vilket
// hushålls musik som helst genom att gissa ett id.
async function authorize(req: Request, householdId: string) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")
  if (!jwt) return { error: "Ingen session" }
  const { data: { user }, error } = await admin.auth.getUser(jwt)
  if (error || !user) return { error: "Ogiltig session" }
  if (!householdId) return { error: "Hushåll saknas" }

  const { data: member } = await admin
    .from("household_members").select("user_id")
    .eq("household_id", householdId).eq("user_id", user.id).maybeSingle()
  if (!member) return { error: "Inte medlem i hushållet" }

  return { user }
}

// ── Vägar ──

async function handleCallback(url: URL) {
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const payload = await readState(state || "")

  const back = payload?.r && APP_ORIGINS.some(o => String(payload.r).startsWith(o))
    ? String(payload.r)
    : APP_ORIGINS[0]

  if (url.searchParams.get("error")) {
    return Response.redirect(`${back}?spotify=avbruten`, 302)
  }
  if (!code || !payload) {
    return Response.redirect(`${back}?spotify=fel`, 302)
  }

  try {
    const tok = await exchangeCode(code)
    const me = await callSpotify(tok.access_token, "/me")
    const profile = (me.body ?? {}) as Record<string, string>

    await admin.from("spotify_tokens").upsert({
      household_id: payload.h,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
      scope: tok.scope ?? SCOPES,
      spotify_user: profile.id ?? null,
      display_name: profile.display_name ?? null,
      connected_by: payload.u ?? null,
      updated_at: new Date().toISOString(),
    })
    return Response.redirect(`${back}?spotify=klar`, 302)
  } catch (e) {
    console.error("[spotify/callback]", e)
    return Response.redirect(`${back}?spotify=fel`, 302)
  }
}

async function handleAction(req: Request) {
  const payload = await req.json().catch(() => ({}))
  const { action, household } = payload as { action?: string; household?: string }

  const auth = await authorize(req, household || "")
  if ("error" in auth) return json({ error: auth.error }, 401)

  if (action === "login") {
    const state = await signState({
      h: household,
      u: auth.user.id,
      r: payload.returnTo || APP_ORIGINS[0],
      exp: Date.now() + 10 * 60 * 1000,
    })
    const url = `${SPOTIFY_AUTH}/authorize?` + new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state,
      show_dialog: "false",
    })
    return json({ url })
  }

  if (action === "disconnect") {
    await admin.from("spotify_tokens").delete().eq("household_id", household)
    return json({ connected: false })
  }

  if (action === "status") {
    const { data: row } = await admin.from("spotify_tokens")
      .select("display_name, spotify_user, updated_at")
      .eq("household_id", household).maybeSingle()
    return json({ connected: !!row, display_name: row?.display_name ?? null })
  }

  const token = await validToken(household!)
  if (!token) return json({ connected: false, error: "Spotify är inte kopplat" }, 409)

  const device = payload.device ? `?device_id=${encodeURIComponent(payload.device)}` : ""

  switch (action) {
    case "state": {
      const r = await callSpotify(token, "/me/player")
      // 204: inget spelar någonstans, och inget fel.
      return json({ connected: true, playing: r.status === 204 ? null : r.body })
    }
    case "play": {
      const body = payload.context
        ? JSON.stringify({ context_uri: payload.context })
        : payload.uris ? JSON.stringify({ uris: payload.uris }) : undefined
      const r = await callSpotify(token, `/me/player/play${device}`, {
        method: "PUT", body, headers: { "Content-Type": "application/json" },
      })
      return json({ ok: r.ok, status: r.status, body: r.body })
    }
    case "pause": {
      const r = await callSpotify(token, `/me/player/pause${device}`, { method: "PUT" })
      return json({ ok: r.ok, status: r.status, body: r.body })
    }
    case "next":
    case "previous": {
      const r = await callSpotify(token, `/me/player/${action}${device}`, { method: "POST" })
      return json({ ok: r.ok, status: r.status, body: r.body })
    }
    case "save":
    case "unsave": {
      const ids = encodeURIComponent(String(payload.id || ""))
      const r = await callSpotify(token, `/me/tracks?ids=${ids}`, {
        method: action === "save" ? "PUT" : "DELETE",
      })
      return json({ ok: r.ok, status: r.status })
    }
    case "playlists": {
      const r = await callSpotify(token, "/me/playlists?limit=50")
      return json({ ok: r.ok, body: r.body })
    }
    case "devices": {
      const r = await callSpotify(token, "/me/player/devices")
      return json({ ok: r.ok, body: r.body })
    }
    case "transfer": {
      const r = await callSpotify(token, "/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [payload.device], play: payload.play !== false }),
        headers: { "Content-Type": "application/json" },
      })
      return json({ ok: r.ok, status: r.status })
    }
    default:
      return json({ error: `Okänd åtgärd: ${action}` }, 400)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = new URL(req.url)
  try {
    if (url.pathname.endsWith("/callback")) return await handleCallback(url)
    if (req.method === "POST") return await handleAction(req)
    return json({ error: "Not found" }, 404)
  } catch (e) {
    console.error("[spotify]", e)
    return json({ error: String(e) }, 500)
  }
})
