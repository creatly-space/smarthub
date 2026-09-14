// ════════════════════════════════════════════════
//  AUTOMATISK UPPDATERING AV KIOSKEN
// ════════════════════════════════════════════════
// Köks-TV:n laddar sin bundle när Chromium startar och sedan aldrig mer. I
// praktiken betyder det att varje deploy kräver en SSH-session och en omstart
// av Pi:n, och att väggen kan gå i veckor på gammal kod utan att det syns —
// den visar ju data, bara med gamla funktioner.
//
// Vite ger varje build ett eget hashat filnamn på huvudskriptet. Vi jämför
// alltså det skript sidan faktiskt kör mot det som står i index.html på
// servern. Skiljer de sig finns en ny version, och då laddar vi om.

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000
// Ett barn som håller på att bocka av sin belöningstavla ska inte få sidan
// omladdad under fingret. Vi väntar tills skärmen varit orörd en stund.
const IDLE_BEFORE_RELOAD_MS = 30 * 1000

function bundleFromDocument() {
  if (typeof document === "undefined") return null
  // Ta skriptet under /assets/ och inte bara det första modul-skriptet: i
  // dev-läge ligger /@vite/client först, och då hade vi jämfört fel sak.
  const scripts = [...document.querySelectorAll('script[type="module"][src]')]
  const el = scripts.find(s => (s.getAttribute("src") || "").includes("/assets/")) || scripts[0]
  const src = el?.getAttribute("src")
  if (!src) return null
  try { return new URL(src, window.location.origin).pathname } catch { return src }
}

async function bundleFromServer() {
  // no-store + unik query: vi vill ha serverns index.html, inte webbläsarens.
  const res = await fetch(`/index.html?_v=${Date.now()}`, { cache: "no-store" })
  if (!res.ok) return null
  const html = await res.text()
  const all = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/gi)].map(m => m[1])
  const hit = all.find(s => s.includes("/assets/")) || all[0]
  if (!hit) return null
  try { return new URL(hit, window.location.origin).pathname } catch { return hit }
}

// Startar bevakningen. Returnerar en funktion som stoppar den igen.
export function startAutoUpdate({ intervalMs = DEFAULT_INTERVAL_MS, onUpdate } = {}) {
  if (typeof window === "undefined") return () => {}
  const current = bundleFromDocument()
  // I dev-läge pekar skriptet på /src/main.jsx och byter aldrig namn — då
  // finns inget att bevaka, och Vite sköter omladdningen själv.
  if (!current || !current.includes("/assets/")) return () => {}

  let stopped = false
  let lastInteraction = Date.now()
  const touch = () => { lastInteraction = Date.now() }
  const events = ["pointerdown", "keydown", "touchstart"]
  events.forEach(e => window.addEventListener(e, touch, { passive: true }))

  async function check() {
    if (stopped || document.hidden) return
    let latest
    try {
      latest = await bundleFromServer()
    } catch {
      return // nätverksglapp — försök igen nästa varv
    }
    if (stopped || !latest || latest === current) return
    if (Date.now() - lastInteraction < IDLE_BEFORE_RELOAD_MS) return // någon håller på
    if (onUpdate) onUpdate()
    window.location.reload()
  }

  const timer = setInterval(check, intervalMs)
  return () => {
    stopped = true
    clearInterval(timer)
    events.forEach(e => window.removeEventListener(e, touch))
  }
}
