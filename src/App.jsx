import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import SmartHub from './SmartHub'
import Login from './components/Login'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
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

  return <SmartHub session={session} />
}
