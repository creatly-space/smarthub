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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

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

    async function checkHousehold() {
      setCheckingHousehold(true)
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, households(id, name)')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle()

      if (data?.households) {
        setHousehold(data.households)
      } else {
        setHousehold(null)
      }
      setCheckingHousehold(false)
    }

    checkHousehold()
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