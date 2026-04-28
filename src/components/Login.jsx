import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    let result
    if (isSignUp) {
      result = await supabase.auth.signUp({ email, password })
    } else {
      result = await supabase.auth.signInWithPassword({ email, password })
    }

    if (result.error) {
      setMessage(result.error.message)
    } else if (isSignUp) {
      setMessage('Konto skapat! Du ar nu inloggad.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 40,
        maxWidth: 400,
        width: '90%',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>SmartHub</h1>
        <p style={{ opacity: 0.6, marginBottom: 24 }}>
          {isSignUp ? 'Skapa konto' : 'Logga in'}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 16,
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Losenord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 16,
              marginBottom: 16,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#555' : '#6c63ff',
              color: '#fff',
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Laddar...' : isSignUp ? 'Skapa konto' : 'Logga in'}
          </button>
        </form>
        <p
          style={{ marginTop: 16, fontSize: 14, opacity: 0.6, cursor: 'pointer', textAlign: 'center' }}
          onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
        >
          {isSignUp ? 'Har redan konto? Logga in' : 'Inget konto? Skapa ett'}
        </p>
        {message && (
          <p style={{ marginTop: 12, fontSize: 14, opacity: 0.8 }}>{message}</p>
        )}
      </div>
    </div>
  )
}