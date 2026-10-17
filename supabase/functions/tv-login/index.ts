// tv-login: låter väggskärmen logga in utan lösenord.
//
// Pi:n skickar sin enhetsnyckel (från ?device= i kiosk-adressen). Vi slår upp
// nyckelns sha256 i public.tv_devices och svarar med en engångs-token_hash för
// det TV-konto skärmen hör till. Klienten växlar den mot en session med
// supabase.auth.verifyOtp({ token_hash, type: "magiclink" }). Inget mejl skickas
// — generateLink bara skapar länken.
//
// verify_jwt är av: skärmen har ju ingen session än, det är hela poängen.
// Nyckeln är autentiseringen, och den ger bara TV-kontot — aldrig någon annan
// användare. Spärra en skärm med revoked_at i tv_devices.
import { createClient } from "jsr:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors })
  if (req.method !== "POST") return json({ error: "method" }, 405)

  let device = ""
  try { device = String((await req.json())?.device ?? "") } catch { /* tom kropp */ }
  if (!/^[a-f0-9]{64}$/.test(device)) return json({ error: "ogiltig enhetsnyckel" }, 400)

  const { data: dev, error } = await admin.from("tv_devices")
    .select("id, user_id, revoked_at").eq("key_hash", await sha256Hex(device)).maybeSingle()
  if (error) return json({ error: "databasfel" }, 503)
  if (!dev || dev.revoked_at) return json({ error: "okänd eller spärrad skärm" }, 401)

  const { data: u, error: uErr } = await admin.auth.admin.getUserById(dev.user_id)
  if (uErr || !u?.user?.email) return json({ error: "TV-kontot saknas" }, 503)

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email })
  const token_hash = link?.properties?.hashed_token
  if (lErr || !token_hash) return json({ error: "kunde inte skapa inloggning" }, 503)

  await admin.from("tv_devices").update({ last_used_at: new Date().toISOString() }).eq("id", dev.id)
  return json({ token_hash })
})
