import { useState, useEffect } from 'react'
import { supabase, IS_DEMO } from './lib/supabase'
import SmartHub from './SmartHub'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import LogoutButton from './components/LogoutButton'
import DemoBanner from './components/DemoBanner'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState(null)
  const [checkingHousehold, setCheckingHousehold] = useState(true)

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

    // Köks-TV:n startar när Pi:n startar, ofta innan wifi hunnit upp. Fallerar
    // den här hämtningen kastar await:en, funktionen avbryts, och
    // setCheckingHousehold(false) körs aldrig — då står väggen kvar på
    // "Laddar..." tills någon startar om den för hand. Därför finally, och
    // därför några försök innan vi ger upp.
    let cancelled = false

    async function checkHousehold() {
      setCheckingHousehold(true)
      try {
        for (let attempt = 0; attempt < 4; attempt++) {
          if (cancelled) return
          try {
            const { data } = await supabase
              .from('household_members')
              .select('household_id, households(id, name)')
              .eq('user_id', session.user.id)
              .limit(1)
              .maybeSingle()

            if (cancelled) return
            setHousehold(data?.households || null)
            return
          } catch (e) {
            console.error('[checkHousehold] försök', attempt + 1, e)
            if (attempt === 3) {
              setHousehold(null)
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
  }, [session])

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