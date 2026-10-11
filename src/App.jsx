import { useState, useEffect } from 'react'
import { supabase, IS_DEMO } from './lib/supabase'
import SmartHub from './SmartHub'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import LogoutButton from './components/LogoutButton'
import DemoBanner from './components/DemoBanner'

// Visas när hushållet inte gick att hämta. Försöker om var tjugonde sekund av
// sig själv — väggen har varken tangentbord eller någon som står bredvid.
function RetryScreen({ onRetry }) {
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
  const [retryTick, setRetryTick] = useState(0)

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

    async function checkHousehold() {
      setCheckingHousehold(true)
      setHouseholdFailed(false)
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

            setHousehold(data?.households || null)
            return
          } catch (e) {
            console.error('[checkHousehold] försök', attempt + 1, e)
            if (cancelled) return
            if (attempt === 3) {
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
    return <Login />
  }

  // Gick frågan inte fram vet vi ingenting — varken att hushållet saknas eller
  // att det finns. Då visas det här i stället för onboarding, och väggen
  // försöker igen av sig själv så att ingen behöver gå dit med en mus.
  if (householdFailed) {
    return (
      <RetryScreen onRetry={() => setRetryTick(n => n + 1)} />
    )
  }

  if (!household) {
    return <Onboarding session={session} onComplete={setHousehold} />
  }

  return (
    <>
      {/* I demoläget är utloggning meningslös — den leder bara till en
          inloggningsruta som demot inte har något konto till. */}
      {IS_DEMO ? <DemoBanner /> : <LogoutButton />}
      <SmartHub session={session} household={household} />
    </>
  )
}