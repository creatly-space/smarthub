import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Läser ?invite=KOD från URL för att förfylla inbjudningskoden
function getInviteFromUrl() {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  return (params.get('invite') || '').toUpperCase()
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info') // 'info' | 'error' | 'success'
  const [isSignUp, setIsSignUp] = useState(false)
  const [inviteCode, setInviteCode] = useState('')

  // Förfyll invite-kod från URL och växla automatiskt till "Skapa konto"-läge
  useEffect(() => {
    const code = getInviteFromUrl()
    if (code) {
      setInviteCode(code)
      setIsSignUp(true)
    }
  }, [])

  function showMessage(text, type = 'info') {
    setMessage(text)
    setMessageType(type)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    showMessage('', 'info')

    try {
      if (isSignUp) {
        console.log('[Login] Försöker skapa konto för', email)
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Spara invite-koden i user_metadata så onboarding kan plocka upp den
            data: inviteCode ? { invite_code: inviteCode } : undefined,
            emailRedirectTo: window.location.origin + (inviteCode ? `/?invite=${inviteCode}` : '/'),
          },
        })
        console.log('[Login] signUp response:', { data, error })

        if (error) {
          showMessage('Kunde inte skapa konto: ' + error.message, 'error')
          return
        }
        // Två fall:
        // 1) data.session finns → user är inloggad direkt (email confirmation av)
        // 2) data.session är null → måste bekräfta email
        if (data?.session) {
          showMessage('Konto skapat! Du är nu inloggad.', 'success')
        } else if (data?.user) {
          showMessage(
            '✉️ Vi har skickat ett mejl till ' + email + ' — klicka på länken där för att bekräfta kontot, sen kan du logga in.',
            'success'
          )
        } else {
          showMessage('Något oväntat hände — försök igen.', 'error')
        }
      } else {
        console.log('[Login] Försöker logga in för', email)
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        console.log('[Login] signIn response:', { data, error })

        if (error) {
          showMessage('Kunde inte logga in: ' + error.message, 'error')
          return
        }
        if (!data?.session) {
          showMessage('Inloggning gick igenom men ingen session — försök igen.', 'error')
        }
        // I success-fallet renderar Auth-listenerna om appen automatiskt — ingen meddelande behövs
      }
    } catch (err) {
      console.error('[Login] Oväntat fel:', err)
      showMessage('Oväntat fel: ' + (err?.message || String(err)), 'error')
    } finally {
      setLoading(false)
    }
  }

  const messageColor =
    messageType === 'error' ? '#ff6b6b' :
    messageType === 'success' ? '#7ee787' : '#fff'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      padding: '20px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 40,
        maxWidth: 420,
        width: '100%',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxSizing: 'border-box',
      }}>
        <h1 style={{ fontSize: 28, marginBottom: 8, marginTop: 0 }}>SmartHub</h1>
        <p style={{ opacity: 0.6, marginBottom: 24, marginTop: 0 }}>
          {isSignUp ? 'Skapa konto' : 'Logga in'}
        </p>

        {inviteCode && isSignUp && (
          <div style={{
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(124, 58, 237, 0.4)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🎉 Du har en inbjudan!</div>
            <div style={{ opacity: 0.85 }}>
              Inbjudningskod: <strong style={{ letterSpacing: '0.1em' }}>{inviteCode}</strong>
              <br/>
              Skapa ditt konto nedan så ansluts du till hushållet automatiskt.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Lösenord (minst 6 tecken)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            style={inputStyle}
          />
          {isSignUp && !inviteCode && (
            <input
              type="text"
              placeholder="Inbjudningskod (valfritt)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              style={{ ...inputStyle, letterSpacing: '0.1em', textTransform: 'uppercase' }}
              maxLength={10}
            />
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#555' : '#6c63ff',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 8,
            }}
          >
            {loading ? 'Vänta...' : isSignUp ? 'Skapa konto' : 'Logga in'}
          </button>
        </form>

        <p
          style={{ marginTop: 16, fontSize: 14, opacity: 0.6, cursor: 'pointer', textAlign: 'center' }}
          onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
        >
          {isSignUp ? 'Har redan konto? Logga in' : 'Inget konto? Skapa ett'}
        </p>

        {message && (
          <div style={{
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 8,
            background: messageType === 'error' ? 'rgba(255, 107, 107, 0.15)' :
                        messageType === 'success' ? 'rgba(126, 231, 135, 0.15)' :
                        'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${messageType === 'error' ? 'rgba(255, 107, 107, 0.4)' :
                                  messageType === 'success' ? 'rgba(126, 231, 135, 0.4)' :
                                  'rgba(255, 255, 255, 0.1)'}`,
            color: messageColor,
            fontSize: 13,
            lineHeight: 1.5,
          }}>{message}</div>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 16,
  marginBottom: 12,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}
