import { supabase } from '../lib/supabase'

export default function LogoutButton() {
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 999,
        background: 'rgba(0,0,0,0.15)',
        border: 'none',
        borderRadius: 20,
        padding: '4px 12px',
        fontSize: 11,
        color: '#fff',
        cursor: 'pointer'
      }}
    >
      Logga ut
    </button>
  )
}
