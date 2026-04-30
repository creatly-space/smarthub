import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Onboarding({ session, onComplete }) {
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
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

    if (hError) { setError(hError.message); setLoading(false); return }

    const { error: mError } = await supabase
      .from('household_members')
      .insert({ household_id: household.id, user_id: session.user.id, role: 'owner' })

    if (mError) { setError(mError.message); setLoading(false); return }
    onComplete(household)
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')

    const { data: invite, error: iError } = await supabase
      .from('invites')
      .select('*, households(id, name)')
      .eq('code', code.trim().toUpperCase())
      .is('used_by', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (iError) { setError(iError.message); setLoading(false); return }
    if (!invite) { setError('Ogiltig eller utgången kod'); setLoading(false); return }

    const { error: mError } = await supabase
      .from('household_members')
      .insert({ household_id: invite.household_id, user_id: session.user.id, role: 'member' })

    if (mError) {
      if (mError.message.includes('duplicate')) { setError('Du är redan med i detta hushåll'); }
      else { setError(mError.message); }
      setLoading(false); return
    }

    await supabase.from('invites').update({ used_by: session.user.id, used_at: new Date().toISOString() }).eq('id', invite.id)
    onComplete(invite.households)
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
    color: '#fff', fontSize: 16, marginBottom: 16, boxSizing: 'border-box',
  }
  const btnStyle = (active) => ({
    width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
    background: active ? '#555' : '#6c63ff', color: '#fff', fontSize: 16,
    cursor: active ? 'not-allowed' : 'pointer',
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      color: '#fff', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 40,
        maxWidth: 400, width: '90%', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>V{"\u00e4"}lkommen!</h1>

        {!mode && (
          <>
            <p style={{ opacity: 0.6, marginBottom: 24 }}>Hur vill du komma ig{"\u00e5"}ng?</p>
            <button onClick={() => setMode('create')} style={{ ...btnStyle(false), marginBottom: 12 }}>
              Skapa nytt hush{"\u00e5"}ll
            </button>
            <button onClick={() => setMode('join')} style={{ ...btnStyle(false), background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
              G{"\u00e5"} med via kod
            </button>
          </>
        )}

        {mode === 'create' && (
          <>
            <p style={{ opacity: 0.6, marginBottom: 24 }}>Ge ditt hush{"\u00e5"}ll ett namn</p>
            <form onSubmit={handleCreate}>
              <input type="text" placeholder={"Namn p\u00e5 hush\u00e5llet"} value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
              <button type="submit" disabled={loading} style={btnStyle(loading)}>
                {loading ? 'Skapar...' : 'Skapa hush\u00e5ll'}
              </button>
            </form>
            <button onClick={() => { setMode(null); setError('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', marginTop: 16, fontSize: 14 }}>
              {"\u2190"} Tillbaka
            </button>
          </>
        )}

        {mode === 'join' && (
          <>
            <p style={{ opacity: 0.6, marginBottom: 24 }}>Ange koden du f{"\u00e5"}tt fr{"\u00e5"}n en familjemedlem</p>
            <form onSubmit={handleJoin}>
              <input
                type="text"
                placeholder="XXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: '0.2em', fontFamily: 'monospace' }}
              />
              <button type="submit" disabled={loading} style={btnStyle(loading)}>
                {loading ? 'Ansluter...' : 'G\u00e5 med'}
              </button>
            </form>
            <button onClick={() => { setMode(null); setError('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', marginTop: 16, fontSize: 14 }}>
              {"\u2190"} Tillbaka
            </button>
          </>
        )}

        {error && <p style={{ marginTop: 16, fontSize: 14, color: '#ff6b6b' }}>{error}</p>}
      </div>
    </div>
  )
}
