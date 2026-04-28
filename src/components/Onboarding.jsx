import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Onboarding({ session, onComplete }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')

    const { data: household, error: hError } = await supabase
      .from('households')
      .insert({ name: name.trim(), created_by: session.user.id })
      .select()
      .single()

    if (hError) {
      setError(hError.message)
      setLoading(false)
      return
    }

    const { error: mError } = await supabase
      .from('household_members')
      .insert({
        household_id: household.id,
        user_id: session.user.id,
        role: 'owner',
      })

    if (mError) {
      setError(mError.message)
      setLoading(false)
      return
    }

    onComplete(household)
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
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Valkommen!</h1>
        <p style={{ opacity: 0.6, marginBottom: 24 }}>
          Skapa ditt hushall for att komma igang
        </p>
        <form onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Namn pa hushallet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
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
            {loading ? 'Skapar...' : 'Skapa hushall'}
          </button>
        </form>
        {error && (
          <p style={{ marginTop: 16, fontSize: 14, color: '#ff6b6b' }}>{error}</p>
        )}
      </div>
    </div>
  )
}