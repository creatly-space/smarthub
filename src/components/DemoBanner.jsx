import { useState, useEffect } from 'react'

// Liten markering i demoläget så den som testar vet att datan är påhittad
// och att ingenting sparas. Går att fälla ihop till en prick så den inte
// står i vägen när man vill titta på gränssnittet.
export default function DemoBanner() {
  const [open, setOpen] = useState(true)
  const isTv = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode') === 'tv'

  // Fäller ihop sig själv efter en stund. Man ska hinna läsa den, men den ska
  // inte ligga kvar över listorna för någon som bara vill klicka runt.
  useEffect(() => {
    if (!open) return
    const ti = setTimeout(() => setOpen(false), 7000)
    return () => clearTimeout(ti)
  }, [open])

  // På mobilen måste den hålla sig undan både bottennavigeringen och
  // AI-bubblan i högerhörnet, annars går det inte att byta flik.
  const base = {
    position: 'fixed',
    zIndex: 9999,
    left: 12,
    bottom: isTv ? 12 : 78,
    fontFamily: "'Nunito', system-ui, sans-serif",
    boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
    cursor: 'pointer',
    border: 'none',
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Visa demo-info"
        style={{
          ...base,
          width: 34, height: 34, borderRadius: 17,
          background: '#f59e0b', color: '#1a1a2e',
          fontSize: 15, fontWeight: 900,
        }}
      >
        i
      </button>
    )
  }

  return (
    <div
      onClick={() => setOpen(false)}
      title="Klicka för att dölja"
      style={{
        ...base,
        maxWidth: isTv ? 380 : 300,
        background: 'rgba(20,22,28,0.94)',
        color: '#fff',
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.2 }}>🧪</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Demoläge</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.72)' }}>
          Påhittad data. Inget sparas — ladda om så börjar allt från början.
          Klicka runt hur du vill.
        </div>
      </div>
    </div>
  )
}
