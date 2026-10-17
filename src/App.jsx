import { useState, useEffect } from 'react'
import { supabase, IS_DEMO } from './lib/supabase'
import { startAutoUpdate } from './lib/autoUpdate'
import SmartHub from './SmartHub'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import LogoutButton from './components/LogoutButton'
import DemoBanner from './components/DemoBanner'

function isTvMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mode') === 'tv'
}

// Väggens enhetsnyckel, från ?device= i kiosk-adressen på Pi:n. Med den loggar
// väggen in själv via edge-funktionen tv-login — se
// supabase/functions/tv-login/index.ts.
function tvDeviceKey() {
  if (typeof window === 'undefined' || !isTvMode()) return ''
  const k = new URLSearchParams(window.location.search).get('device') || ''
  return /^[a-f0-9]{64}$/.test(k) ? k : ''
}

// Visas i stället för inloggningsrutan när väggen har en enhetsnyckel. Försöker
// tills det går, med växande paus — är Supabase segt eller nätet inte uppe än
// loggar väggen in av sig själv så fort det svarar. Lyckas det tar
// onAuthStateChange i App över och den här skärmen försvinner.
function TvAutoLogin({ deviceKey }) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('Loggar in väggen…')

  useEffect(() => {
    let cancelled = false
    let timer
    async function tryLogin(n) {
      if (cancelled) return
      setAttempt(n)
      try {
        const { data, error } = await supabase.functions.invoke('tv-login', { body: { device: deviceKey } })
        if (error || !data?.token_hash) throw error || new Error(data?.error || 'inget svar')
        const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' })
        if (vErr) throw vErr
        return
      } catch (e) {
        console.error('[TvAutoLogin] försök', n, e)
        if (cancelled) return
        const wait = Math.min(60, 5 * 2 ** Math.min(n - 1, 4))
        setStatus(`Servern svarar inte än. Försöker igen om ${wait} s.`)
        timer = setTimeout(() => tryLogin(n + 1), wait * 1000)
      }
    }
    tryLogin(1)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [deviceKey])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      background: '#0f0c29', color: '#fff', fontFamily: 'system-ui', textAlign: 'center', padding: 24,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>SmartHub</div>
      <div style={{ fontSize: 14, opacity: 0.7 }}>{status}</div>
      {attempt > 1 && <div style={{ fontSize: 12, opacity: 0.4 }}>Försök {attempt}</div>}
    </div>
  )
}

// Visas när hushållet inte gick att hämta. Försöker om var tjugonde sekund av
// sig själv — väggen har varken tangentbord eller någon som står bredvid.
function RetryScreen({ onRetry, detail }) {
  useEffect(() => {
    const i = setInterval(onRetry, 20000)
    return () => clearInterval(i)
  }, [onRetry])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#0f0c29', color: '#fff',
      fontFamily: 'system-ui', textAlign: 'center', padding: 24,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Ingen kontakt med servern</div>
      <div style={{ fontSize: 14, opacity: 0.65, maxWidth: 360, lineHeight: 1.5 }}>
        Hushållet gick inte att hämta. Försöker igen automatiskt.
      </div>
      {/* Felet hör hemma på skärmen. Väggen har varken tangentbord eller
          devtools, så loggar i konsolen når ingen — och utan dem blir
          felsökningen gissningar. */}
      {detail && (
        <div style={{
          fontSize: 12, opacity: 0.5, maxWidth: 420, lineHeight: 1.45,
          fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
          padding: '10px 12px',
        }}>{detail}</div>
      )}
      <button onClick={onRetry} style={{
        marginTop: 4,
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 10, color: '#fff',
        padding: '12px 22px', fontSize: 15, fontWeight: 600,
        fontFamily: 'system-ui', cursor: 'pointer',
      }}>Försök nu</button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState(null)
  const [checkingHousehold, setCheckingHousehold] = useState(true)
  // Skild från household === null. "Frågan gick inte fram" och "du har inget
  // hushåll" ser likadana ut i ett tomt svar, men leder till helt olika
  // skärmar — och den ena av dem får inte visas av misstag.
  const [householdFailed, setHouseholdFailed] = useState(false)
  const [householdError, setHouseholdError] = useState('')
  const [retryTick, setRetryTick] = useState(0)

  // ── Automatisk uppdatering av kiosken ──
  // Ligger här och inte i SmartHub. Tidigare startades den inifrån appen, som
  // bara renderas när hushållet laddats — så på inloggnings-, onboarding- och
  // felskärmen kördes den aldrig. Alltså kunde väggen inte hämta den deploy
  // som skulle laga den, precis när den var trasig. Här körs den oavsett
  // vilken skärm som visas.
  // Fortfarande bara TV-läget: en telefon i handen ska inte laddas om mitt i
  // en inmatning, den laddar man om själv.
  useEffect(() => {
    if (!isTvMode()) return
    return startAutoUpdate()
  }, [])

  useEffect(() => {
    // Utan catch:en fastnar väggen på "Laddar..." om nätet inte hunnit upp
    // när Pi:n startar — then() körs aldrig, och setLoading(false) med den.
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .catch(e => console.error('[getSession]', e))
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setHousehold(null)
      setCheckingHousehold(false)
      return
    }

    // Köks-TV:n startar när Pi:n startar, ofta innan wifi hunnit upp, och en
    // token som inte gick att förnya ger ett fel här. Två fällor:
    //
    // 1. Kastar anropet och ingen fångar det körs aldrig raden som släcker
    //    väntskärmen — väggen står kvar på "Laddar..." tills någon startar om
    //    den för hand.
    // 2. Behandlas felet som "inget hushåll" visas onboarding, som ber en
    //    skapa ett NYTT hushåll. Gör någon det i förbifarten står köket utan
    //    sin kalender. Ett fel får aldrig leda dit.
    //
    // Supabase kastar inte på databasfel utan lägger dem i `error`, så den
    // måste läsas uttryckligen — annars ser ett nekat svar ut som ett tomt.
    let cancelled = false

    // Senast kända hushåll visas direkt, och frågan går i bakgrunden. När
    // Supabase är segt slipper appen stå på "Laddar..." i sekunder vid varje
    // start, och ett fel visar fortfarande köket i stället för felskärmen.
    const cacheKey = `smarthub:household:${session.user.id}`
    let cached = null
    try {
      const v = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (v?.id) cached = v
    } catch { /* trasig eller blockerad lagring — fråga som vanligt */ }
    if (cached) {
      setHousehold(cached)
      setHouseholdFailed(false)
      setCheckingHousehold(false)
    }

    async function checkHousehold() {
      if (!cached) setCheckingHousehold(true)
      setHouseholdFailed(false)
      setHouseholdError('')
      try {
        for (let attempt = 0; attempt < 4; attempt++) {
          if (cancelled) return
          try {
            const { data, error } = await supabase
              .from('household_members')
              .select('household_id, households(id, name)')
              .eq('user_id', session.user.id)
              .limit(1)
              .maybeSingle()

            if (cancelled) return
            if (error) throw error

            const fresh = data?.households || null
            try {
              if (fresh) localStorage.setItem(cacheKey, JSON.stringify({ id: fresh.id, name: fresh.name }))
              else localStorage.removeItem(cacheKey)
            } catch { /* lagringen är bara en genväg */ }
            // Bara ett riktigt svar får ta bort hushållet — då är man
            // verkligen inte med i något längre.
            setHousehold(fresh)
            return
          } catch (e) {
            console.error('[checkHousehold] försök', attempt + 1, e)
            if (cancelled) return
            // Med ett cachat hushåll är köket redan uppe. Ett fel ska då inte
            // byta ut det mot felskärmen; nästa start frågar igen.
            if (cached) return
            if (attempt === 3) {
              const parts = [e?.message, e?.code && `kod ${e.code}`, e?.hint, e?.details]
              setHouseholdError(parts.filter(Boolean).join(' · ') || String(e))
              setHouseholdFailed(true)
              return
            }
            await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
          }
        }
      } finally {
        if (!cancelled) setCheckingHousehold(false)
      }
    }

    checkHousehold()
    return () => { cancelled = true }
  }, [session, retryTick])

  if (loading || checkingHousehold) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0c29',
        color: '#fff',
        fontFamily: 'system-ui',
      }}>
        Laddar...
      </div>
    )
  }

  if (!session) {
    const deviceKey = tvDeviceKey()
    return deviceKey ? <TvAutoLogin deviceKey={deviceKey} /> : <Login />
  }

  // Gick frågan inte fram vet vi ingenting — varken att hushållet saknas eller
  // att det finns. Då visas det här i stället för onboarding, och väggen
  // försöker igen av sig själv så att ingen behöver gå dit med en mus.
  if (householdFailed) {
    return (
      <RetryScreen onRetry={() => setRetryTick(n => n + 1)} detail={householdError} />
    )
  }

  if (!household) {
    return <Onboarding session={session} onComplete={setHousehold} />
  }

  return (
    <>
      {/* Aldrig på väggen. Knappen är fixerad uppe i högra hörnet med vit text
          på ljus bakgrund — i praktiken osynlig där, men fullt tryckbar, utan
          bekräftelse och med direkt signOut(). På en touchskärm i knähöjd
          räcker ett barnfinger för att logga ut hela hushållet, och väggen har
          inget tangentbord att logga in med igen. Utloggning hör till mobilen.

          I demoläget är den meningslös ändå — den leder till en
          inloggningsruta som demot inte har något konto till. */}
      {IS_DEMO ? <DemoBanner /> : !isTvMode() && <LogoutButton />}
      <SmartHub session={session} household={household} />
    </>
  )
}