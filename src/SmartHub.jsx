import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "./lib/supabase"
import {
  Home, CalendarDays, ListChecks, UtensilsCrossed, MoreHorizontal, Settings,
  Check, Plus, Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning,
  CloudDrizzle, CloudFog, Snowflake, Monitor,
  Users, Lock, X, ChevronRight, ChevronLeft, User, LogOut, Sparkles,
  ThumbsUp, ThumbsDown, Grip, Copy, Trash2, Edit3, Mic, MapPin,
  Archive, ArchiveRestore, Search, Repeat,
} from "lucide-react"

// ════════════════════════════════════════════════
//  DESIGN TOKENS (from v11 mockup)
// ════════════════════════════════════════════════
const t = {
  bg: "#f0f2f5", card: "#ffffff", cardBorder: "rgba(0,0,0,0.06)",
  text: "#1a1a2e", textSec: "rgba(0,0,0,0.55)", textMuted: "rgba(0,0,0,0.25)",
  line: "rgba(0,0,0,0.04)", inputBg: "rgba(0,0,0,0.03)", inputBorder: "rgba(0,0,0,0.08)",
}
const ACCENT = { calendar: "#7c3aed", todo: "#059669", meal: "#d97706", event: "#2563eb", weather: "#0ea5e9" }
const PERSON_PALETTE = ["#7c3aed", "#db2777", "#0ea5e9", "#059669", "#d97706", "#dc2626"]
const LIST_COLORS = ["#7c3aed", "#059669", "#d97706", "#2563eb", "#dc2626", "#db2777", "#0d9488", "#ea580c"]

const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
const DAYS_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]
const WEEKDAYS_SV = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"]
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
const MEAL_TAGS = [
  { id: "matlada", label: "Matlåda", color: "#0d9488", icon: "📦" },
  { id: "hamtmat", label: "Hämtmat", color: "#dc2626", icon: "🥡" },
  { id: "ute", label: "Ute", color: "#7c3aed", icon: "🍽" },
  { id: "snabbt", label: "Snabbt", color: "#2563eb", icon: "⚡" },
]
const BUDGET_OPTS = [
  { id: "sparsamt", label: "Sparsamt", icon: "💰" },
  { id: "blandat", label: "Blandat", icon: "🍽" },
  { id: "lyxigt", label: "Lyxigt", icon: "✨" },
]

// Weather (Open-Meteo, Kalmar by default — same as v10)
const WEATHER_LAT = 56.66, WEATHER_LON = 16.36, WEATHER_LOCATION = "Kalmar"
const WMO = {
  0: { t: "Klart" }, 1: { t: "Mestadels klart" }, 2: { t: "Halvklart" }, 3: { t: "Mulet" },
  45: { t: "Dimma" }, 48: { t: "Rimfrost" }, 51: { t: "Lätt duggregn" }, 53: { t: "Duggregn" },
  55: { t: "Kraftigt duggregn" }, 61: { t: "Lätt regn" }, 63: { t: "Regn" }, 65: { t: "Kraftigt regn" },
  71: { t: "Lätt snö" }, 73: { t: "Snöfall" }, 75: { t: "Kraftigt snöfall" },
  80: { t: "Lätt regnskur" }, 81: { t: "Regnskur" }, 82: { t: "Kraftig skur" },
  95: { t: "Åskväder" }, 96: { t: "Åska med hagel" }, 99: { t: "Kraftig åska" },
}
function WmoIcon({ code, size = 18, color = ACCENT.weather }) {
  const c = Number(code)
  if (c === 0) return <Sun size={size} color={color} strokeWidth={1.8} />
  if (c <= 2) return <CloudSun size={size} color={color} strokeWidth={1.8} />
  if (c === 3) return <Cloud size={size} color={color} strokeWidth={1.8} />
  if (c >= 45 && c <= 48) return <CloudFog size={size} color={color} strokeWidth={1.8} />
  if (c >= 51 && c <= 55) return <CloudDrizzle size={size} color={color} strokeWidth={1.8} />
  if (c >= 61 && c <= 67) return <CloudRain size={size} color={color} strokeWidth={1.8} />
  if (c >= 71 && c <= 77) return <Snowflake size={size} color={color} strokeWidth={1.8} />
  if (c >= 80 && c <= 82) return <CloudRain size={size} color={color} strokeWidth={1.8} />
  if (c >= 85 && c <= 86) return <CloudSnow size={size} color={color} strokeWidth={1.8} />
  if (c >= 95) return <CloudLightning size={size} color={color} strokeWidth={1.8} />
  return <Cloud size={size} color={color} strokeWidth={1.8} />
}
function parseWeather(json) {
  if (!json?.current) return null
  const temp = Math.round(json.current.temperature_2m)
  const code = json.current.weathercode
  const desc = WMO[code]?.t || "Okänt"
  const forecast = []
  if (json.daily?.time) {
    for (let i = 1; i < json.daily.time.length && forecast.length < 3; i++) {
      const d = new Date(json.daily.time[i])
      forecast.push({ day: DAYS_SHORT[(d.getDay() + 6) % 7], code: json.daily.weathercode[i], temp: Math.round(json.daily.temperature_2m_max[i]) + "°" })
    }
  }
  return { temp, code, desc, forecast, location: WEATHER_LOCATION }
}

// ════════════════════════════════════════════════
//  HELPERS (lifted verbatim from v10)
// ════════════════════════════════════════════════
function fmtTime(iso) { if (!iso) return ""; const d = new Date(iso); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") }
function fmtDate(date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") }
function genCode() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = ""; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r }
function daysLeft(d) { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000) }

// ── Återkommande events ──
const RECURRENCE_OPTIONS = [
  { id: null,         label: "Aldrig (engångshändelse)" },
  { id: "daily",      label: "Varje dag" },
  { id: "weekdays",   label: "Varje vardag (mån-fre)" },
  { id: "weekly",     label: "Varje vecka" },
  { id: "monthly",    label: "Varje månad" },
  { id: "yearly",     label: "Varje år" },
]
function recurrenceLabel(rule) {
  if (!rule) return null
  return RECURRENCE_OPTIONS.find(o => o.id === rule.freq)?.label || null
}
// Expanderar ett event med recurrence_rule till en lista av virtuella förekomster
// inom [from, to]. Master-eventet får `master_id = event.id` på varje instans.
// Begränsar till max 200 förekomster per event för att undvika oändliga loopar.
function expandRecurring(event, from, to) {
  if (!event.recurrence_rule || !event.recurrence_rule.freq) return [event]
  const rule = event.recurrence_rule
  const out = []
  const startMs = new Date(event.start_time).getTime()
  const endMs = new Date(event.end_time).getTime()
  const duration = endMs - startMs
  const untilMs = rule.until ? new Date(rule.until + "T23:59:59").getTime() : Infinity
  const fromMs = from.getTime()
  const toMs = to.getTime()
  let current = new Date(startMs)
  let safety = 0
  while (current.getTime() <= toMs && current.getTime() <= untilMs && safety < 1000) {
    safety++
    if (current.getTime() >= fromMs) {
      out.push({
        ...event,
        id: event.id + "_occ_" + current.getTime(),
        master_id: event.id,
        start_time: current.toISOString(),
        end_time: new Date(current.getTime() + duration).toISOString(),
      })
    }
    // Stega framåt enligt frekvens
    if (rule.freq === "daily") {
      current = new Date(current.getTime() + 86400000)
    } else if (rule.freq === "weekdays") {
      current = new Date(current.getTime() + 86400000)
      while (current.getDay() === 0 || current.getDay() === 6) {
        current = new Date(current.getTime() + 86400000)
      }
    } else if (rule.freq === "weekly") {
      current = new Date(current.getTime() + 7 * 86400000)
    } else if (rule.freq === "monthly") {
      current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate(), current.getHours(), current.getMinutes(), current.getSeconds())
    } else if (rule.freq === "yearly") {
      current = new Date(current.getFullYear() + 1, current.getMonth(), current.getDate(), current.getHours(), current.getMinutes(), current.getSeconds())
    } else {
      break
    }
  }
  return out
}
// Expanderar en hel events-lista i ett tidsfönster
function expandEvents(events, fromDate, toDate) {
  const out = []
  events.forEach(ev => {
    const occs = expandRecurring(ev, fromDate, toDate)
    out.push(...occs)
  })
  return out
}

// ════════════════════════════════════════════════
//  HOOKS
// ════════════════════════════════════════════════
function detectView() {
  if (typeof window === "undefined") return "desktop"
  const params = new URLSearchParams(window.location.search)
  // Stöd både ?mode=tv (används av Raspberry Pi-kiosken) och ?view=tv (alternativ)
  if (params.get("mode") === "tv" || params.get("view") === "tv") return "tv"
  const w = window.innerWidth
  if (w < 768) return "mobile"
  return "desktop"
}
function useViewport() {
  const [view, setView] = useState(detectView)
  useEffect(() => {
    const onResize = () => setView(detectView())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return view
}
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(i) }, [intervalMs])
  return now
}

// ════════════════════════════════════════════════
//  PRIMITIVES (from mockup)
// ════════════════════════════════════════════════
function Card({ accent, children, style = {} }) {
  return (
    <div style={{
      background: t.card, borderRadius: 14, border: `1px solid ${t.cardBorder}`,
      borderTop: accent ? `3px solid ${accent}` : `1px solid ${t.cardBorder}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", overflow: "hidden", ...style,
    }}>{children}</div>
  )
}
function Label({ color, children, icon: Icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Icon && <Icon size={14} color={color} strokeWidth={2.2} />}
      <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color }}>{children}</span>
    </div>
  )
}
function Btn({ children, color = ACCENT.calendar, outline, small, onClick, disabled, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: small ? "4px 10px" : "8px 14px", borderRadius: 10,
      fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: small ? 11 : 13,
      cursor: disabled ? "not-allowed" : "pointer",
      background: outline ? "transparent" : color,
      color: outline ? color : "#fff",
      border: outline ? `1.5px solid ${color}30` : "none",
      opacity: disabled ? 0.5 : 1,
      transition: "all 0.15s", ...style,
    }}>{children}</button>
  )
}
const inputStyle = {
  fontFamily: "Nunito, sans-serif", fontSize: 14, padding: "8px 12px",
  borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg,
  outline: "none", color: t.text, boxSizing: "border-box",
}

// ════════════════════════════════════════════════
//  CLOCK + WEATHER
// ════════════════════════════════════════════════
function ClockDisplay({ size = "large" }) {
  const now = useNow(1000)
  const time = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
  const date = now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })
  const sizes = { huge: 96, large: 72, medium: 40, small: 32, tiny: 22 }
  return (
    <div style={{ textAlign: size === "large" || size === "huge" ? "center" : "left" }}>
      <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: sizes[size] || 32, fontWeight: 300, color: t.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{time}</div>
      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: size === "huge" ? 18 : size === "large" ? 16 : size === "tiny" ? 11 : 13, color: t.textSec, fontWeight: 500, marginTop: size === "tiny" ? 2 : 4, textTransform: "capitalize" }}>{date}</div>
    </div>
  )
}
function WeatherMini({ weather }) {
  if (!weather) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <Cloud size={18} color={t.textMuted} />
      <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted }}>–</span>
    </div>
  )
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <WmoIcon code={weather.code} size={18} color={ACCENT.weather} />
      <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 16, fontWeight: 700, color: t.text }}>{weather.temp}°</span>
      <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>{weather.location}</span>
    </div>
  )
}

// ════════════════════════════════════════════════
//  CALENDAR — events inside day cells
// ════════════════════════════════════════════════
function getPersonForEvent(ev, persons) {
  if (!persons.length) return { name: "", color: ACCENT.calendar }
  const idx = persons.findIndex(p => p.user_id === ev.created_by)
  return idx >= 0 ? persons[idx] : persons[0]
}
function CalendarWidget({ events, persons, fill, compact, onDayClick }) {
  const today = new Date()
  const [vm, setVm] = useState(today.getMonth())
  const [vy, setVy] = useState(today.getFullYear())

  const month = new Date(vy, vm, 1).toLocaleDateString("sv-SE", { month: "long" })
  const firstDay = new Date(vy, vm, 1).getDay()
  let startDay = firstDay - 1; if (startDay < 0) startDay = 6
  const daysInMonth = new Date(vy, vm + 1, 0).getDate()
  const weeks = []; let week = new Array(startDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) { week.push(d); if (week.length === 7) { weeks.push(week); week = [] } }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }

  const eventsForView = useMemo(() => {
    // Expandera återkommande events över hela visnings-månaden
    const monthStart = new Date(vy, vm, 1)
    const monthEnd = new Date(vy, vm + 1, 0, 23, 59, 59)
    const expanded = expandEvents(events, monthStart, monthEnd)
    const out = {}
    expanded.forEach(ev => {
      const d = new Date(ev.start_time)
      if (d.getFullYear() === vy && d.getMonth() === vm) {
        const day = d.getDate()
        if (!out[day]) out[day] = []
        const p = getPersonForEvent(ev, persons)
        out[day].push({
          id: ev.id, time: fmtTime(ev.start_time), title: ev.title,
          color: p.color, name: p.name,
          recurring: !!ev.master_id,
        })
      }
    })
    Object.keys(out).forEach(k => out[k].sort((a, b) => a.time.localeCompare(b.time)))
    return out
  }, [events, vy, vm, persons])

  const isCurrentMonth = vm === today.getMonth() && vy === today.getFullYear()

  return (
    <Card accent={ACCENT.calendar} style={fill ? { flex: 1, minHeight: 0 } : {}}>
      <div style={{ padding: compact ? "10px 12px" : "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Label color={ACCENT.calendar} icon={CalendarDays}>Kalender</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => { if (vm === 0) { setVm(11); setVy(y => y - 1) } else setVm(m => m - 1) }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: t.textMuted }}><ChevronLeft size={14} /></button>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.textSec, fontWeight: 600, textTransform: "capitalize", minWidth: 80, textAlign: "center" }}>{month} {vy}</span>
            <button onClick={() => { if (vm === 11) { setVm(0); setVy(y => y + 1) } else setVm(m => m + 1) }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: t.textMuted }}><ChevronRight size={14} /></button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: "center", fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          {weeks.map((wk, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, flex: 1 }}>
              {wk.map((day, di) => {
                const isToday = day === today.getDate() && isCurrentMonth
                const dayEvents = day ? (eventsForView[day] || []) : []
                const clickable = !!(day && onDayClick)
                return (
                  <div key={di}
                    onClick={clickable ? () => onDayClick(new Date(vy, vm, day)) : undefined}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "stretch",
                      borderRadius: 6, padding: "2px 2px 1px",
                      background: isToday ? `${ACCENT.calendar}08` : "transparent",
                      border: isToday ? `1.5px solid ${ACCENT.calendar}30` : "1.5px solid transparent",
                      minHeight: 0, overflow: "hidden",
                      cursor: clickable ? "pointer" : "default",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={clickable ? e => { if (!isToday) e.currentTarget.style.background = `${ACCENT.calendar}06` } : undefined}
                    onMouseLeave={clickable ? e => { if (!isToday) e.currentTarget.style.background = "transparent" } : undefined}
                  >
                    <div style={{
                      fontFamily: "Comfortaa, sans-serif", fontSize: compact ? 10 : 11, fontWeight: isToday ? 800 : 500,
                      color: !day ? "transparent" : isToday ? ACCENT.calendar : t.text,
                      textAlign: "center", lineHeight: 1, marginBottom: 1,
                    }}>{day || ""}</div>
                    {dayEvents.slice(0, fill ? 2 : 1).map((ev) => (
                      <div key={ev.id} style={{
                        fontSize: compact ? 6 : 7, fontFamily: "Nunito, sans-serif", fontWeight: 700,
                        color: ev.color, background: `${ev.color}12`,
                        borderRadius: 3, padding: "0px 2px", lineHeight: 1.3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1,
                        display: "flex", alignItems: "center", gap: 2,
                      }}>
                        {ev.recurring && <Repeat size={compact ? 5 : 6} style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.time} {ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > (fill ? 2 : 1) && (
                      <div style={{ fontSize: 6, color: t.textMuted, textAlign: "center" }}>+{dayEvents.length - (fill ? 2 : 1)}</div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {persons.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            {persons.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 600, color: t.textSec }}>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// Globalt event-modal som kan öppnas från Hem-vyn (eller var som helst).
// Bottom-sheet style — täcker över hela viewporten.
function AddEventModal({ open, prefillDate, persons, onClose, onSave }) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(fmtDate(new Date()))
  const [time, setTime] = useState("12:00")
  const [endTime, setEndTime] = useState("13:00")
  const [personIdx, setPersonIdx] = useState(0)
  const [shared, setShared] = useState(true)
  const [notify, setNotify] = useState(true)
  const [recurrence, setRecurrence] = useState(null) // null | "daily" | "weekdays" | "weekly" | "monthly" | "yearly"
  const [recurUntil, setRecurUntil] = useState("") // tom = för alltid

  // Prefilla datum när modalen öppnas
  useEffect(() => {
    if (open) {
      setDate(prefillDate ? fmtDate(prefillDate) : fmtDate(new Date()))
      setTitle("")
      setTime("12:00")
      setEndTime("13:00")
      setRecurrence(null)
      setRecurUntil("")
    }
  }, [open, prefillDate])

  if (!open) return null

  function submit() {
    if (!title.trim()) return
    const recurrence_rule = recurrence
      ? (recurUntil ? { freq: recurrence, until: recurUntil } : { freq: recurrence })
      : null
    onSave({
      title: title.trim(),
      start_time: date + "T" + time + ":00",
      end_time: date + "T" + endTime + ":00",
      location: null,
      color: persons[personIdx]?.color || ACCENT.event,
      shared,
      recurrence_rule,
    })
    onClose()
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.card, borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 560,
        padding: 20, paddingBottom: 32,
        display: "flex", flexDirection: "column", gap: 12,
        boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 18, fontWeight: 700, color: t.text }}>Ny händelse</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={t.textSec} />
          </button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Vad ska hända?" style={{ ...inputStyle, fontSize: 14 }} autoFocus />
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle, width: 100, fontSize: 13 }} />
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: 100, fontSize: 13 }} />
        </div>
        {persons.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, fontWeight: 600 }}>Vem:</span>
            {persons.map((p, i) => (
              <button key={i} onClick={() => setPersonIdx(i)} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8,
                border: i === personIdx ? `2px solid ${p.color}` : "2px solid transparent",
                background: `${p.color}10`, cursor: "pointer",
                fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: p.color,
              }}>{p.name}</button>
            ))}
          </div>
        )}
        <div onClick={() => setShared(s => !s)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: shared ? ACCENT.calendar : t.textMuted, padding: 2, display: "flex", alignItems: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "transform 0.2s", transform: shared ? "translateX(16px)" : "translateX(0)" }} />
          </div>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: shared ? t.text : t.textSec }}>{shared ? "Delad med hushållet" : "Bara för mig"}</span>
        </div>
        <div onClick={() => setNotify(n => !n)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: notify ? ACCENT.calendar : t.textMuted, padding: 2, display: "flex", alignItems: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "transform 0.2s", transform: notify ? "translateX(16px)" : "translateX(0)" }} />
          </div>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: notify ? t.text : t.textSec }}>Påminnelse</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Repeat size={14} color={t.textSec} />
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, fontWeight: 600 }}>Upprepning</span>
          </div>
          <select value={recurrence || ""} onChange={e => setRecurrence(e.target.value || null)} style={{ ...inputStyle, fontSize: 13 }}>
            {RECURRENCE_OPTIONS.map(opt => (
              <option key={opt.id || "none"} value={opt.id || ""}>{opt.label}</option>
            ))}
          </select>
          {recurrence && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>Slut:</span>
              <input type="date" value={recurUntil} onChange={e => setRecurUntil(e.target.value)} style={{ ...inputStyle, fontSize: 12, flex: 1 }} placeholder="Aldrig" />
              {recurUntil && (
                <button onClick={() => setRecurUntil("")} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 2, display: "flex" }}>
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {recurrence && !recurUntil && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted }}>Upprepas för alltid (tills du sätter slutdatum eller raderar)</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <Btn outline small onClick={onClose}><X size={12} /> Avbryt</Btn>
          <Btn small color={ACCENT.calendar} onClick={submit} disabled={!title.trim()}><Check size={12} /> Spara</Btn>
        </div>
      </div>
    </div>
  )
}

function CalendarTab({ isMobile, events, persons, onAddEvent, onDeleteEvent, userId }) {
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(fmtDate(new Date()))
  const [time, setTime] = useState("12:00")
  const [endTime, setEndTime] = useState("13:00")
  const [personIdx, setPersonIdx] = useState(0)
  const [color, setColor] = useState(ACCENT.event)
  const [shared, setShared] = useState(true)
  const [notify, setNotify] = useState(true)

  function reset() { setTitle(""); setDate(fmtDate(new Date())); setTime("12:00"); setEndTime("13:00"); setShowAdd(false) }
  function submit() {
    if (!title.trim()) return
    onAddEvent({
      title: title.trim(),
      start_time: date + "T" + time + ":00",
      end_time: date + "T" + endTime + ":00",
      location: null,
      color: persons[personIdx]?.color || color,
      shared,
    })
    reset()
  }

  const eventsToday = useMemo(() => {
    const today = new Date()
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    const expanded = expandEvents(events, dayStart, dayEnd)
    return expanded.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  }, [events])

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: isMobile ? 22 : 24, fontWeight: 700, color: t.text, margin: 0 }}>Kalender</h2>
        <Btn onClick={() => setShowAdd(s => !s)}><Plus size={14} /> Ny händelse</Btn>
      </div>

      {showAdd && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>Lägg till händelse</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Vad ska hända?" style={{ ...inputStyle, fontSize: 14 }} autoFocus />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle, width: 100, fontSize: 13 }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: 100, fontSize: 13 }} />
            </div>
            {persons.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, fontWeight: 600 }}>Vem:</span>
                {persons.map((p, i) => (
                  <button key={i} onClick={() => setPersonIdx(i)} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8,
                    border: i === personIdx ? `2px solid ${p.color}` : `2px solid transparent`,
                    background: `${p.color}10`, cursor: "pointer",
                    fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: p.color,
                  }}>{p.name}</button>
                ))}
              </div>
            )}
            <div onClick={() => setShared(s => !s)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: shared ? ACCENT.calendar : t.textMuted, padding: 2, transition: "background 0.2s", display: "flex", alignItems: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "transform 0.2s", transform: shared ? "translateX(16px)" : "translateX(0)" }} />
              </div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: shared ? t.text : t.textSec }}>{shared ? "Delad med hushållet" : "Bara för mig"}</span>
            </div>
            <div onClick={() => setNotify(n => !n)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: notify ? ACCENT.calendar : t.textMuted, padding: 2, transition: "background 0.2s", display: "flex", alignItems: "center" }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "transform 0.2s", transform: notify ? "translateX(16px)" : "translateX(0)" }} />
              </div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: notify ? t.text : t.textSec }}>Påminnelse</span>
              {notify && <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textSec }}>1 timme innan (TODO: koppla notifiering)</span>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn outline small onClick={reset}><X size={12} /> Avbryt</Btn>
              <Btn small color={ACCENT.calendar} onClick={submit} disabled={!title.trim()}><Check size={12} /> Spara</Btn>
            </div>
          </div>
        </Card>
      )}

      <CalendarWidget
        events={events}
        persons={persons}
        onDayClick={d => { setDate(fmtDate(d)); setShowAdd(true) }}
      />

      {eventsToday.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ padding: 14 }}>
            <Label color={ACCENT.event} icon={CalendarDays}>Idag</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {eventsToday.map(ev => {
                const p = getPersonForEvent(ev, persons)
                const isRecurring = !!ev.master_id || !!ev.recurrence_rule
                function tryDelete() {
                  if (isRecurring) {
                    if (confirm("Detta är en återkommande händelse. Tar du bort den raderas hela serien. Fortsätta?")) {
                      onDeleteEvent(ev.id)
                    }
                  } else {
                    onDeleteEvent(ev.id)
                  }
                }
                return (
                  <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: `${p.color}08`, borderRadius: 10, border: `1px solid ${p.color}15` }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                        {fmtTime(ev.start_time)}
                        {isRecurring && <Repeat size={10} color={t.textMuted} />}
                      </div>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.text, fontWeight: 600 }}>{ev.title}</div>
                      {ev.location && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1, display: "flex", alignItems: "center", gap: 3 }}><MapPin size={10} /> {ev.location}</div>}
                    </div>
                    <button onClick={tryDelete} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }}><X size={14} /></button>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════
//  LISTS
// ════════════════════════════════════════════════
function TodoCard({ pinnedList, onToggle, fill }) {
  const list = pinnedList || { id: null, name: "Att göra", color: ACCENT.todo, items: [] }
  const items = list.items || []
  const doneCount = items.filter(i => i.done).length
  return (
    <Card accent={list.color || ACCENT.todo} style={fill ? { flex: 1, minHeight: 0 } : {}}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label color={list.color || ACCENT.todo} icon={ListChecks}>{list.name}</Label>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>{doneCount}/{items.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {items.length === 0 && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>Inga uppgifter</span>
          )}
          {items.slice(0, fill ? 6 : 4).map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onToggle(item)}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                border: item.done ? "none" : `2px solid ${t.textMuted}`,
                background: item.done ? (list.color || ACCENT.todo) : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{item.done && <Check size={12} color="#fff" strokeWidth={3} />}</div>
              <span style={{
                fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500,
                color: item.done ? t.textMuted : t.text,
                textDecoration: item.done ? "line-through" : "none",
              }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function ListsView({ lists, pinnedListId, onToggleItem, onTogglePin, onToggleShared, onAddTodo, onAddList, onDeleteList, onDeleteTodo, onArchiveList }) {
  const [expandedId, setExpandedId] = useState(lists[0]?.id)
  const [addingForList, setAddingForList] = useState(null)
  const [newText, setNewText] = useState("")
  const [showAddList, setShowAddList] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [newListColor, setNewListColor] = useState(LIST_COLORS[0])
  const [newListShared, setNewListShared] = useState(true)

  function submitTodo(listId) {
    if (!newText.trim()) return
    onAddTodo(newText.trim(), listId)
    setNewText(""); setAddingForList(null)
  }
  function submitList() {
    if (!newListName.trim()) return
    onAddList({ name: newListName.trim(), shared: newListShared, color: newListColor, expires_at: null })
    setNewListName(""); setNewListColor(LIST_COLORS[0]); setNewListShared(true); setShowAddList(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {showAddList && (
        <Card>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>Ny lista</div>
            <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Namn på listan" style={inputStyle} autoFocus />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LIST_COLORS.map(c => (
                <button key={c} onClick={() => setNewListColor(c)} style={{
                  width: 28, height: 28, borderRadius: 14, background: c,
                  border: newListColor === c ? `3px solid ${t.text}` : "3px solid transparent",
                  cursor: "pointer", padding: 0,
                }} />
              ))}
            </div>
            <button onClick={() => setNewListShared(s => !s)} style={{
              display: "flex", alignItems: "center", gap: 8, background: t.inputBg,
              border: `1px solid ${t.inputBorder}`, borderRadius: 10, padding: "8px 12px",
              cursor: "pointer", color: t.textSec, fontSize: 13, fontFamily: "Nunito, sans-serif",
            }}>
              {newListShared ? <><Users size={14} /> Delad med hushållet</> : <><Lock size={14} /> Privat lista</>}
            </button>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn outline small onClick={() => setShowAddList(false)}><X size={12} /> Avbryt</Btn>
              <Btn small onClick={submitList} disabled={!newListName.trim()}><Check size={12} /> Skapa</Btn>
            </div>
          </div>
        </Card>
      )}

      {lists.map(list => {
        const expanded = expandedId === list.id
        const items = list.items || []
        const doneCount = items.filter(i => i.done).length
        const pinned = list.id === pinnedListId
        const dl = daysLeft(list.expires_at)
        return (
          <Card key={list.id} accent={list.color}>
            <div onClick={() => setExpandedId(expanded ? null : list.id)} style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <Label color={list.color} icon={ListChecks}>{list.name}</Label>
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textSec, flexShrink: 0 }}>{doneCount}/{items.length}</span>
                {dl !== null && (
                  <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: dl <= 2 ? "#dc2626" : dl <= 5 ? ACCENT.meal : t.textSec, flexShrink: 0 }}>
                    {dl <= 0 ? "Utgången" : dl + "d"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {list.shared
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 6, background: `${ACCENT.calendar}10`, fontSize: 10, fontWeight: 700, color: ACCENT.calendar, fontFamily: "Nunito, sans-serif" }}><Users size={10} /> Delad</span>
                  : <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 6, background: `${t.textMuted}20`, fontSize: 10, fontWeight: 700, color: t.textSec, fontFamily: "Nunito, sans-serif" }}><Lock size={10} /> Privat</span>}
                {pinned && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 6, background: `${ACCENT.todo}10`, fontSize: 10, fontWeight: 700, color: ACCENT.todo, fontFamily: "Nunito, sans-serif" }}><Home size={10} /> Hem</span>}
              </div>
            </div>
            {expanded && (
              <div style={{ padding: "0 16px 14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div onClick={() => onToggleItem(item)} style={{
                        width: 20, height: 20, borderRadius: 6, cursor: "pointer", flexShrink: 0,
                        border: item.done ? "none" : `2px solid ${t.textMuted}`,
                        background: item.done ? list.color : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{item.done && <Check size={12} color="#fff" strokeWidth={3} />}</div>
                      <span onClick={() => onToggleItem(item)} style={{
                        flex: 1, cursor: "pointer",
                        fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500,
                        color: item.done ? t.textMuted : t.text,
                        textDecoration: item.done ? "line-through" : "none",
                      }}>{item.text}</span>
                      <button onClick={() => onDeleteTodo(item)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 2 }}><X size={12} /></button>
                    </div>
                  ))}
                </div>
                {addingForList === list.id ? (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <input value={newText} onChange={e => setNewText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") submitTodo(list.id); if (e.key === "Escape") { setAddingForList(null); setNewText("") } }}
                      placeholder="Ny uppgift..." style={{ ...inputStyle, flex: 1, fontSize: 12, padding: "6px 10px" }} autoFocus />
                    <Btn small color={list.color} onClick={() => submitTodo(list.id)}>+</Btn>
                  </div>
                ) : (
                  <div onClick={() => setAddingForList(list.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${t.line}`, marginBottom: 10, cursor: "pointer" }}>
                    <Plus size={14} color={t.textMuted} />
                    <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted }}>Lägg till uppgift...</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn small outline color={pinned ? ACCENT.todo : t.textSec} onClick={e => { e.stopPropagation(); onTogglePin(list.id) }}>
                    <Home size={12} /> {pinned ? "Visas på hem" : "Visa på hem"}
                  </Btn>
                  <Btn small outline color={list.shared ? ACCENT.calendar : t.textSec} onClick={e => { e.stopPropagation(); onToggleShared(list) }}>
                    {list.shared ? <><Users size={12} /> Delad</> : <><Lock size={12} /> Privat</>}
                  </Btn>
                  <Btn small outline color={t.textSec} onClick={e => { e.stopPropagation(); onArchiveList(list.id) }}>
                    <Archive size={12} /> Arkivera
                  </Btn>
                  <Btn small outline color="#dc2626" onClick={e => { e.stopPropagation(); onDeleteList(list.id) }}>
                    <Trash2 size={12} /> Ta bort
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        )
      })}

      {!showAddList && (
        <button onClick={() => setShowAddList(true)} style={{
          fontFamily: "Nunito, sans-serif", padding: "12px 14px", borderRadius: 12,
          background: t.card, border: `1px dashed ${t.cardBorder}`, cursor: "pointer",
          color: t.textSec, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Plus size={14} /> Ny lista
        </button>
      )}

      {lists.length === 0 && !showAddList && (
        <Card><div style={{ padding: 24, textAlign: "center", color: t.textMuted, fontSize: 13, fontFamily: "Nunito, sans-serif" }}>Inga listor än. Skapa en!</div></Card>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════
//  ARCHIVE VIEW (söker bland arkiverade listor)
// ════════════════════════════════════════════════
function ListTabSwitch({ activeCount, archivedCount, showArchive, setShowArchive }) {
  const tabStyle = (active) => ({
    flex: 1,
    padding: "10px 14px",
    background: active ? t.card : "transparent",
    border: "none",
    borderBottom: active ? `2px solid ${ACCENT.calendar}` : `2px solid transparent`,
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    color: active ? t.text : t.textSec,
    transition: "all 0.15s",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  })
  return (
    <div style={{ display: "flex", marginBottom: 16, borderBottom: `1px solid ${t.cardBorder}` }}>
      <button onClick={() => setShowArchive(false)} style={tabStyle(!showArchive)}>
        <ListChecks size={14} /> Aktiva {activeCount > 0 && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>({activeCount})</span>}
      </button>
      <button onClick={() => setShowArchive(true)} style={tabStyle(showArchive)}>
        <Archive size={14} /> Arkiverade {archivedCount > 0 && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>({archivedCount})</span>}
      </button>
    </div>
  )
}

function ArchiveView({ archivedLists, onRestore, onDeletePermanent }) {
  const [query, setQuery] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(null) // list id

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return archivedLists
    return archivedLists.filter(l => l.name.toLowerCase().includes(q))
  }, [archivedLists, query])

  function fmtArchivedAt(iso) {
    if (!iso) return ""
    const d = new Date(iso)
    const today = new Date()
    const days = Math.floor((today - d) / 86400000)
    if (days === 0) return "Idag"
    if (days === 1) return "Igår"
    if (days < 7) return `${days} dagar sedan`
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 12, marginBottom: 14 }}>
        <Search size={16} color={t.textMuted} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Sök listnamn..."
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "Nunito, sans-serif", fontSize: 14, color: t.text }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: t.textMuted }}>
            <X size={14} />
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <Card>
          <div style={{ padding: 24, textAlign: "center", color: t.textMuted, fontSize: 13, fontFamily: "Nunito, sans-serif" }}>
            {archivedLists.length === 0 ? "Inga arkiverade listor än" : "Ingen lista matchar din sökning"}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(list => {
          const items = list.items || []
          const doneCount = items.filter(i => i.done).length
          const isConfirming = confirmDelete === list.id
          return (
            <Card key={list.id} accent={list.color}>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <Label color={list.color} icon={ListChecks}>{list.name}</Label>
                    <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textSec, flexShrink: 0 }}>
                      {doneCount}/{items.length}
                    </span>
                  </div>
                  <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, flexShrink: 0 }}>
                    Arkiverad {fmtArchivedAt(list.archived_at)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn small outline color={ACCENT.todo} onClick={() => onRestore(list.id)}>
                    <ArchiveRestore size={12} /> Återställ
                  </Btn>
                  {!isConfirming ? (
                    <Btn small outline color="#dc2626" onClick={() => setConfirmDelete(list.id)}>
                      <Trash2 size={12} /> Radera permanent
                    </Btn>
                  ) : (
                    <>
                      <Btn small outline onClick={() => setConfirmDelete(null)}>Avbryt</Btn>
                      <Btn small color="#dc2626" onClick={() => { onDeletePermanent(list.id); setConfirmDelete(null) }}>
                        <Trash2 size={12} /> Bekräfta radering
                      </Btn>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
//  MEAL
// ════════════════════════════════════════════════
function MealCard({ fill, mealsByWeekday, mealTagsLocal, onSetMealText, onSetMealTag }) {
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState("")
  const todayIdx = (new Date().getDay() + 6) % 7

  function startEdit(i) { setEditIdx(i); setEditVal(mealsByWeekday[i + 1]?.meal_text || "") }
  function saveEdit() {
    if (editIdx === null) return
    onSetMealText(editIdx + 1, editVal.trim())
    setEditIdx(null)
  }
  function handleBlur(e) { if (e.relatedTarget?.dataset?.tagbtn) return; saveEdit() }
  function toggleTag(weekdayIdx, tagId) {
    const cur = mealTagsLocal[weekdayIdx + 1]
    onSetMealTag(weekdayIdx + 1, cur === tagId ? null : tagId)
  }

  return (
    <Card accent={ACCENT.meal} style={fill ? { flex: 1, minHeight: 0 } : {}}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label color={ACCENT.meal} icon={UtensilsCrossed}>Matsedel</Label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: fill ? "space-between" : "flex-start", gap: fill ? 0 : 3 }}>
          {DAYS.map((day, i) => {
            const weekday = i + 1
            const meal = mealsByWeekday[weekday]
            const mealText = meal?.meal_text || ""
            const tagId = mealTagsLocal[weekday] || null
            const tag = tagId ? MEAL_TAGS.find(tg => tg.id === tagId) : null
            const isToday = i === todayIdx
            const isEditing = editIdx === i
            return (
              <div key={i}>
                <div onClick={() => !isEditing && startEdit(i)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: fill ? "5px 8px" : "4px 8px",
                  background: isEditing ? `${ACCENT.meal}08` : isToday ? `${ACCENT.meal}12` : "transparent",
                  borderRadius: 8, cursor: isEditing ? "default" : "pointer",
                }}>
                  <span style={{
                    fontFamily: "Nunito, sans-serif", fontSize: fill ? 13 : 12,
                    fontWeight: isToday ? 700 : 500, color: isToday ? ACCENT.meal : t.textSec,
                    minWidth: fill ? 60 : 50, flexShrink: 0,
                  }}>{day}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
                    {tag && <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      padding: "1px 7px", borderRadius: 6, background: `${tag.color}15`,
                      fontSize: 10, fontWeight: 700, color: tag.color, fontFamily: "Nunito, sans-serif", flexShrink: 0,
                    }}>{tag.icon} {tag.label}</span>}
                    {isEditing ? (
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={handleBlur}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditIdx(null) }}
                        style={{
                          fontFamily: "Nunito, sans-serif", fontSize: fill ? 13 : 12, fontWeight: 500,
                          color: t.text, textAlign: "right", background: "transparent",
                          border: "none", outline: "none", borderBottom: `2px solid ${ACCENT.meal}`,
                          padding: "1px 0", width: "100%", maxWidth: 180,
                        }} />
                    ) : (
                      <span style={{
                        fontFamily: "Nunito, sans-serif", fontSize: fill ? 13 : 12,
                        fontWeight: isToday ? 700 : 500,
                        color: mealText ? t.text : t.textMuted,
                        textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{mealText || (tag ? "" : "Tryck för att fylla i...")}</span>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div style={{ display: "flex", gap: 4, padding: "4px 8px 2px", flexWrap: "wrap" }}>
                    {MEAL_TAGS.map(tg => (
                      <button key={tg.id} data-tagbtn="true" onClick={() => toggleTag(i, tg.id)} style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        fontFamily: "Nunito, sans-serif", cursor: "pointer",
                        background: tagId === tg.id ? `${tg.color}20` : `${t.textMuted}15`,
                        color: tagId === tg.id ? tg.color : t.textSec,
                        border: tagId === tg.id ? `1.5px solid ${tg.color}40` : "1.5px solid transparent",
                      }}>{tg.icon} {tg.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function MealTab({ isMobile, mealsByWeekday, mealTagsLocal, onSetMealText, onSetMealTag, foodPrefs, setFoodPrefs, onAiGenerate }) {
  const [showAI, setShowAI] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [tmpLikes, setTmpLikes] = useState(foodPrefs.likes.join(", "))
  const [tmpDislikes, setTmpDislikes] = useState(foodPrefs.dislikes.join(", "))
  const [tmpNotes, setTmpNotes] = useState(foodPrefs.notes)

  async function handleGenerate() {
    setGenerating(true); setAiError(null)
    const prefs = {
      likes: tmpLikes.split(",").map(s => s.trim()).filter(Boolean),
      dislikes: tmpDislikes.split(",").map(s => s.trim()).filter(Boolean),
      budget: foodPrefs.budget,
      notes: tmpNotes,
    }
    setFoodPrefs(prefs)
    try {
      await onAiGenerate(prefs)
      setShowAI(false)
    } catch (e) {
      setAiError(e.message || "Något gick fel")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: isMobile ? 22 : 24, fontWeight: 700, color: t.text, margin: 0 }}>Matsedel</h2>
        <Btn color={ACCENT.meal} onClick={() => setShowAI(s => !s)}><Sparkles size={14} /> Generera vecka</Btn>
      </div>

      {showAI && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={16} color={ACCENT.meal} /> Generera matsedel med AI
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <ThumbsUp size={12} color={ACCENT.todo} />
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec }}>Vi gillar</span>
              </div>
              <input value={tmpLikes} onChange={e => setTmpLikes(e.target.value)} placeholder="Pasta, Kyckling, Lax..." style={{ ...inputStyle, fontSize: 13, width: "100%" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <ThumbsDown size={12} color="#dc2626" />
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec }}>Vi gillar inte</span>
              </div>
              <input value={tmpDislikes} onChange={e => setTmpDislikes(e.target.value)} placeholder="Lever, Svamp..." style={{ ...inputStyle, fontSize: 13, width: "100%" }} />
            </div>
            <div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec, marginBottom: 6, display: "block" }}>Budget</span>
              <div style={{ display: "flex", gap: 6 }}>
                {BUDGET_OPTS.map(b => (
                  <button key={b.id} onClick={() => setFoodPrefs(p => ({ ...p, budget: b.id }))} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    padding: "8px 6px", borderRadius: 10, fontFamily: "Nunito, sans-serif",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                    background: foodPrefs.budget === b.id ? `${ACCENT.meal}12` : t.inputBg,
                    color: foodPrefs.budget === b.id ? ACCENT.meal : t.textSec,
                    border: foodPrefs.budget === b.id ? `2px solid ${ACCENT.meal}40` : "2px solid transparent",
                  }}>{b.icon} {b.label}</button>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec, marginBottom: 4, display: "block" }}>Övrigt</span>
              <input value={tmpNotes} onChange={e => setTmpNotes(e.target.value)} placeholder="T.ex. barnvänligt, vegetariskt på fredagar..." style={{ ...inputStyle, fontSize: 13, width: "100%" }} />
            </div>
            {aiError && <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#dc2626" }}>{aiError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn outline small onClick={() => setShowAI(false)}><X size={12} /> Avbryt</Btn>
              <Btn small color={ACCENT.meal} onClick={handleGenerate} disabled={generating}>
                {generating ? "Genererar..." : <><Sparkles size={12} /> Generera</>}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      <MealCard
        mealsByWeekday={mealsByWeekday}
        mealTagsLocal={mealTagsLocal}
        onSetMealText={onSetMealText}
        onSetMealTag={onSetMealTag}
      />
    </div>
  )
}

// ════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════
function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
        <ChevronLeft size={20} color={t.textSec} />
      </button>
      <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 22, fontWeight: 700, color: t.text, margin: 0 }}>{title}</h2>
    </div>
  )
}

function ProfileSection({ onBack, session }) {
  const email = session?.user?.email || ""
  const initial = (email[0] || "?").toUpperCase()
  const [name, setName] = useState(session?.user?.user_metadata?.name || email.split("@")[0] || "")
  return (
    <div>
      <SectionHeader title="Profil" onBack={onBack} />
      <Card>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: `${ACCENT.calendar}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 32, fontWeight: 700, color: ACCENT.calendar }}>{initial}</span>
          </div>
          <Btn small outline><Edit3 size={12} /> Byt profilbild (TODO: storage)</Btn>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec }}>Namn</span>
              <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, fontSize: 14, width: "100%", marginTop: 4 }} />
            </div>
            <div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec }}>E-post</span>
              <input value={email} disabled style={{ ...inputStyle, fontSize: 14, width: "100%", marginTop: 4, opacity: 0.6 }} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function HouseholdSection({ onBack, household, members, userId, onCreateInvite }) {
  const [inviteCode, setInviteCode] = useState(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function create() {
    setCreating(true)
    const code = await onCreateInvite()
    if (code) setInviteCode(code)
    setCreating(false)
  }
  function copy() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div>
      <SectionHeader title="Hushåll & Medlemmar" onBack={onBack} />

      {household?.name && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec, marginBottom: 4 }}>Hushåll</div>
            <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 18, fontWeight: 700, color: t.text }}>{household.name}</div>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 16 }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec, marginBottom: 6 }}>Invite-kod</div>
          {!inviteCode ? (
            <Btn onClick={create} disabled={creating}>{creating ? "Skapar..." : "Skapa kod"}</Btn>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 20, fontWeight: 700, color: ACCENT.calendar, letterSpacing: "0.1em", background: `${ACCENT.calendar}08`, padding: "8px 16px", borderRadius: 10 }}>{inviteCode}</div>
              <Btn small outline onClick={copy}><Copy size={12} /> {copied ? "Kopierad!" : "Kopiera"}</Btn>
              <button onClick={() => setInviteCode(null)} style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: t.textMuted }}>Skapa ny</button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec, marginBottom: 10 }}>Medlemmar</div>
          {members.length === 0 && <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted }}>Inga medlemmar än</div>}
          {members.map((m, i) => {
            const isMe = m.user_id === userId
            const color = PERSON_PALETTE[i % PERSON_PALETTE.length]
            const name = isMe ? "Du" : (m.name || "Medlem " + (i + 1))
            return (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < members.length - 1 ? `1px solid ${t.line}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 13, fontWeight: 700, color }}>{name[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>{name}</div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textSec }}>{m.role}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function FoodPrefsSection({ onBack, foodPrefs, setFoodPrefs }) {
  const [newLike, setNewLike] = useState("")
  const [newDislike, setNewDislike] = useState("")
  return (
    <div>
      <SectionHeader title="Matpreferenser" onBack={onBack} />
      <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.textSec, margin: "0 0 16px" }}>Används av AI:n för att generera matsedel</p>
      {/* TODO(migration): Spara mot food_preferences-tabellen — se MIGRATIONS.sql. Just nu localStorage-only. */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <ThumbsUp size={14} color={ACCENT.todo} />
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: ACCENT.todo }}>Vi gillar</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {foodPrefs.likes.map((item, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, background: `${ACCENT.todo}10`, fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: ACCENT.todo }}>
                {item} <X size={10} style={{ cursor: "pointer" }} onClick={() => setFoodPrefs(p => ({ ...p, likes: p.likes.filter((_, idx) => idx !== i) }))} />
              </span>
            ))}
            <input value={newLike} onChange={e => setNewLike(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newLike.trim()) { setFoodPrefs(p => ({ ...p, likes: [...p.likes, newLike.trim()] })); setNewLike("") } }}
              placeholder="+ Lägg till"
              style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, padding: "4px 10px", borderRadius: 8, background: t.inputBg, border: `1px solid ${t.inputBorder}`, outline: "none", color: t.text, width: 120 }} />
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <ThumbsDown size={14} color="#dc2626" />
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>Vi gillar inte</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {foodPrefs.dislikes.map((item, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, background: "#dc262610", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                {item} <X size={10} style={{ cursor: "pointer" }} onClick={() => setFoodPrefs(p => ({ ...p, dislikes: p.dislikes.filter((_, idx) => idx !== i) }))} />
              </span>
            ))}
            <input value={newDislike} onChange={e => setNewDislike(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newDislike.trim()) { setFoodPrefs(p => ({ ...p, dislikes: [...p.dislikes, newDislike.trim()] })); setNewDislike("") } }}
              placeholder="+ Lägg till"
              style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, padding: "4px 10px", borderRadius: 8, background: t.inputBg, border: `1px solid ${t.inputBorder}`, outline: "none", color: t.text, width: 120 }} />
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 16 }}>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.textSec, marginBottom: 8, display: "block" }}>Budget</span>
          <div style={{ display: "flex", gap: 6 }}>
            {BUDGET_OPTS.map(b => (
              <button key={b.id} onClick={() => setFoodPrefs(p => ({ ...p, budget: b.id }))} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "10px 6px", borderRadius: 10, fontFamily: "Nunito, sans-serif",
                fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                background: foodPrefs.budget === b.id ? `${ACCENT.meal}12` : t.inputBg,
                color: foodPrefs.budget === b.id ? ACCENT.meal : t.textSec,
                border: foodPrefs.budget === b.id ? `2px solid ${ACCENT.meal}40` : "2px solid transparent",
              }}>{b.icon} {b.label}</button>
            ))}
          </div>
        </div>
      </Card>
      <Card>
        <div style={{ padding: 16 }}>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.textSec, marginBottom: 6, display: "block" }}>Övrigt</span>
          <input value={foodPrefs.notes} onChange={e => setFoodPrefs(p => ({ ...p, notes: e.target.value }))} placeholder="T.ex. barnvänligt, vegetariskt på fredagar..." style={{ ...inputStyle, fontSize: 13, width: "100%" }} />
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, margin: "6px 0 0" }}>Fritext som AI:n tar hänsyn till vid generering</p>
        </div>
      </Card>
    </div>
  )
}

const TV_WIDGET_META = {
  clock:    { name: "Klocka",    color: t.textSec },
  calendar: { name: "Kalender",  color: ACCENT.calendar },
  todo:     { name: "Att göra",  color: ACCENT.todo },
  meal:     { name: "Matsedel",  color: ACCENT.meal },
  weather:  { name: "Väder",     color: ACCENT.weather },
  events:   { name: "Händelser", color: ACCENT.event },
}
function normalizeTvWidget(w) {
  const meta = TV_WIDGET_META[w.id] || { name: w.id || "Widget", color: t.textSec }
  return {
    id: w.id,
    name: w.name || meta.name,
    color: w.color || meta.color,
    row: w.row !== undefined ? w.row : (w.y !== undefined ? w.y : 0),
    col: w.col !== undefined ? w.col : (w.x !== undefined ? w.x : 0),
    w: w.w || 1,
    h: w.h || 1,
  }
}

function TvEditorSection({ onBack, isMobile, tvData, tvSlots, onSaveTvSlots }) {
  const [slots, setSlots] = useState(() => ({ ...DEFAULT_TV_SLOTS, ...(tvSlots || {}) }))
  const [pickerOpen, setPickerOpen] = useState(null) // slotId being edited
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const scale = isMobile ? 0.45 : 0.55

  // Synka in när tvSlots från DB ändras (t.ex. realtime från annan enhet)
  useEffect(() => {
    if (tvSlots) setSlots(s => ({ ...DEFAULT_TV_SLOTS, ...tvSlots }))
  }, [tvSlots])

  async function saveSlots(newSlots) {
    setSaving(true)
    await onSaveTvSlots(newSlots)
    setSaving(false)
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(null), 2000)
  }

  function pickWidget(slotId, widgetType) {
    const newSlots = { ...slots, [slotId]: widgetType }
    setSlots(newSlots)
    setPickerOpen(null)
    saveSlots(newSlots)
  }

  // Render-prop: lägger en klickbar overlay över varje slot i preview:n
  const slotOverlay = (slotId, currentType) => (
    <div
      onClick={() => setPickerOpen(slotId)}
      style={{
        position: "absolute", inset: 0, zIndex: 10,
        cursor: "pointer", borderRadius: 14,
        background: pickerOpen === slotId ? "rgba(124,58,237,0.18)" : "transparent",
        border: pickerOpen === slotId ? `3px solid ${ACCENT.calendar}` : "3px solid transparent",
        transition: "all 0.15s",
        pointerEvents: "auto",
      }}
      onMouseEnter={e => { if (pickerOpen !== slotId) e.currentTarget.style.background = "rgba(124,58,237,0.08)" }}
      onMouseLeave={e => { if (pickerOpen !== slotId) e.currentTarget.style.background = "transparent" }}
    />
  )

  return (
    <div>
      <SectionHeader title="TV-vy editor" onBack={onBack} />
      <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.textSec, margin: "0 0 8px" }}>
        Klicka på en widget i preview:n för att byta vad den visar. Ändringar sparas direkt och syns på TV:n via realtime.
      </p>
      <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, margin: "0 0 16px" }}>
        Pi-kiosken laddar <code style={{ background: t.inputBg, padding: "1px 6px", borderRadius: 4 }}>?mode=tv</code> i URL:en.
      </p>

      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 16px" }}>
        <TvPreview
          scale={scale}
          {...tvData}
          slots={slots}
          slotOverlay={slotOverlay}
        />
      </div>

      <div style={{ textAlign: "center", marginBottom: 16, fontFamily: "Nunito, sans-serif", fontSize: 12, color: savedAt ? ACCENT.todo : t.textMuted, transition: "color 0.2s" }}>
        {saving ? "Sparar..." : savedAt ? "✓ Sparat — TV:n uppdateras automatiskt" : "Tryck på en widget i preview:n för att byta"}
      </div>

      {pickerOpen && (
        <div onClick={() => setPickerOpen(null)} style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.card, borderRadius: "20px 20px 0 0",
            width: "100%", maxWidth: 560,
            padding: 20, paddingBottom: 32,
            display: "flex", flexDirection: "column", gap: 12,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 18, fontWeight: 700, color: t.text }}>
                Välj widget för {pickerOpen === "main" ? "huvud-rutan" : pickerOpen === "bottomLeft" ? "nedre vänster" : "nedre höger"}
              </span>
              <button onClick={() => setPickerOpen(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={20} color={t.textSec} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {TV_SLOT_OPTIONS.map(opt => {
                const Icon = opt.icon
                const active = slots[pickerOpen] === opt.id
                return (
                  <button key={opt.id} onClick={() => pickWidget(pickerOpen, opt.id)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "14px 16px", borderRadius: 12,
                    background: active ? `${opt.color}10` : t.inputBg,
                    border: active ? `2px solid ${opt.color}` : "2px solid transparent",
                    cursor: "pointer",
                    fontFamily: "Nunito, sans-serif",
                    textAlign: "left",
                  }}>
                    <Icon size={20} color={opt.color} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{opt.label}</span>
                    {active && <Check size={16} color={opt.color} style={{ marginLeft: "auto" }} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountSection({ onBack }) {
  async function logout() {
    await supabase.auth.signOut()
  }
  return (
    <div>
      <SectionHeader title="Konto" onBack={onBack} />
      <Card>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn outline color="#dc2626" onClick={logout}><LogOut size={14} /> Logga ut</Btn>
        </div>
      </Card>
    </div>
  )
}

function SettingsTab({ isMobile, session, household, members, foodPrefs, setFoodPrefs, onCreateInvite, tvData, tvSlots, onSaveTvSlots, userId }) {
  const [activeSection, setActiveSection] = useState(null)
  const sections = [
    { id: "profile", icon: User, label: "Profil", desc: "Namn, profilbild" },
    { id: "tv", icon: Monitor, label: "TV-editor", desc: "Anpassa TV-vyn, widgets & layout" },
    { id: "household", icon: Users, label: "Hushåll & Medlemmar", desc: "Invite-kod, medlemmar" },
    { id: "food", icon: UtensilsCrossed, label: "Matpreferenser", desc: "Gillar, gillar inte, budget" },
    { id: "account", icon: LogOut, label: "Konto", desc: "Logga ut" },
  ]
  if (activeSection === "tv") return <TvEditorSection onBack={() => setActiveSection(null)} isMobile={isMobile} tvData={tvData} tvSlots={tvSlots} onSaveTvSlots={onSaveTvSlots} />
  if (activeSection === "profile") return <ProfileSection onBack={() => setActiveSection(null)} session={session} />
  if (activeSection === "household") return <HouseholdSection onBack={() => setActiveSection(null)} household={household} members={members} userId={userId} onCreateInvite={onCreateInvite} />
  if (activeSection === "food") return <FoodPrefsSection onBack={() => setActiveSection(null)} foodPrefs={foodPrefs} setFoodPrefs={setFoodPrefs} />
  if (activeSection === "account") return <AccountSection onBack={() => setActiveSection(null)} />
  return (
    <div>
      <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: isMobile ? 22 : 24, fontWeight: 700, color: t.text, margin: "0 0 16px" }}>Inställningar</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sections.map(s => (
          <Card key={s.id}>
            <div onClick={() => setActiveSection(s.id)} style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ACCENT.calendar}08`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <s.icon size={18} color={ACCENT.calendar} />
                </div>
                <div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>{s.label}</div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>{s.desc}</div>
                </div>
              </div>
              <ChevronRight size={18} color={t.textMuted} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
//  AI CHAT
// ════════════════════════════════════════════════
function AiChat({ position = "fixed", onSend }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hej! Jag kan hjälpa dig med listor, kalender, matsedel m.m. Prova: \"Lägg till mjölk på handlingslistan\" eller \"Vad äter vi på fredag?\"" },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setMessages(p => [...p, { role: "user", text }])
    setInput("")
    setLoading(true)
    try {
      const reply = await onSend(text)
      setMessages(p => [...p, { role: "ai", text: reply }])
    } catch (e) {
      setMessages(p => [...p, { role: "ai", text: "Något gick fel: " + (e.message || "okänt fel") }])
    } finally {
      setLoading(false)
    }
  }

  function handleMic() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setMessages(p => [...p, { role: "ai", text: "Röstinmatning stöds inte i den här webbläsaren." }])
      return
    }
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition
    if (listening) { setListening(false); return }
    const rec = new SR()
    rec.lang = "sv-SE"; rec.continuous = false; rec.interimResults = false
    rec.onresult = e => { setInput(e.results[0][0].transcript); setListening(false) }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    setListening(true); rec.start()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: "absolute",
        bottom: position === "mobile" ? 76 : 16, right: 16,
        width: 48, height: 48, borderRadius: 24,
        background: "linear-gradient(135deg, #7c3aed, #2563eb)",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 16px rgba(124,58,237,0.4)", zIndex: 200,
      }}>
        <Sparkles size={22} color="#fff" />
      </button>
    )
  }

  return (
    <div style={{
      position: "absolute", bottom: position === "mobile" ? 76 : 16, right: 16,
      width: 300, maxHeight: 420, background: t.card, borderRadius: 16,
      border: `1px solid ${t.cardBorder}`, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      display: "flex", flexDirection: "column", zIndex: 200, overflow: "hidden",
    }}>
      <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.line}`, background: "linear-gradient(135deg, #7c3aed08, #2563eb08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color={ACCENT.calendar} />
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>SmartHub AI</span>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <X size={16} color={t.textSec} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 280 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%", padding: "8px 12px", borderRadius: 12,
            background: msg.role === "user" ? ACCENT.calendar : t.inputBg,
            color: msg.role === "user" ? "#fff" : t.text,
            fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 500, lineHeight: 1.4,
            borderBottomRightRadius: msg.role === "user" ? 4 : 12,
            borderBottomLeftRadius: msg.role === "ai" ? 4 : 12,
            whiteSpace: "pre-wrap",
          }}>{msg.text}</div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: 12, background: t.inputBg, fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted }}>
            <span style={{ display: "inline-block", animation: "pulse 1s infinite" }}>•••</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {listening && (
        <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#dc2626", animation: "pulse 1s infinite" }} />
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: "#dc2626" }}>Lyssnar...</span>
        </div>
      )}
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${t.line}`, display: "flex", gap: 6 }}>
        <button onClick={handleMic} style={{
          width: 34, height: 34, borderRadius: 10, border: "none", cursor: "pointer",
          background: listening ? "#dc262615" : t.inputBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Mic size={14} color={listening ? "#dc2626" : t.textSec} />
        </button>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Skriv eller prata..."
          style={{ flex: 1, fontFamily: "Nunito, sans-serif", fontSize: 12, padding: "8px 10px", borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, outline: "none", color: t.text }} />
        <button onClick={handleSend} disabled={!input.trim() || loading} style={{
          width: 34, height: 34, borderRadius: 10, border: "none",
          cursor: input.trim() && !loading ? "pointer" : "default",
          background: input.trim() && !loading ? ACCENT.calendar : t.inputBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ChevronRight size={14} color={input.trim() && !loading ? "#fff" : t.textMuted} />
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
//  TAB CONTENT (shared between Mobile & Desktop)
// ════════════════════════════════════════════════
function TabContent({
  tab, isMobile, weather,
  // lists
  listsWithItems, archivedLists, pinnedListId, onToggleItem, onTogglePin, onToggleShared,
  onAddTodo, onAddList, onDeleteList, onDeleteTodo, onArchiveList, onRestoreList,
  showArchive, setShowArchive, pinnedList,
  // calendar
  calEvents, persons, onAddEvent, onDeleteEvent, onOpenAddEvent, userId,
  // meals
  mealsByWeekday, mealTagsLocal, onSetMealText, onSetMealTag,
  foodPrefs, setFoodPrefs, onAiGenerate,
  // settings
  session, household, members, onCreateInvite, tvData, tvSlots, onSaveTvSlots,
}) {
  const pad = isMobile ? "16px 16px 16px" : "24px 28px"
  if (tab === "hem") {
    return (
      <div style={{ padding: isMobile ? "20px 16px 16px" : "24px 28px" }}>
        {isMobile && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}><ClockDisplay size="small" /><WeatherMini weather={weather} /></div>}
        {!isMobile && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>Hem</h2><WeatherMini weather={weather} /></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CalendarWidget
            events={calEvents}
            persons={persons}
            onDayClick={d => onOpenAddEvent(d)}
          />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <TodoCard pinnedList={pinnedList} onToggle={onToggleItem} />
            <MealCard mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal} onSetMealText={onSetMealText} onSetMealTag={onSetMealTag} />
          </div>
        </div>
      </div>
    )
  }
  if (tab === "kalender") return <div style={{ padding: pad }}><CalendarTab isMobile={isMobile} events={calEvents} persons={persons} onAddEvent={onAddEvent} onDeleteEvent={onDeleteEvent} userId={userId} /></div>
  if (tab === "listor") {
    return (
      <div style={{ padding: pad }}>
        <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: isMobile ? 22 : 24, fontWeight: 700, color: t.text, margin: "0 0 14px" }}>Listor</h2>
        <ListTabSwitch
          activeCount={listsWithItems.length}
          archivedCount={archivedLists.length}
          showArchive={showArchive}
          setShowArchive={setShowArchive}
        />
        {showArchive ? (
          <ArchiveView
            archivedLists={archivedLists}
            onRestore={onRestoreList}
            onDeletePermanent={onDeleteList}
          />
        ) : (
          <ListsView
            lists={listsWithItems}
            pinnedListId={pinnedListId}
            onToggleItem={onToggleItem}
            onTogglePin={onTogglePin}
            onToggleShared={onToggleShared}
            onAddTodo={onAddTodo}
            onAddList={onAddList}
            onDeleteList={onDeleteList}
            onDeleteTodo={onDeleteTodo}
            onArchiveList={onArchiveList}
          />
        )}
      </div>
    )
  }
  if (tab === "mat") return <div style={{ padding: pad }}><MealTab isMobile={isMobile} mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal} onSetMealText={onSetMealText} onSetMealTag={onSetMealTag} foodPrefs={foodPrefs} setFoodPrefs={setFoodPrefs} onAiGenerate={onAiGenerate} /></div>
  if (tab === "mer") return (
    <div style={{ padding: pad }}>
      <SettingsTab isMobile={isMobile} session={session} household={household} members={members}
        foodPrefs={foodPrefs} setFoodPrefs={setFoodPrefs}
        onCreateInvite={onCreateInvite}
        tvData={tvData} tvSlots={tvSlots} onSaveTvSlots={onSaveTvSlots}
        userId={userId} />
    </div>
  )
  return null
}

// ════════════════════════════════════════════════
//  LAYOUTS
// ════════════════════════════════════════════════
function MobileNav({ tab, setTab }) {
  const tabs = [
    { id: "hem", icon: Home, label: "Hem" },
    { id: "kalender", icon: CalendarDays, label: "Kalender" },
    { id: "listor", icon: ListChecks, label: "Listor" },
    { id: "mat", icon: UtensilsCrossed, label: "Mat" },
    { id: "mer", icon: MoreHorizontal, label: "Mer" },
  ]
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: t.card, borderTop: `1px solid ${t.cardBorder}`, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "8px 0", zIndex: 100 }}>
      {tabs.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => setTab(id)} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          padding: "4px 12px", opacity: tab === id ? 1 : 0.4, transition: "opacity 0.2s",
        }}>
          <Icon size={20} color={tab === id ? ACCENT.calendar : t.text} strokeWidth={tab === id ? 2.5 : 1.8} />
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: tab === id ? 700 : 500, color: tab === id ? ACCENT.calendar : t.textSec }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

function DesktopSidebar({ tab, setTab, session, weather, household }) {
  const items = [
    { id: "hem", icon: Home, label: "Hem" },
    { id: "kalender", icon: CalendarDays, label: "Kalender" },
    { id: "listor", icon: ListChecks, label: "Listor" },
    { id: "mat", icon: UtensilsCrossed, label: "Mat" },
    { id: "mer", icon: Settings, label: "Inställningar" },
  ]
  const email = session?.user?.email || ""
  const initial = (email[0] || "?").toUpperCase()
  return (
    <div style={{ width: 220, background: t.card, borderRight: `1px solid ${t.cardBorder}`, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0, height: "100%" }}>
      <div style={{ padding: "0 20px 16px", borderBottom: `1px solid ${t.line}` }}>
        <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 6 }}>SmartHub</div>
        <ClockDisplay size="tiny" />
        <div style={{ marginTop: 6 }}><WeatherMini weather={weather} /></div>
      </div>
      <div style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(({ id, icon: Icon, label }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              background: active ? `${ACCENT.calendar}10` : "transparent",
              border: "none", cursor: "pointer",
            }}>
              <Icon size={18} color={active ? ACCENT.calendar : t.textSec} strokeWidth={active ? 2.4 : 1.8} />
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: active ? 700 : 500, color: active ? t.text : t.textSec }}>{label}</span>
            </button>
          )
        })}
      </div>
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${t.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: `${ACCENT.calendar}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 13, fontWeight: 700, color: ACCENT.calendar }}>{initial}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: "Nunito, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
            <div style={{ fontSize: 11, color: t.textSec, fontFamily: "Nunito, sans-serif" }}>Hushåll: {household?.name || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// TV-widgets som kan placeras i slots
const TV_SLOT_OPTIONS = [
  { id: "calendar", label: "Kalender", color: ACCENT.calendar, icon: CalendarDays },
  { id: "todo",     label: "Att göra", color: ACCENT.todo,     icon: ListChecks },
  { id: "meal",     label: "Matsedel", color: ACCENT.meal,     icon: UtensilsCrossed },
  { id: "events",   label: "Dagens händelser", color: ACCENT.event, icon: CalendarDays },
  { id: "empty",    label: "Tom",      color: t.textMuted,     icon: X },
]
const DEFAULT_TV_SLOTS = { main: "calendar", bottomLeft: "todo", bottomRight: "meal" }

// Standardiserad widget-renderer för TV-slots
function renderTvSlotWidget(type, p) {
  if (type === "calendar") return <CalendarWidget events={p.calEvents} persons={p.persons} fill />
  if (type === "todo")     return <TodoCard pinnedList={p.pinnedList} onToggle={p.onToggleItem} fill />
  if (type === "meal")     return <MealCard fill mealsByWeekday={p.mealsByWeekday} mealTagsLocal={p.mealTagsLocal} onSetMealText={() => {}} onSetMealTag={() => {}} />
  if (type === "events")   return <TvEventsCard events={p.calEvents} persons={p.persons} />
  if (type === "empty")    return <div style={{ flex: 1, background: t.inputBg, borderRadius: 14, border: `1px dashed ${t.cardBorder}` }} />
  return null
}

// Lista över dagens & kommande händelser — TV-vänlig
function TvEventsCard({ events, persons }) {
  const upcoming = useMemo(() => {
    const now = new Date()
    return events
      .filter(e => new Date(e.start_time) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 6)
  }, [events])
  return (
    <Card accent={ACCENT.event} style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Label color={ACCENT.event} icon={CalendarDays}>Kommande</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, flex: 1, overflow: "hidden" }}>
          {upcoming.length === 0 && <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>Inget inplanerat</span>}
          {upcoming.map(ev => {
            const p = getPersonForEvent(ev, persons)
            const d = new Date(ev.start_time)
            return (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: `${p.color}08`, borderRadius: 8, border: `1px solid ${p.color}15` }}>
                <div style={{ width: 3, height: 22, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 9, color: t.textMuted }}>
                    {d.getDate()} {MONTHS_SHORT[d.getMonth()]} · {fmtTime(ev.start_time)}
                  </div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// Inre TV-vy: 540x960 logiskt format. Renderas både i riktig TV-läge (med zoom:2)
// och i TV-editorns preview (skalad ner med transform: scale).
// `slots` styr vilka widgets som syns i de 3 slottarna (main, bottomLeft, bottomRight).
// `slotOverlay(slotId)` är en valfri render prop som lägger en klickbar overlay över varje slot
// (används av editor:n för att kunna byta widget).
function TvViewContent({ persons, calEvents, pinnedList, onToggleItem, mealsByWeekday, mealTagsLocal, weather, slots, slotOverlay }) {
  const s = { ...DEFAULT_TV_SLOTS, ...(slots || {}) }
  const widgetProps = { persons, calEvents, pinnedList, onToggleItem, mealsByWeekday, mealTagsLocal }
  return (
    <div style={{
      width: "100%", height: "100%",
      background: t.bg, fontFamily: "Nunito, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      boxSizing: "border-box",
    }}>
      <div style={{ padding: "24px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <ClockDisplay size="huge" />
        <div style={{ textAlign: "right" }}>
          {weather ? <>
            <WmoIcon code={weather.code} size={40} color={ACCENT.weather} />
            <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 32, fontWeight: 300, color: t.text }}>{weather.temp}°</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted }}>{weather.desc}</div>
          </> : <span style={{ color: t.textMuted, fontSize: 12 }}>—</span>}
        </div>
      </div>
      {weather?.forecast && (
        <div style={{ display: "flex", gap: 8, padding: "0 20px 12px" }}>
          {weather.forecast.map(f => (
            <div key={f.day} style={{ flex: 1, background: "rgba(255,255,255,0.7)", borderRadius: 10, padding: "5px 0", textAlign: "center", border: `1px solid ${t.cardBorder}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: "0.05em" }}>{f.day}</div>
              <WmoIcon code={f.code} size={16} color={t.textSec} />
              <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 11, fontWeight: 600, color: t.textSec }}>{f.temp}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px", gap: 10, minHeight: 0 }}>
        <div style={{ flex: 6, display: "flex", minHeight: 0, position: "relative" }}>
          {renderTvSlotWidget(s.main, widgetProps)}
          {slotOverlay && slotOverlay("main", s.main)}
        </div>
        <div style={{ flex: 4, display: "flex", gap: 10, minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
            {renderTvSlotWidget(s.bottomLeft, widgetProps)}
            {slotOverlay && slotOverlay("bottomLeft", s.bottomLeft)}
          </div>
          <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative" }}>
            {renderTvSlotWidget(s.bottomRight, widgetProps)}
            {slotOverlay && slotOverlay("bottomRight", s.bottomRight)}
          </div>
        </div>
      </div>
    </div>
  )
}

// Riktig TV-vy (visas på 1080x1920-skärm via zoom:2 på 540x960 logiskt).
function TvLayout(props) {
  return (
    <div style={{
      width: 540, height: 960,
      position: "fixed", top: 0, left: 0, overflow: "hidden",
      zoom: 2, transformOrigin: "top left",
    }}>
      <style>{"html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important} *::-webkit-scrollbar{display:none!important}"}</style>
      <TvViewContent {...props} />
    </div>
  )
}

// Preview-komponent för TV-editor: skalad version av samma vy.
function TvPreview({ scale = 0.5, ...props }) {
  return (
    <div style={{
      width: 540 * scale, height: 960 * scale,
      position: "relative", overflow: "hidden",
      borderRadius: 14, border: `2px solid ${t.cardBorder}`,
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      background: "#000",
    }}>
      <div style={{
        width: 540, height: 960,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        pointerEvents: "none",
      }}>
        <TvViewContent {...props} />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════
export default function SmartHub({ session, household }) {
  const userId = session?.user?.id
  const householdId = household?.id
  const view = useViewport()

  // ── UI state ──
  const [tab, setTab] = useState("hem")
  const [showArchive, setShowArchive] = useState(false)

  // ── Data state (synced from Supabase, same shape as v10) ──
  const [lists, setLists] = useState([])
  const [todos, setTodos] = useState([])
  const [calEvents, setCalEvents] = useState([])
  const [meals, setMeals] = useState([])
  const [tvWidgets, setTvWidgets] = useState(null)
  const [tvSlots, setTvSlots] = useState(null) // {main, bottomLeft, bottomRight}
  const [members, setMembers] = useState([])
  const [weather, setWeather] = useState(null)

  // ── v11 stub state (no Supabase persistence yet — see MIGRATIONS.sql) ──
  // ── Lifted add-event modal (öppnas från Hem-vyns kalender) ──
  const [addEventModal, setAddEventModal] = useState({ open: false, date: null })
  function openAddEvent(date) { setAddEventModal({ open: true, date }) }
  function closeAddEvent() { setAddEventModal({ open: false, date: null }) }

  // ── Food-prefs (laddas från food_preferences-tabellen) ──
  const [foodPrefs, setFoodPrefs] = useState({ likes: [], dislikes: [], budget: "blandat", notes: "" })
  const foodPrefsLoadedRef = useRef(false)

  // ── Current week (for meals) ──
  const currentWeekStart = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
    return fmtDate(mon)
  }, [])

  // ── Load + subscribe: weather (open-meteo, no auth) ──
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max&timezone=Europe/Stockholm&forecast_days=4`)
        if (!r.ok) return
        const j = await r.json()
        if (cancelled) return
        const p = parseWeather(j)
        if (p) setWeather(p)
      } catch (e) { console.error("[weather]", e) }
    }
    load()
    const i = setInterval(load, 30 * 60 * 1000)
    return () => { cancelled = true; clearInterval(i) }
  }, [])

  // ── Load + subscribe: tv_layouts ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function f() {
      // tv_layouts har `widgets` (legacy v10) och `slots` (v11). Försök läsa båda; om
      // slots-kolumnen inte finns ännu, fall tillbaka till bara widgets + localStorage.
      let data = null
      const r1 = await supabase.from("tv_layouts").select("widgets,slots").eq("household_id", householdId).maybeSingle()
      if (!r1.error) {
        data = r1.data
      } else {
        const r2 = await supabase.from("tv_layouts").select("widgets").eq("household_id", householdId).maybeSingle()
        if (!r2.error) data = r2.data
      }
      if (cancelled) return
      if (data?.widgets) setTvWidgets(data.widgets)
      if (data?.slots) {
        setTvSlots(data.slots)
      } else if (typeof window !== "undefined") {
        // Fallback om slots inte finns i DB ännu
        try {
          const stored = localStorage.getItem("smarthub:tvSlots:" + householdId)
          if (stored) setTvSlots(JSON.parse(stored))
        } catch {}
      }
    }
    f()
    const ch = supabase.channel("tv:" + householdId).on("postgres_changes", {
      event: "*", schema: "public", table: "tv_layouts", filter: "household_id=eq." + householdId,
    }, p => {
      if (p.new?.widgets) setTvWidgets(p.new.widgets)
      if (p.new?.slots) setTvSlots(p.new.slots)
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId])

  // ── Load + subscribe: lists ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function f() {
      const { data, error } = await supabase.from("lists").select("*").eq("household_id", householdId).order("created_at", { ascending: true })
      if (cancelled) return
      if (!error) setLists(data || [])
    }
    f()
    const ch = supabase.channel("lists:" + householdId).on("postgres_changes", {
      event: "*", schema: "public", table: "lists", filter: "household_id=eq." + householdId,
    }, p => {
      setLists(prev => {
        if (p.eventType === "INSERT") return prev.some(l => l.id === p.new.id) ? prev : [...prev, p.new]
        if (p.eventType === "UPDATE") return prev.map(l => l.id === p.new.id ? p.new : l)
        if (p.eventType === "DELETE") return prev.filter(l => l.id !== p.old.id)
        return prev
      })
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId])

  // ── Load + subscribe: todos ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function f() {
      const { data, error } = await supabase.from("todos").select("*").eq("household_id", householdId).order("created_at", { ascending: true })
      if (cancelled) return
      if (!error) setTodos(data || [])
    }
    f()
    const ch = supabase.channel("todos:" + householdId).on("postgres_changes", {
      event: "*", schema: "public", table: "todos", filter: "household_id=eq." + householdId,
    }, p => {
      setTodos(prev => {
        if (p.eventType === "INSERT") return prev.some(td => td.id === p.new.id) ? prev : [...prev, p.new]
        if (p.eventType === "UPDATE") return prev.map(td => td.id === p.new.id ? p.new : td)
        if (p.eventType === "DELETE") return prev.filter(td => td.id !== p.old.id)
        return prev
      })
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId])

  // ── Load + subscribe: calendar_events ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function f() {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString()
      const to = new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString()
      const { data, error } = await supabase.from("calendar_events").select("*").eq("household_id", householdId)
        .gte("start_time", from).lte("start_time", to).order("start_time", { ascending: true })
      if (cancelled) return
      if (!error) setCalEvents(data || [])
    }
    f()
    const ch = supabase.channel("events:" + householdId).on("postgres_changes", {
      event: "*", schema: "public", table: "calendar_events", filter: "household_id=eq." + householdId,
    }, p => {
      setCalEvents(prev => {
        if (p.eventType === "INSERT") return prev.some(e => e.id === p.new.id) ? prev : [...prev, p.new]
        if (p.eventType === "UPDATE") return prev.map(e => e.id === p.new.id ? p.new : e)
        if (p.eventType === "DELETE") return prev.filter(e => e.id !== p.old.id)
        return prev
      })
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId])

  // ── Load + subscribe: meals (current week) ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function f() {
      const { data, error } = await supabase.from("meals").select("*").eq("household_id", householdId).eq("week_start_date", currentWeekStart)
      if (cancelled) return
      if (!error) setMeals(data || [])
    }
    f()
    const ch = supabase.channel("meals:" + householdId + ":" + currentWeekStart).on("postgres_changes", {
      event: "*", schema: "public", table: "meals", filter: "household_id=eq." + householdId,
    }, p => {
      const row = p.new || p.old
      if (!row || row.week_start_date !== currentWeekStart) return
      setMeals(prev => {
        if (p.eventType === "INSERT") return prev.some(m => m.id === p.new.id) ? prev : [...prev, p.new]
        if (p.eventType === "UPDATE") return prev.map(m => m.id === p.new.id ? p.new : m)
        if (p.eventType === "DELETE") return prev.filter(m => m.id !== p.old.id)
        return prev
      })
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId, currentWeekStart])

  // ── Load: household_members ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    supabase.from("household_members").select("user_id,role,joined_at").eq("household_id", householdId)
      .then(({ data }) => { if (!cancelled && data) setMembers(data) })
    return () => { cancelled = true }
  }, [householdId])

  // ── Load: food_preferences (per användare) ──
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase.from("food_preferences").select("likes,dislikes,budget,notes").eq("user_id", userId).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          setFoodPrefs({
            likes: data.likes || [],
            dislikes: data.dislikes || [],
            budget: data.budget || "blandat",
            notes: data.notes || "",
          })
        }
        foodPrefsLoadedRef.current = true
      })
    return () => { cancelled = true }
  }, [userId])

  // Debounced save av food_preferences vid varje ändring (efter att laddningen är klar)
  useEffect(() => {
    if (!userId || !foodPrefsLoadedRef.current) return
    const ti = setTimeout(async () => {
      await supabase.from("food_preferences").upsert({
        user_id: userId,
        likes: foodPrefs.likes,
        dislikes: foodPrefs.dislikes,
        budget: foodPrefs.budget,
        notes: foodPrefs.notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
    }, 600)
    return () => clearTimeout(ti)
  }, [foodPrefs, userId])

  // ── Derived data ──
  const persons = useMemo(() => members.map((m, i) => ({
    user_id: m.user_id,
    name: m.user_id === userId ? "Du" : "Medlem " + (i + 1),
    color: PERSON_PALETTE[i % PERSON_PALETTE.length],
    role: m.role,
  })), [members, userId])

  const allListsWithItems = useMemo(() => lists.map(l => ({
    ...l,
    items: todos.filter(td => td.list_id === l.id).map(td => ({
      id: td.id, text: td.text, done: td.done, list_id: td.list_id, shared: td.shared,
    })),
  })), [lists, todos])

  // Aktiva listor (visas i huvudvyn) — arkiverade göms
  const listsWithItems = useMemo(
    () => allListsWithItems.filter(l => !l.archived),
    [allListsWithItems]
  )
  const archivedLists = useMemo(
    () => allListsWithItems.filter(l => l.archived).sort((a, b) =>
      new Date(b.archived_at || 0) - new Date(a.archived_at || 0)
    ),
    [allListsWithItems]
  )

  // Auto-arkivera listor där alla items är bockade (och listan har minst 1 item).
  // useRef-guarden förhindrar dubbel-trigger om både realtime + lokal optimistic uppdaterar.
  const autoArchiveBusyRef = useRef(new Set())
  useEffect(() => {
    if (!householdId) return
    const candidates = lists.filter(l =>
      !l.archived
      && l.household_id === householdId
      && !autoArchiveBusyRef.current.has(l.id)
    ).filter(l => {
      const items = todos.filter(td => td.list_id === l.id)
      return items.length > 0 && items.every(td => td.done)
    })
    if (candidates.length === 0) return
    candidates.forEach(l => {
      autoArchiveBusyRef.current.add(l.id)
      handleArchiveList(l.id).finally(() => {
        // släpp efter en kort delay så det inte triggar igen omedelbart
        setTimeout(() => autoArchiveBusyRef.current.delete(l.id), 1500)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, todos, householdId])

  // pinned är nu en kolumn i lists-tabellen. Hitta den listan, fall tillbaka till första aktiva.
  const pinnedListId = useMemo(
    () => lists.find(l => l.pinned && !l.archived)?.id || listsWithItems[0]?.id || null,
    [lists, listsWithItems]
  )
  const pinnedList = listsWithItems.find(l => l.id === pinnedListId) || listsWithItems[0]

  const mealsByWeekday = useMemo(() => {
    const m = {}
    meals.forEach(meal => { m[meal.weekday] = meal })
    return m
  }, [meals])

  // mealTagsLocal är nu härlett från meals.tag-kolumnen (weekday → tagId)
  const mealTagsLocal = useMemo(() => {
    const map = {}
    meals.forEach(m => { if (m.tag) map[m.weekday] = m.tag })
    return map
  }, [meals])

  // ── CRUD handlers (lifted verbatim from v10) ──
  async function handleToggleTodo(item) {
    const nd = !item.done
    setTodos(p => p.map(td => td.id === item.id ? { ...td, done: nd, completed_at: nd ? new Date().toISOString() : null } : td))
    const { error } = await supabase.from("todos").update({ done: nd, completed_at: nd ? new Date().toISOString() : null }).eq("id", item.id)
    if (error) setTodos(p => p.map(td => td.id === item.id ? item : td))
  }
  async function handleAddTodo(text, listId) {
    const tmp = { id: "tmp-" + Date.now(), household_id: householdId, text, done: false, list_id: listId, shared: true, created_by: userId, created_at: new Date().toISOString() }
    setTodos(p => [...p, tmp])
    const { data, error } = await supabase.from("todos").insert({ household_id: householdId, text, done: false, list_id: listId, created_by: userId }).select().single()
    if (error) setTodos(p => p.filter(td => td.id !== tmp.id))
    else setTodos(p => p.map(td => td.id === tmp.id ? data : td))
  }
  async function handleDeleteTodo(item) {
    setTodos(p => p.filter(td => td.id !== item.id))
    await supabase.from("todos").delete().eq("id", item.id)
  }
  async function handleAddList(list) {
    await supabase.from("lists").insert({
      household_id: householdId, name: list.name, shared: list.shared,
      color: list.color, expires_at: list.expires_at, created_by: userId,
    })
  }
  async function handleDeleteList(id) {
    setLists(p => p.filter(l => l.id !== id))
    await supabase.from("lists").delete().eq("id", id)
  }
  // Arkivera = soft-delete: listan göms från huvudvyn men finns kvar i Arkiv.
  async function handleArchiveList(id) {
    const now = new Date().toISOString()
    setLists(p => p.map(l => l.id === id ? { ...l, archived: true, archived_at: now } : l))
    await supabase.from("lists").update({ archived: true, archived_at: now }).eq("id", id)
  }
  async function handleRestoreList(id) {
    setLists(p => p.map(l => l.id === id ? { ...l, archived: false, archived_at: null } : l))
    await supabase.from("lists").update({ archived: false, archived_at: null }).eq("id", id)
  }
  async function handleToggleSharedList(list) {
    setLists(p => p.map(l => l.id === list.id ? { ...l, shared: !l.shared } : l))
    await supabase.from("lists").update({ shared: !list.shared }).eq("id", list.id)
  }
  // Endast EN lista i hushållet kan vara pinned åt gången. Toggla av om redan pinned.
  async function handleTogglePin(listId) {
    const target = lists.find(l => l.id === listId)
    if (!target) return
    const newPinned = !target.pinned
    // Optimistic: uppdatera local state direkt
    setLists(p => p.map(l => l.household_id === householdId
      ? { ...l, pinned: l.id === listId ? newPinned : false }
      : l))
    // Avpinna alla andra i hushållet, sätt pinned på den valda
    await supabase.from("lists").update({ pinned: false }).eq("household_id", householdId).neq("id", listId)
    await supabase.from("lists").update({ pinned: newPinned }).eq("id", listId)
  }
  async function handleAddEvent(ev) {
    await supabase.from("calendar_events").insert({
      household_id: householdId, title: ev.title,
      start_time: ev.start_time, end_time: ev.end_time,
      location: ev.location, color: ev.color, shared: ev.shared,
      recurrence_rule: ev.recurrence_rule || null,
      created_by: userId,
    })
  }
  // Om id är från en återkommande instans (innehåller "_occ_"), ta bort hela serien.
  async function handleDeleteEvent(id) {
    const realId = typeof id === "string" && id.includes("_occ_") ? id.split("_occ_")[0] : id
    setCalEvents(p => p.filter(e => e.id !== realId))
    await supabase.from("calendar_events").delete().eq("id", realId)
  }
  async function handleSetMealText(weekday, text) {
    if (!text) {
      const ex = meals.find(m => m.weekday === weekday)
      if (ex) {
        setMeals(p => p.filter(m => m.id !== ex.id))
        await supabase.from("meals").delete().eq("id", ex.id)
      }
      return
    }
    const ex = meals.find(m => m.weekday === weekday)
    if (ex) {
      setMeals(p => p.map(m => m.id === ex.id ? { ...m, meal_text: text } : m))
      await supabase.from("meals").update({ meal_text: text }).eq("id", ex.id)
    } else {
      const tmp = { id: "tmp-" + Date.now(), household_id: householdId, week_start_date: currentWeekStart, weekday, meal_text: text }
      setMeals(p => [...p, tmp])
      const { data, error } = await supabase.from("meals").insert({ household_id: householdId, week_start_date: currentWeekStart, weekday, meal_text: text }).select().single()
      if (error) setMeals(p => p.filter(m => m.id !== tmp.id))
      else setMeals(p => p.map(m => m.id === tmp.id ? data : m))
    }
  }
  // tag persisteras i meals.tag-kolumnen. Om raden saknas (t.ex. tag på en dag utan meal_text)
  // skapar vi ett tomt meals-rad med bara taggen.
  async function handleSetMealTag(weekday, tag) {
    const ex = meals.find(m => m.weekday === weekday)
    if (ex) {
      setMeals(p => p.map(m => m.id === ex.id ? { ...m, tag } : m))
      await supabase.from("meals").update({ tag }).eq("id", ex.id)
    } else if (tag) {
      const tmp = { id: "tmp-" + Date.now(), household_id: householdId, week_start_date: currentWeekStart, weekday, meal_text: "", tag }
      setMeals(p => [...p, tmp])
      const { data, error } = await supabase.from("meals").insert({ household_id: householdId, week_start_date: currentWeekStart, weekday, meal_text: "", tag }).select().single()
      if (error) setMeals(p => p.filter(m => m.id !== tmp.id))
      else setMeals(p => p.map(m => m.id === tmp.id ? data : m))
    }
  }
  async function handleSaveTvLayout(widgets) {
    setTvWidgets(widgets)
    await supabase.from("tv_layouts").upsert({
      household_id: householdId, widgets, updated_at: new Date().toISOString(),
    }, { onConflict: "household_id" })
  }
  async function handleSaveTvSlots(slots) {
    setTvSlots(slots)
    if (!householdId) return
    // Persistera mot DB om kolumnen finns. Annars logga + spara i localStorage som fallback.
    const { error } = await supabase.from("tv_layouts").upsert({
      household_id: householdId, slots, updated_at: new Date().toISOString(),
    }, { onConflict: "household_id" })
    if (error) {
      console.warn("[tvSlots] DB-spar misslyckades — kör MIGRATIONS.sql för persistens:", error.message)
      if (typeof window !== "undefined") {
        try { localStorage.setItem("smarthub:tvSlots:" + householdId, JSON.stringify(slots)) } catch {}
      }
    }
  }
  async function handleCreateInvite() {
    const code = genCode()
    const { error } = await supabase.from("invites").insert({ household_id: householdId, code, created_by: userId })
    return error ? null : code
  }

  // ── AI handlers ──
  async function handleAiChat(message) {
    const ctx = {
      lists: listsWithItems.map(l => ({
        name: l.name, shared: l.shared,
        items: l.items.map(it => ({ text: it.text, done: it.done })),
      })),
      events: calEvents.slice(0, 50).map(e => ({
        title: e.title, start_time: e.start_time, location: e.location,
      })),
      meals: meals.map(m => ({ weekday: m.weekday, meal_text: m.meal_text })),
      foodPrefs,
    }
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: { message, context: ctx },
    })
    if (error) throw new Error(error.message || "AI-anrop misslyckades")
    return data?.reply || "(tomt svar)"
  }

  async function handleAiGenerateMeals(prefs) {
    const { data, error } = await supabase.functions.invoke("ai-meal-gen", {
      body: { prefs, week_start: currentWeekStart },
    })
    if (error) throw new Error(error.message || "Generering misslyckades")
    if (!Array.isArray(data?.meals)) throw new Error("Ogiltigt svar från AI")
    for (const m of data.meals) {
      if (typeof m.weekday === "number" && typeof m.meal_text === "string") {
        await handleSetMealText(m.weekday, m.meal_text)
      }
    }
  }

  // ── Render ──
  const fonts = (
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap" />
  )
  const globalCss = (
    <style>{`
      body{margin:0;background:${t.bg};font-family:'Nunito',sans-serif;color:${t.text};-webkit-font-smoothing:antialiased}
      *{box-sizing:border-box}
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    `}</style>
  )

  // ─── TV view ───
  if (view === "tv") {
    return (
      <>
        {fonts}{globalCss}
        <TvLayout
          persons={persons}
          calEvents={calEvents}
          pinnedList={pinnedList}
          onToggleItem={handleToggleTodo}
          mealsByWeekday={mealsByWeekday}
          mealTagsLocal={mealTagsLocal}
          weather={weather}
          slots={tvSlots}
        />
      </>
    )
  }

  const tabContentProps = {
    tab, isMobile: view === "mobile", weather,
    listsWithItems, archivedLists, pinnedListId,
    onToggleItem: handleToggleTodo,
    onTogglePin: handleTogglePin,
    onToggleShared: handleToggleSharedList,
    onAddTodo: handleAddTodo,
    onAddList: handleAddList,
    onDeleteList: handleDeleteList,
    onDeleteTodo: handleDeleteTodo,
    onArchiveList: handleArchiveList,
    onRestoreList: handleRestoreList,
    showArchive, setShowArchive,
    pinnedList,
    calEvents, persons, onAddEvent: handleAddEvent, onDeleteEvent: handleDeleteEvent, onOpenAddEvent: openAddEvent, userId,
    mealsByWeekday, mealTagsLocal,
    onSetMealText: handleSetMealText,
    onSetMealTag: handleSetMealTag,
    foodPrefs, setFoodPrefs,
    onAiGenerate: handleAiGenerateMeals,
    session, household, members,
    onCreateInvite: handleCreateInvite,
    tvData: {
      persons, calEvents, pinnedList,
      onToggleItem: handleToggleTodo,
      mealsByWeekday, mealTagsLocal, weather,
    },
    tvSlots, onSaveTvSlots: handleSaveTvSlots,
  }

  const lifedAddEventModal = (
    <AddEventModal
      open={addEventModal.open}
      prefillDate={addEventModal.date}
      persons={persons}
      onClose={closeAddEvent}
      onSave={handleAddEvent}
    />
  )

  // ─── Mobile view ───
  if (view === "mobile") {
    return (
      <>
        {fonts}{globalCss}
        <div style={{ height: "100dvh", background: t.bg, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Nunito, sans-serif", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto", paddingBottom: 70 }}>
            <TabContent {...tabContentProps} />
          </div>
          <MobileNav tab={tab} setTab={setTab} />
          <AiChat position="mobile" onSend={handleAiChat} />
        </div>
        {lifedAddEventModal}
      </>
    )
  }

  // ─── Desktop view ───
  return (
    <>
      {fonts}{globalCss}
      <div style={{ height: "100vh", background: t.bg, display: "flex", overflow: "hidden", fontFamily: "Nunito, sans-serif" }}>
        <DesktopSidebar tab={tab} setTab={setTab} session={session} weather={weather} household={household} />
        <div style={{ flex: 1, overflow: "auto", minWidth: 0, position: "relative" }}>
          <TabContent {...tabContentProps} />
          <AiChat position="desktop" onSend={handleAiChat} />
        </div>
      </div>
      {lifedAddEventModal}
    </>
  )
}
