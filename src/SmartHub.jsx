import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "./lib/supabase"
import {
  Home, CalendarDays, ListChecks, UtensilsCrossed, MoreHorizontal, Settings,
  Check, Plus, Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning,
  CloudDrizzle, CloudFog, Snowflake, Monitor,
  Users, Lock, X, ChevronRight, ChevronLeft, User, LogOut, Sparkles,
  ThumbsUp, ThumbsDown, Grip, Copy, Trash2, Edit3, Mic, MapPin,
  Archive, ArchiveRestore, Search, Repeat, Bell,
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
// ── Svenska helgdagar och bemärkelsedagar ──
// Beräknar påskdagen (Gauss algoritm) → används för rörliga helgdagar
function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) }
// Hitta första lör/sön i månad (för t.ex. mors- och farsdag som infaller på söndag)
function nthWeekdayOfMonth(year, month, weekday, n) {
  const d = new Date(year, month, 1)
  const offset = (weekday - d.getDay() + 7) % 7
  return new Date(year, month, 1 + offset + (n - 1) * 7)
}
function lastWeekdayOfMonth(year, month, weekday) {
  const d = new Date(year, month + 1, 0) // sista dagen i månaden
  const offset = (d.getDay() - weekday + 7) % 7
  return new Date(year, month, d.getDate() - offset)
}
// Cache för helgdagar per år (beräkning är inte gratis)
const _holidayCache = {}
// Hitta veckodag (0=sön..6=lör) på/efter ett specifikt datum
function weekdayOnOrAfter(year, month, day, weekday) {
  const d = new Date(year, month, day)
  const offset = (weekday - d.getDay() + 7) % 7
  return new Date(year, month, day + offset)
}
function getSwedishHolidays(year) {
  try {
    if (_holidayCache[year]) return _holidayCache[year]
    const easter = easterSunday(year)
    const result = [
      { date: new Date(year, 0, 1),  name: "Nyårsdagen",         color: "#dc2626", redday: true },
      { date: new Date(year, 0, 6),  name: "Trettondedag jul",   color: "#dc2626", redday: true },
      { date: addDays(easter, -3),   name: "Skärtorsdag",        color: "#7c3aed" },
      { date: addDays(easter, -2),   name: "Långfredagen",       color: "#dc2626", redday: true },
      { date: easter,                name: "Påskdagen",          color: "#dc2626", redday: true },
      { date: addDays(easter, 1),    name: "Annandag påsk",      color: "#dc2626", redday: true },
      { date: new Date(year, 3, 30), name: "Valborgsmässoafton", color: "#d97706" },
      { date: new Date(year, 4, 1),  name: "Första maj",         color: "#dc2626", redday: true },
      { date: addDays(easter, 39),   name: "Kristi himmelsfärd", color: "#dc2626", redday: true },
      { date: lastWeekdayOfMonth(year, 4, 0), name: "Mors dag",  color: "#db2777" }, // sista söndagen i maj
      { date: addDays(easter, 49),   name: "Pingstdagen",        color: "#dc2626", redday: true },
      { date: new Date(year, 5, 6),  name: "Sveriges nationaldag", color: "#dc2626", redday: true },
      // Midsommarafton: fredagen mellan 19-25 juni (= första fredagen från och med 19 juni)
      { date: weekdayOnOrAfter(year, 5, 19, 5), name: "Midsommarafton", color: "#d97706" },
      // Midsommardagen: lördagen mellan 20-26 juni
      { date: weekdayOnOrAfter(year, 5, 20, 6), name: "Midsommardagen", color: "#dc2626", redday: true },
      // Alla helgons dag: lördagen mellan 31 okt - 6 nov
      { date: weekdayOnOrAfter(year, 9, 31, 6), name: "Alla helgons dag", color: "#dc2626", redday: true },
      { date: nthWeekdayOfMonth(year, 10, 0, 2), name: "Fars dag",       color: "#0ea5e9" }, // 2:a söndagen i november
      { date: new Date(year, 11, 24), name: "Julafton",      color: "#dc2626", redday: true },
      { date: new Date(year, 11, 25), name: "Juldagen",      color: "#dc2626", redday: true },
      { date: new Date(year, 11, 26), name: "Annandag jul",  color: "#dc2626", redday: true },
      { date: new Date(year, 11, 31), name: "Nyårsafton",    color: "#d97706" },
    ]
    // Adventsöndagar (4 söndagar före juldagen)
    const christmas = new Date(year, 11, 25)
    const lastSunday = christmas.getDay() === 0 ? addDays(christmas, -7) : addDays(christmas, -christmas.getDay())
    result.push({ date: addDays(lastSunday, -21), name: "1:a advent", color: "#7c3aed" })
    result.push({ date: addDays(lastSunday, -14), name: "2:a advent", color: "#7c3aed" })
    result.push({ date: addDays(lastSunday, -7),  name: "3:e advent", color: "#7c3aed" })
    result.push({ date: lastSunday,               name: "4:e advent", color: "#7c3aed" })

    _holidayCache[year] = result
    return result
  } catch (e) {
    console.error("[holidays]", e)
    return []
  }
}
function getHolidayForDate(date) {
  try {
    const holidays = getSwedishHolidays(date.getFullYear())
    return holidays.find(h =>
      h.date.getFullYear() === date.getFullYear() &&
      h.date.getMonth() === date.getMonth() &&
      h.date.getDate() === date.getDate()
    )
  } catch (e) {
    console.error("[getHolidayForDate]", e)
    return null
  }
}

// Fuzzy-matchnings-helpers för AI tool dispatcher
function findByName(items, query, getName, requireActive) {
  if (!query) return null
  const q = query.toLowerCase().trim()
  const pool = requireActive ? items.filter(i => !i.archived && !i.done) : items
  let m = pool.find(i => getName(i).toLowerCase() === q)
  if (m) return m
  m = pool.find(i => getName(i).toLowerCase().includes(q))
  if (m) return m
  return pool.find(i => q.includes(getName(i).toLowerCase()))
}

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
// För icke-återkommande events: returnera bara om start_time är inom [from, to].
function expandRecurring(event, from, to) {
  const fromMs = from.getTime()
  const toMs = to.getTime()
  if (!event.recurrence_rule || !event.recurrence_rule.freq) {
    // Vanlig (icke-återkommande) händelse: ta med endast om den infaller inom fönstret
    const startMs = new Date(event.start_time).getTime()
    if (startMs >= fromMs && startMs <= toMs) return [event]
    return []
  }
  const rule = event.recurrence_rule
  const out = []
  const startMs = new Date(event.start_time).getTime()
  const endMs = new Date(event.end_time).getTime()
  const duration = endMs - startMs
  const untilMs = rule.until ? new Date(rule.until + "T23:59:59").getTime() : Infinity
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
function CalendarWidget({ events, persons, fill, compact, large, onDayClick }) {
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: "center", fontFamily: "Nunito, sans-serif", fontSize: large ? 12 : compact ? 10 : 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: large ? 3 : 1 }}>
          {weeks.map((wk, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, flex: 1, minHeight: large ? 72 : undefined }}>
              {wk.map((day, di) => {
                const isToday = day === today.getDate() && isCurrentMonth
                const dayEvents = day ? (eventsForView[day] || []) : []
                const clickable = !!(day && onDayClick)
                const holiday = day ? getHolidayForDate(new Date(vy, vm, day)) : null
                const isRedDay = !!holiday?.redday
                const dateColor = !day ? "transparent" : isToday ? ACCENT.calendar : isRedDay ? "#dc2626" : t.text
                return (
                  <div key={di}
                    onClick={clickable ? () => onDayClick(new Date(vy, vm, day)) : undefined}
                    title={holiday?.name || ""}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "stretch",
                      borderRadius: 6, padding: large ? "4px 3px" : "2px 2px 1px",
                      background: isToday ? `${ACCENT.calendar}08` : isRedDay ? "#dc262608" : "transparent",
                      border: isToday ? `1.5px solid ${ACCENT.calendar}30` : "1.5px solid transparent",
                      minHeight: 0, overflow: "hidden",
                      cursor: clickable ? "pointer" : "default",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={clickable ? e => { if (!isToday) e.currentTarget.style.background = `${ACCENT.calendar}06` } : undefined}
                    onMouseLeave={clickable ? e => { if (!isToday) e.currentTarget.style.background = isRedDay ? "#dc262608" : "transparent" } : undefined}
                  >
                    <div style={{
                      fontFamily: "Comfortaa, sans-serif",
                      fontSize: large ? 14 : compact ? 10 : 11,
                      fontWeight: isToday ? 800 : isRedDay ? 700 : 500,
                      color: dateColor,
                      textAlign: "center", lineHeight: 1, marginBottom: large ? 3 : 1,
                    }}>{day || ""}</div>
                    {holiday && (
                      <div style={{
                        fontSize: large ? 9 : 7,
                        fontFamily: "Nunito, sans-serif", fontWeight: 700,
                        color: holiday.color, background: `${holiday.color}15`,
                        borderRadius: 3,
                        padding: large ? "1px 4px" : "0 2px",
                        lineHeight: 1.2,
                        textAlign: "center", marginBottom: large ? 2 : 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{holiday.name}</div>
                    )}
                    {dayEvents.slice(0, large ? 2 : fill ? 2 : 1).map((ev) => (
                      <div key={ev.id} style={{
                        fontSize: large ? 11 : compact ? 6 : 7,
                        fontFamily: "Nunito, sans-serif", fontWeight: 700,
                        color: ev.color, background: `${ev.color}15`,
                        borderRadius: large ? 4 : 3,
                        padding: large ? "2px 5px" : "0px 2px",
                        lineHeight: 1.3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        marginBottom: large ? 2 : 1,
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        {ev.recurring && <Repeat size={large ? 9 : compact ? 5 : 6} style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{large ? ev.title : `${ev.time} ${ev.title}`}</span>
                      </div>
                    ))}
                    {dayEvents.length > (large ? 2 : fill ? 2 : 1) && (
                      <div style={{ fontSize: large ? 10 : 6, color: t.textMuted, textAlign: "center", fontWeight: 700, marginTop: 1 }}>
                        +{dayEvents.length - (large ? 2 : fill ? 2 : 1)} fler
                      </div>
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
// Modal för att skapa ELLER redigera event. Skicka editEvent (objekt) för redigeringsläge.
function AddEventModal({ open, prefillDate, editEvent, persons, onClose, onSave, onUpdate, onDelete }) {
  const isEdit = !!editEvent
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(fmtDate(new Date()))
  const [time, setTime] = useState("12:00")
  const [endTime, setEndTime] = useState("13:00")
  const [personIdx, setPersonIdx] = useState(0)
  const [shared, setShared] = useState(true)
  const [notify, setNotify] = useState(true)
  const [reminderMinutes, setReminderMinutes] = useState(60) // 60 = 1 timme innan
  const [recurrence, setRecurrence] = useState(null)
  const [recurUntil, setRecurUntil] = useState("")

  // Prefilla från editEvent eller prefillDate när modalen öppnas
  useEffect(() => {
    if (!open) return
    if (editEvent) {
      // Redigeringsläge: ladda värden från eventet
      const start = new Date(editEvent.start_time)
      const end = new Date(editEvent.end_time)
      setTitle(editEvent.title || "")
      setDate(fmtDate(start))
      setTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`)
      setEndTime(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`)
      const matchedPerson = persons.findIndex(p => p.user_id === editEvent.created_by)
      setPersonIdx(matchedPerson >= 0 ? matchedPerson : 0)
      setShared(editEvent.shared !== false)
      setReminderMinutes(editEvent.reminder_minutes ?? null)
      setNotify(editEvent.reminder_minutes != null)
      setRecurrence(editEvent.recurrence_rule?.freq || null)
      setRecurUntil(editEvent.recurrence_rule?.until || "")
    } else {
      // Nytt event-läge
      setTitle("")
      setDate(prefillDate ? fmtDate(prefillDate) : fmtDate(new Date()))
      setTime("12:00")
      setEndTime("13:00")
      setPersonIdx(0)
      setShared(true)
      setNotify(true)
      setReminderMinutes(60)
      setRecurrence(null)
      setRecurUntil("")
    }
  }, [open, prefillDate, editEvent, persons])

  if (!open) return null

  function submit() {
    if (!title.trim()) return
    const recurrence_rule = recurrence
      ? (recurUntil ? { freq: recurrence, until: recurUntil } : { freq: recurrence })
      : null
    const payload = {
      title: title.trim(),
      start_time: date + "T" + time + ":00",
      end_time: date + "T" + endTime + ":00",
      location: editEvent?.location || null,
      color: persons[personIdx]?.color || ACCENT.event,
      shared,
      reminder_minutes: notify ? reminderMinutes : null,
      recurrence_rule,
    }
    if (isEdit) {
      // Vid redigering av återkommande: uppdatera master (hela serien)
      const realId = editEvent.master_id || editEvent.id
      onUpdate(realId, payload)
    } else {
      onSave(payload)
    }
    onClose()
  }

  function handleDelete() {
    if (!editEvent) return
    const isRecurring = !!editEvent.master_id || !!editEvent.recurrence_rule
    if (isRecurring && !confirm("Detta är en återkommande händelse. Tar du bort den raderas hela serien. Fortsätta?")) return
    if (!isRecurring && !confirm("Ta bort denna händelse?")) return
    onDelete(editEvent.id)
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
          <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 18, fontWeight: 700, color: t.text }}>
            {isEdit ? "Redigera händelse" : "Ny händelse"}
          </span>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div onClick={() => setNotify(n => !n)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: notify ? ACCENT.calendar : t.textMuted, padding: 2, display: "flex", alignItems: "center" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "transform 0.2s", transform: notify ? "translateX(16px)" : "translateX(0)" }} />
            </div>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: notify ? t.text : t.textSec }}>Påminnelse</span>
          </div>
          {notify && (
            <select
              value={reminderMinutes ?? 60}
              onChange={e => setReminderMinutes(parseInt(e.target.value))}
              style={{ ...inputStyle, fontSize: 13 }}
            >
              <option value={5}>5 min innan</option>
              <option value={15}>15 min innan</option>
              <option value={30}>30 min innan</option>
              <option value={60}>1 timme innan</option>
              <option value={120}>2 timmar innan</option>
              <option value={1440}>1 dag innan</option>
              <option value={2880}>2 dagar innan</option>
            </select>
          )}
          {notify && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: t.textMuted, fontStyle: "italic" }}>
              Sparas på eventet — utgående notiser kommer i framtida version
            </span>
          )}
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

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          {isEdit ? (
            <Btn small outline color="#dc2626" onClick={handleDelete}><Trash2 size={12} /> Ta bort</Btn>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn outline small onClick={onClose}><X size={12} /> Avbryt</Btn>
            <Btn small color={ACCENT.calendar} onClick={submit} disabled={!title.trim()}><Check size={12} /> {isEdit ? "Uppdatera" : "Spara"}</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

// Visar senaste aktivitet i hushållet (vem gjorde vad)
function ActivityFeed({ activity, persons, members, userId, max = 5 }) {
  const items = activity.slice(0, max)
  if (items.length === 0) return null

  function relativeTime(iso) {
    const diff = (new Date() - new Date(iso)) / 1000
    if (diff < 60) return "just nu"
    if (diff < 3600) return `${Math.floor(diff / 60)}m sen`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h sen`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d sen`
    return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
  }
  function getName(itemUserId) {
    if (itemUserId === userId) return "Du"
    const memberIdx = members.findIndex(m => m.user_id === itemUserId)
    return memberIdx >= 0 ? (persons[memberIdx]?.name || "Medlem " + (memberIdx + 1)) : "Någon"
  }
  function getColor(itemUserId) {
    if (itemUserId === userId) return ACCENT.calendar
    const memberIdx = members.findIndex(m => m.user_id === itemUserId)
    return memberIdx >= 0 ? (persons[memberIdx]?.color || PERSON_PALETTE[0]) : t.textMuted
  }

  return (
    <Card>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label color={t.textSec} icon={Users}>Senaste aktivitet</Label>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted }}>{activity.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(a => {
            const name = getName(a.user_id)
            const color = getColor(a.user_id)
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: `${color}15`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 12, fontWeight: 700, color }}>{name[0]}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.text, lineHeight: 1.4 }}>
                    <strong style={{ color, fontWeight: 700 }}>{name}</strong>{" "}
                    <span style={{ color: t.textSec }}>{a.description}</span>
                  </div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                    {relativeTime(a.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// Visar nedräkningar till framtida händelser (semester, födelsedagar, läkartider)
function CountdownsCard({ countdowns, onAdd, onDelete }) {
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [emoji, setEmoji] = useState("")
  const [color, setColor] = useState(ACCENT.calendar)

  // Filtrera bort passerade (mer än 1 dag sen)
  const today = new Date()
  const todayStr = fmtDate(today)
  const upcoming = countdowns.filter(c => c.target_date >= todayStr).slice(0, 5)

  function daysUntil(dateStr) {
    const target = new Date(dateStr + "T00:00:00")
    const diff = Math.floor((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
    return diff
  }

  function submit() {
    if (!title.trim() || !date) return
    onAdd({ title: title.trim(), target_date: date, color, emoji: emoji.trim() || null })
    setTitle(""); setDate(""); setEmoji(""); setColor(ACCENT.calendar); setShowAdd(false)
  }

  if (upcoming.length === 0 && !showAdd) {
    return (
      <Card>
        <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label color={ACCENT.calendar} icon={CalendarDays}>Nedräkningar</Label>
          <Btn small outline onClick={() => setShowAdd(true)}><Plus size={12} /> Lägg till</Btn>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label color={ACCENT.calendar} icon={CalendarDays}>Nedräkningar</Label>
          {!showAdd && <Btn small outline onClick={() => setShowAdd(true)}><Plus size={12} /> Lägg till</Btn>}
        </div>

        {showAdd && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, padding: 10, background: t.inputBg, borderRadius: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 2))} placeholder="🏖️" style={{ ...inputStyle, fontSize: 16, width: 50, textAlign: "center", padding: "8px 4px" }} />
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Vad? T.ex. Mallorca" style={{ ...inputStyle, fontSize: 13, flex: 1 }} autoFocus />
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {LIST_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 24, height: 24, borderRadius: 12, background: c,
                  border: color === c ? `3px solid ${t.text}` : "3px solid transparent",
                  cursor: "pointer", padding: 0,
                }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn small outline onClick={() => { setShowAdd(false); setTitle(""); setDate("") }}><X size={12} /> Avbryt</Btn>
              <Btn small color={ACCENT.calendar} onClick={submit} disabled={!title.trim() || !date}><Check size={12} /> Spara</Btn>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map(c => {
            const days = daysUntil(c.target_date)
            const isToday = days === 0
            const isSoon = days <= 7
            return (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                background: `${c.color}08`, border: `1px solid ${c.color}20`,
              }}>
                {c.emoji && <div style={{ fontSize: 24, flexShrink: 0 }}>{c.emoji}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.text }}>{c.title}</div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                    {new Date(c.target_date + "T00:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                </div>
                <div style={{
                  textAlign: "right",
                  fontFamily: "Comfortaa, sans-serif",
                  flexShrink: 0,
                }}>
                  <div style={{
                    fontSize: isToday ? 18 : 22, fontWeight: 700,
                    color: isToday ? "#dc2626" : isSoon ? c.color : t.text,
                    lineHeight: 1,
                  }}>{isToday ? "Idag!" : days}</div>
                  {!isToday && <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: t.textMuted, marginTop: 2 }}>{days === 1 ? "dag" : "dagar"}</div>}
                </div>
                <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// Notifikationsklocka — visar antal aktiviteter som hänt sen senast användaren tittade.
// "Senast tittat"-tidsstämpel sparas i localStorage per user.
function NotificationBell({ activity, persons, members, userId, onOpenFeed }) {
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(() => {
    if (typeof window === "undefined" || !userId) return new Date().toISOString()
    try {
      return localStorage.getItem("smarthub:lastSeen:" + userId) || new Date(0).toISOString()
    } catch {
      return new Date(0).toISOString()
    }
  })
  // Räkna olästa: aktiviteter efter lastSeen som inte är från användaren själv
  const unseen = useMemo(() => activity.filter(a =>
    a.user_id !== userId && new Date(a.created_at) > new Date(lastSeen)
  ), [activity, lastSeen, userId])

  function markAllRead() {
    const now = new Date().toISOString()
    setLastSeen(now)
    if (typeof window !== "undefined" && userId) {
      try { localStorage.setItem("smarthub:lastSeen:" + userId, now) } catch {}
    }
  }
  function toggle() {
    setOpen(o => {
      const next = !o
      if (next) markAllRead()
      return next
    })
  }
  function getName(itemUserId) {
    if (itemUserId === userId) return "Du"
    const memberIdx = members.findIndex(m => m.user_id === itemUserId)
    return memberIdx >= 0 ? (persons[memberIdx]?.name || "Medlem " + (memberIdx + 1)) : "Någon"
  }
  function getColor(itemUserId) {
    if (itemUserId === userId) return ACCENT.calendar
    const memberIdx = members.findIndex(m => m.user_id === itemUserId)
    return memberIdx >= 0 ? (persons[memberIdx]?.color || PERSON_PALETTE[0]) : t.textMuted
  }
  function relativeTime(iso) {
    const diff = (new Date() - new Date(iso)) / 1000
    if (diff < 60) return "just nu"
    if (diff < 3600) return `${Math.floor(diff / 60)}m sen`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h sen`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d sen`
    return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={toggle} style={{
        position: "relative",
        background: "none", border: "none", cursor: "pointer", padding: 8,
        borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
      }} title="Notifikationer">
        <Bell size={18} color={t.textSec} strokeWidth={2} />
        {unseen.length > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: "#dc2626", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, fontFamily: "Nunito, sans-serif",
            padding: "0 4px",
          }}>{unseen.length > 9 ? "9+" : unseen.length}</span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 250 }} />
          <div style={{
            position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 260,
            width: 320, maxHeight: 400, overflowY: "auto",
            background: t.card, borderRadius: 12, border: `1px solid ${t.cardBorder}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.text }}>Aktivitet</span>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted }}>{activity.length}</span>
            </div>
            {activity.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: t.textMuted, fontSize: 12, fontFamily: "Nunito, sans-serif" }}>Inget att visa än</div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activity.slice(0, 30).map(a => {
                const name = getName(a.user_id)
                const color = getColor(a.user_id)
                const isUnseen = a.user_id !== userId && new Date(a.created_at) > new Date(lastSeen)
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 14px",
                    borderBottom: `1px solid ${t.line}`,
                    background: isUnseen ? `${ACCENT.calendar}05` : "transparent",
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 12,
                      background: `${color}15`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 11, fontWeight: 700, color }}>{name[0]}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.text, lineHeight: 1.4 }}>
                        <strong style={{ color, fontWeight: 700 }}>{name}</strong>{" "}
                        <span style={{ color: t.textSec }}>{a.description}</span>
                      </div>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                        {relativeTime(a.created_at)}
                      </div>
                    </div>
                    {isUnseen && <div style={{ width: 6, height: 6, borderRadius: 3, background: ACCENT.calendar, marginTop: 6, flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Modal som visar alla händelser för en specifik dag, med möjlighet att lägga till ny.
function DayModal({ open, date, events, persons, onClose, onAddEvent, onEditEvent, onDeleteEvent }) {
  if (!open || !date) return null
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
  const dayEvents = expandEvents(events, dayStart, dayEnd).sort((a, b) =>
    new Date(a.start_time) - new Date(b.start_time)
  )
  const dateStr = date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })
  const isToday = (() => {
    const now = new Date()
    return now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth() && now.getDate() === date.getDate()
  })()

  function handleDelete(ev) {
    const isRecurring = !!ev.master_id || !!ev.recurrence_rule
    if (isRecurring) {
      if (!confirm("Detta är en återkommande händelse. Tar du bort den raderas hela serien. Fortsätta?")) return
    }
    onDeleteEvent(ev.id)
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 290,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.card, borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 560,
        maxHeight: "80vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
      }}>
        <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.line}` }}>
          <div>
            <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 18, fontWeight: 700, color: t.text, textTransform: "capitalize" }}>{dateStr}</div>
            {isToday && <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: ACCENT.calendar, fontWeight: 700, marginTop: 2 }}>Idag</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={t.textSec} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {dayEvents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.textMuted }}>
              Inga händelser den här dagen
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayEvents.map(ev => {
                const p = getPersonForEvent(ev, persons)
                const isRecurring = !!ev.master_id || !!ev.recurrence_rule
                return (
                  <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: `${p.color}08`, borderRadius: 10, border: `1px solid ${p.color}15` }}>
                    <div style={{ width: 4, height: 36, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, cursor: onEditEvent ? "pointer" : "default" }} onClick={() => onEditEvent && onEditEvent(ev)}>
                      <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                        {fmtTime(ev.start_time)}
                        {ev.end_time && ev.end_time !== ev.start_time && ` – ${fmtTime(ev.end_time)}`}
                        {isRecurring && <Repeat size={10} color={t.textMuted} />}
                        {ev.reminder_minutes != null && <span title="Påminnelse satt" style={{ fontSize: 10 }}>🔔</span>}
                      </div>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: t.text, fontWeight: 600 }}>{ev.title}</div>
                      {p.name && <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: p.color, fontWeight: 700, marginTop: 2 }}>{p.name}</div>}
                      {ev.location && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}><MapPin size={10} /> {ev.location}</div>}
                    </div>
                    {onEditEvent && (
                      <button onClick={() => onEditEvent(ev)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }} title="Redigera">
                        <Edit3 size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(ev)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }} title="Ta bort">
                      <X size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px 20px", borderTop: `1px solid ${t.line}` }}>
          <Btn color={ACCENT.calendar} onClick={() => onAddEvent(date)} style={{ width: "100%", justifyContent: "center", padding: "12px 14px" }}>
            <Plus size={14} /> Ny händelse
          </Btn>
        </div>
      </div>
    </div>
  )
}

// Hem-kalender med toggle: månad eller vecka
function HomeCalendar({ events, persons, onDayClick, isMobile }) {
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "month"
    return localStorage.getItem("smarthub:homeCalView") || "month"
  })
  function changeView(v) {
    setView(v)
    if (typeof window !== "undefined") {
      try { localStorage.setItem("smarthub:homeCalView", v) } catch {}
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 4, padding: 3, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 10, width: "fit-content", alignSelf: "flex-end" }}>
        {[{ id: "month", label: "Månad" }, { id: "week", label: "Vecka" }].map(opt => {
          const active = view === opt.id
          return (
            <button key={opt.id} onClick={() => changeView(opt.id)} style={{
              padding: "4px 12px", borderRadius: 7, border: "none",
              background: active ? t.card : "transparent",
              color: active ? t.text : t.textSec,
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700,
              cursor: "pointer", transition: "all 0.15s",
            }}>{opt.label}</button>
          )
        })}
      </div>
      {view === "month" ? (
        <CalendarWidget events={events} persons={persons} onDayClick={onDayClick} large={isMobile} />
      ) : (
        <WeekCalendarView events={events} persons={persons} onDayClick={onDayClick} />
      )}
    </div>
  )
}

// Vecko-vy: 7 dagar i rad med events listade per dag
function WeekCalendarView({ events, persons, onDayClick }) {
  const [weekOffset, setWeekOffset] = useState(0) // 0 = denna vecka, +1 = nästa, -1 = förra
  const today = new Date()
  // Måndag denna vecka
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + 1 + weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    return d
  })
  const weekStart = days[0]
  const weekEnd = new Date(days[6].getFullYear(), days[6].getMonth(), days[6].getDate(), 23, 59, 59)
  const expandedEvents = useMemo(
    () => expandEvents(events, weekStart, weekEnd).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [events, weekStart.getTime(), weekEnd.getTime()]
  )
  const eventsByDay = useMemo(() => {
    const map = {}
    expandedEvents.forEach(ev => {
      const d = new Date(ev.start_time)
      const key = fmtDate(d)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    })
    return map
  }, [expandedEvents])

  const weekNum = (() => {
    // ISO veckonummer
    const d = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  })()

  const isCurrentWeek = weekOffset === 0

  return (
    <Card accent={ACCENT.calendar}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Label color={ACCENT.calendar} icon={CalendarDays}>Vecka {weekNum}</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.textMuted }}>
              <ChevronLeft size={16} />
            </button>
            {!isCurrentWeek && (
              <button onClick={() => setWeekOffset(0)} style={{
                background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 6,
                padding: "2px 8px", cursor: "pointer", fontFamily: "Nunito, sans-serif",
                fontSize: 11, fontWeight: 700, color: t.textSec,
              }}>Idag</button>
            )}
            <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.textMuted }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {days.map((d, i) => {
            const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
            const dayEvents = eventsByDay[fmtDate(d)] || []
            const holiday = getHolidayForDate(d)
            return (
              <div key={i}
                onClick={() => onDayClick && onDayClick(d)}
                style={{
                  display: "flex", gap: 12, padding: "10px 12px",
                  background: isToday ? `${ACCENT.calendar}08` : "transparent",
                  border: isToday ? `1.5px solid ${ACCENT.calendar}30` : `1px solid ${t.line}`,
                  borderRadius: 10, cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = `${ACCENT.calendar}05` }}
                onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = "transparent" }}
              >
                <div style={{ width: 50, flexShrink: 0, textAlign: "center" }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>{DAYS_SHORT[i]}</div>
                  <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 22, fontWeight: 700, color: holiday?.redday ? "#dc2626" : isToday ? ACCENT.calendar : t.text, lineHeight: 1, marginTop: 2 }}>
                    {d.getDate()}
                  </div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 9, color: t.textMuted, marginTop: 2 }}>
                    {MONTHS_SHORT[d.getMonth()]}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {holiday && (
                    <div style={{
                      fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700,
                      color: holiday.color, background: `${holiday.color}12`,
                      padding: "3px 8px", borderRadius: 6, alignSelf: "flex-start",
                    }}>{holiday.name}</div>
                  )}
                  {dayEvents.length === 0 && !holiday && (
                    <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>Inget inplanerat</span>
                  )}
                  {dayEvents.map(ev => {
                    const p = getPersonForEvent(ev, persons)
                    const isRecurring = !!ev.master_id || !!ev.recurrence_rule
                    return (
                      <div key={ev.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "5px 10px", borderRadius: 7,
                        background: `${p.color}08`, border: `1px solid ${p.color}15`,
                      }}>
                        <div style={{ width: 3, height: 22, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 11, color: t.textMuted, flexShrink: 0 }}>{fmtTime(ev.start_time)}</span>
                        <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.text, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                        {isRecurring && <Repeat size={11} color={t.textMuted} style={{ flexShrink: 0 }} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function CalendarTab({ isMobile, events, persons, onAddEvent, onDeleteEvent, onOpenAddEvent, onOpenDayModal, userId }) {
  const [view, setView] = useState("month") // "month" | "week"

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: isMobile ? 22 : 24, fontWeight: 700, color: t.text, margin: 0 }}>Kalender</h2>
        <Btn onClick={() => onOpenAddEvent(new Date())}><Plus size={14} /> Ny händelse</Btn>
      </div>

      {/* View toggle: Månad / Vecka */}
      <div style={{ display: "flex", gap: 4, padding: 3, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 10, marginBottom: 16, width: "fit-content" }}>
        {[{ id: "month", label: "Månad" }, { id: "week", label: "Vecka" }].map(opt => {
          const active = view === opt.id
          return (
            <button key={opt.id} onClick={() => setView(opt.id)} style={{
              padding: "6px 14px", borderRadius: 7, border: "none",
              background: active ? t.card : "transparent",
              color: active ? t.text : t.textSec,
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700,
              cursor: "pointer", transition: "all 0.15s",
            }}>{opt.label}</button>
          )
        })}
      </div>

      {view === "month" ? (
        <CalendarWidget
          events={events}
          persons={persons}
          onDayClick={d => onOpenDayModal(d)}
          large={isMobile}
        />
      ) : (
        <WeekCalendarView
          events={events}
          persons={persons}
          onDayClick={d => onOpenDayModal(d)}
        />
      )}

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
function TodoCard({ pinnedList, onToggle, fill, maxHeight }) {
  const list = pinnedList || { id: null, name: "Att göra", color: ACCENT.todo, items: [] }
  const items = list.items || []
  const activeItems = items.filter(i => !i.done)
  const doneItems = items.filter(i => i.done)
  const [showDone, setShowDone] = useState(false)
  const listColor = list.color || ACCENT.todo
  // Hem-vy: cap höjd + scroll. TV (fill): följer flex-parent + scroll inuti.
  const listContainerStyle = fill
    ? { display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", minHeight: 0 }
    : { display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", maxHeight: maxHeight || 280 }
  return (
    <Card accent={listColor} style={fill ? { flex: 1, minHeight: 0 } : {}}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label color={listColor} icon={ListChecks}>{list.name}</Label>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>{doneItems.length}/{items.length}</span>
        </div>
        <div style={listContainerStyle}>
          {items.length === 0 && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>Inga uppgifter</span>
          )}
          {activeItems.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }} onClick={() => onToggle(item)}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                border: `2px solid ${t.textMuted}`,
                background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }} />
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500, color: t.text }}>{item.text}</span>
            </div>
          ))}
          {/* Bockat-sektion (kollapsbar) */}
          {doneItems.length > 0 && (
            <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 8, marginTop: 4, flexShrink: 0 }}>
              <div onClick={() => setShowDone(s => !s)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", padding: "2px 0",
                fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textSec,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Check size={11} color={listColor} />
                  Bockat ({doneItems.length})
                </span>
                <ChevronRight size={11} color={t.textMuted} style={{ transform: showDone ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </div>
              {showDone && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {doneItems.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }} onClick={() => onToggle(item)}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: listColor, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}><Check size={12} color="#fff" strokeWidth={3} /></div>
                      <span style={{
                        fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500,
                        color: t.textMuted, textDecoration: "line-through",
                      }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function ListItem({ item, listColor, onToggle, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div onClick={onToggle} style={{
        width: 20, height: 20, borderRadius: 6, cursor: "pointer", flexShrink: 0,
        border: item.done ? "none" : `2px solid ${t.textMuted}`,
        background: item.done ? listColor : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{item.done && <Check size={12} color="#fff" strokeWidth={3} />}</div>
      <span onClick={onToggle} style={{
        flex: 1, cursor: "pointer",
        fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500,
        color: item.done ? t.textMuted : t.text,
        textDecoration: item.done ? "line-through" : "none",
      }}>{item.text}</span>
      <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 2 }}>
        <X size={12} />
      </button>
    </div>
  )
}

function CheckedSection({ doneItems, listColor, onToggle, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 10, marginTop: 6 }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer", padding: "4px 0",
        fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Check size={12} color={listColor} />
          Bockat ({doneItems.length})
        </span>
        {open ? <ChevronLeft size={12} color={t.textMuted} style={{ transform: "rotate(90deg)" }} /> : <ChevronRight size={12} color={t.textMuted} style={{ transform: "rotate(90deg)" }} />}
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {doneItems.map(item => (
            <ListItem key={item.id} item={item} listColor={listColor}
              onToggle={() => onToggle(item)} onDelete={() => onDelete(item)} />
          ))}
        </div>
      )}
    </div>
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
            {expanded && (() => {
              const activeItems = items.filter(i => !i.done)
              const doneItems = items.filter(i => i.done)
              return (
                <div style={{ padding: "0 16px 14px" }}>
                  {/* Aktiva items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {activeItems.map(item => (
                      <ListItem key={item.id} item={item} listColor={list.color}
                        onToggle={() => onToggleItem(item)} onDelete={() => onDeleteTodo(item)} />
                    ))}
                    {activeItems.length === 0 && (
                      <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, fontStyle: "italic", padding: "4px 0" }}>Inga aktiva uppgifter</span>
                    )}
                  </div>

                  {/* Lägg till-fält */}
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

                  {/* Bockat-sektion (kollapsbar) */}
                  {doneItems.length > 0 && (
                    <CheckedSection
                      doneItems={doneItems}
                      listColor={list.color}
                      onToggle={onToggleItem}
                      onDelete={onDeleteTodo}
                    />
                  )}

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
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
              )
            })()}
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

// Hjälpare: ISO veckonummer för ett datum
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

// Mathistorik — bläddra bakåt i tiden vecka för vecka
function MealHistory({ householdId, currentWeekStart }) {
  const [weekOffset, setWeekOffset] = useState(-1) // -1 = förra veckan
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(false)

  // Räkna fram week_start_date för aktuellt offset
  const weekStart = useMemo(() => {
    const cur = new Date(currentWeekStart + "T00:00:00")
    const d = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + weekOffset * 7)
    return fmtDate(d)
  }, [currentWeekStart, weekOffset])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    setLoading(true)
    supabase.from("meals").select("*").eq("household_id", householdId).eq("week_start_date", weekStart)
      .then(({ data }) => {
        if (cancelled) return
        setMeals(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [householdId, weekStart])

  const weekStartDate = new Date(weekStart + "T00:00:00")
  const weekEndDate = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + 6)
  const weekLabel = `${weekStartDate.getDate()} ${MONTHS_SHORT[weekStartDate.getMonth()]} – ${weekEndDate.getDate()} ${MONTHS_SHORT[weekEndDate.getMonth()]}`
  const weekNum = isoWeekNumber(weekStartDate)
  const mealsByDay = {}
  meals.forEach(m => { mealsByDay[m.weekday] = m })

  return (
    <Card>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label color={t.textSec} icon={UtensilsCrossed}>Mathistorik</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: t.textMuted }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.text, minWidth: 100, textAlign: "center" }}>
              Vecka {weekNum}
            </span>
            <button onClick={() => setWeekOffset(o => Math.min(o + 1, -1))} disabled={weekOffset >= -1} style={{
              background: "none", border: "none", cursor: weekOffset >= -1 ? "default" : "pointer",
              padding: 4, color: weekOffset >= -1 ? t.textMuted : t.textSec, opacity: weekOffset >= -1 ? 0.3 : 1,
            }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, marginBottom: 8 }}>
          {weekLabel}
        </div>

        {loading ? (
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, textAlign: "center", padding: "10px 0" }}>Laddar...</div>
        ) : meals.length === 0 ? (
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>
            Ingen matsedel sparad för denna vecka
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {DAYS.map((day, i) => {
              const wd = i + 1
              const meal = mealsByDay[wd]
              const tag = meal?.tag ? MEAL_TAGS.find(tg => tg.id === meal.tag) : null
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 6 }}>
                  <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, minWidth: 70 }}>{day}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
                    {tag && <span style={{ fontSize: 10, fontWeight: 700, color: tag.color, background: `${tag.color}15`, padding: "1px 7px", borderRadius: 6, flexShrink: 0 }}>{tag.icon} {tag.label}</span>}
                    <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: meal?.meal_text ? t.text : t.textMuted, fontStyle: meal?.meal_text ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {meal?.meal_text || "—"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

function MealTab({ isMobile, mealsByWeekday, mealTagsLocal, onSetMealText, onSetMealTag, foodPrefs, setFoodPrefs, onAiGenerate, householdId, currentWeekStart }) {
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

      <div style={{ marginTop: 12 }}>
        <MealHistory householdId={householdId} currentWeekStart={currentWeekStart} />
      </div>
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

function InviteShareBox({ inviteCode, householdName, onReset, onCopy, copied }) {
  // Konstruera en delningslänk som inkluderar koden — appen kan läsa ?invite= vid signup
  const baseUrl = (typeof window !== "undefined" && window.location.origin) || "https://smarthub-sigma.vercel.app"
  const inviteUrl = `${baseUrl}/?invite=${inviteCode}`
  const messageBody = `Hej! Jag har bjudit in dig till hushållet "${householdName || "vårt hushåll"}" i SmartHub.\n\nÖppna länken och registrera dig:\n${inviteUrl}\n\nEller använd inbjudningskoden manuellt: ${inviteCode}`

  function shareViaEmail() {
    const subject = encodeURIComponent(`Inbjudan till SmartHub${householdName ? ` — ${householdName}` : ""}`)
    const body = encodeURIComponent(messageBody)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }
  function shareViaSms() {
    const body = encodeURIComponent(messageBody)
    window.location.href = `sms:?&body=${body}`
  }
  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Inbjudan till SmartHub`,
          text: messageBody,
          url: inviteUrl,
        })
      } catch {} // användaren avbröt
    } else {
      await navigator.clipboard.writeText(messageBody)
    }
  }
  function copyLink() {
    navigator.clipboard.writeText(inviteUrl)
  }
  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 12px", background: `${ACCENT.calendar}06`, border: `1px solid ${ACCENT.calendar}15`, borderRadius: 12 }}>
        <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textSec, textTransform: "uppercase", letterSpacing: "0.08em" }}>Inbjudningskod</span>
        <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 32, fontWeight: 700, color: ACCENT.calendar, letterSpacing: "0.15em" }}>
          {inviteCode}
        </div>
        <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, textAlign: "center" }}>
          Giltig tills den används · Eller använd länken nedan
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 10, alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {inviteUrl}
        </span>
        <Btn small outline onClick={copyLink}><Copy size={12} /> Kopiera länk</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn small color={ACCENT.calendar} onClick={shareViaEmail}>📧 Mejla</Btn>
        <Btn small outline color={ACCENT.calendar} onClick={shareViaSms}>💬 SMS</Btn>
        {hasNativeShare && (
          <Btn small outline color={ACCENT.calendar} onClick={shareNative}>📤 Dela</Btn>
        )}
        <Btn small outline onClick={onCopy}><Copy size={12} /> {copied ? "Kod kopierad!" : "Bara koden"}</Btn>
        <button onClick={onReset} style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "4px 8px" }}>
          Skapa ny kod
        </button>
      </div>

      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, lineHeight: 1.5, padding: "8px 0", borderTop: `1px solid ${t.line}` }}>
        <strong style={{ color: t.textSec }}>Hur det funkar:</strong> Personen klickar på länken (eller går till appen och anger koden manuellt). Hen registrerar sig med sin egen mejl, sen kopplas hen automatiskt till hushållet.
      </div>
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
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec, marginBottom: 6 }}>Bjud in till hushållet</div>
          {!inviteCode ? (
            <>
              <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: t.textMuted, margin: "0 0 12px" }}>
                Skapa en kod som personen anger när hen registrerar sig. Eller skicka inbjudan via mejl/SMS.
              </p>
              <Btn onClick={create} disabled={creating}>{creating ? "Skapar..." : "Skapa inbjudningskod"}</Btn>
            </>
          ) : (
            <InviteShareBox
              inviteCode={inviteCode}
              householdName={household?.name}
              onReset={() => setInviteCode(null)}
              onCopy={copy}
              copied={copied}
            />
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

function TvEditorSection({ onBack, isMobile, tvData, tvSlots, onSaveTvSlots, tvPhotoUrl, onSaveTvPhoto }) {
  const [slots, setSlots] = useState(() => ({ ...DEFAULT_TV_SLOTS, ...(tvSlots || {}) }))
  const [pickerOpen, setPickerOpen] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [photoInput, setPhotoInput] = useState(tvPhotoUrl || "")
  const scale = isMobile ? 0.45 : 0.55

  useEffect(() => { setPhotoInput(tvPhotoUrl || "") }, [tvPhotoUrl])

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

      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 14 }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 }}>📸 Foto-header på TV:n</div>
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, margin: "0 0 10px" }}>
            Klistra in en bild-URL — visas som banner högst upp på TV:n. Bra för familjebild, semesterminne eller stämningsbild.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={photoInput} onChange={e => setPhotoInput(e.target.value)} placeholder="https://exempel.com/familjebild.jpg" style={{ ...inputStyle, fontSize: 13, flex: 1, minWidth: 200 }} />
            <Btn small color={ACCENT.calendar} onClick={() => onSaveTvPhoto(photoInput.trim() || null)}>
              <Check size={12} /> Spara
            </Btn>
            {tvPhotoUrl && (
              <Btn small outline color="#dc2626" onClick={() => { setPhotoInput(""); onSaveTvPhoto(null) }}>
                <X size={12} /> Ta bort
              </Btn>
            )}
          </div>
          {tvPhotoUrl && (
            <div style={{ marginTop: 10, height: 60, borderRadius: 8, backgroundImage: `url("${tvPhotoUrl}")`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${t.cardBorder}` }} />
          )}
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, margin: "8px 0 0" }}>
            <strong>Tips:</strong> Ladda upp till imgur.com eller liknande och klistra in direktlänken till bilden (.jpg/.png).
          </p>
        </div>
      </Card>

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

function SettingsTab({ isMobile, session, household, members, foodPrefs, setFoodPrefs, onCreateInvite, tvData, tvSlots, onSaveTvSlots, tvPhotoUrl, onSaveTvPhoto, userId }) {
  const [activeSection, setActiveSection] = useState(null)
  const sections = [
    { id: "profile", icon: User, label: "Profil", desc: "Namn, profilbild" },
    { id: "tv", icon: Monitor, label: "TV-editor", desc: "Anpassa TV-vyn, widgets & layout" },
    { id: "household", icon: Users, label: "Hushåll & Medlemmar", desc: "Invite-kod, medlemmar" },
    { id: "food", icon: UtensilsCrossed, label: "Matpreferenser", desc: "Gillar, gillar inte, budget" },
    { id: "account", icon: LogOut, label: "Konto", desc: "Logga ut" },
  ]
  if (activeSection === "tv") return <TvEditorSection onBack={() => setActiveSection(null)} isMobile={isMobile} tvData={tvData} tvSlots={tvSlots} onSaveTvSlots={onSaveTvSlots} tvPhotoUrl={tvPhotoUrl} onSaveTvPhoto={onSaveTvPhoto} />
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
            <div onClick={() => setActiveSection(s.id)} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ACCENT.calendar}08`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <s.icon size={18} color={ACCENT.calendar} />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>{s.label}</div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>{s.desc}</div>
              </div>
              <ChevronRight size={18} color={t.textMuted} style={{ flexShrink: 0 }} />
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
function AiChat({ position = "fixed", callAi, executeTool }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hej! Jag kan göra grejer i appen åt dig. Prova:\n• \"Lägg till mjölk på handlingslistan\"\n• \"Boka tandläkare imorgon kl 10\"\n• \"Bocka av äggen\"\n• \"Generera ny veckomeny\"\n• \"Vad äter vi på fredag?\"" },
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
      // Steg 1: skicka till AI
      const data = await callAi(text, null)
      const { reply, tool_calls, assistant_message } = data || {}

      // Visa AI:s eventuella text-svar
      if (reply) {
        setMessages(p => [...p, { role: "ai", text: reply }])
      }

      // Exekvera tool calls om några finns
      if (tool_calls && tool_calls.length > 0) {
        const toolResults = []
        for (const tc of tool_calls) {
          const result = await executeTool(tc.name, tc.arguments)
          toolResults.push({ tool_call_id: tc.id, ...result })
          // Lägg till resultatet som en chat-rad
          setMessages(p => [...p, {
            role: "tool",
            text: (result.ok ? "✓ " : "✗ ") + result.message,
            ok: result.ok,
          }])
        }

        // Steg 2: Skicka tillbaka resultaten så AI:n kan ge en naturlig sammanfattning
        const previous = [
          { role: "user", content: text },
          assistant_message,
          ...toolResults.map(r => ({
            role: "tool",
            tool_call_id: r.tool_call_id,
            content: r.ok ? r.message : ("Misslyckades: " + r.message),
          })),
        ]
        try {
          const followup = await callAi("", previous)
          if (followup?.reply) {
            setMessages(p => [...p, { role: "ai", text: followup.reply }])
          }
        } catch {} // tyst-fail på follow-up
      } else if (!reply) {
        setMessages(p => [...p, { role: "ai", text: "(tomt svar)" }])
      }
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
        {messages.map((msg, i) => {
          if (msg.role === "tool") {
            return (
              <div key={i} style={{
                alignSelf: "center",
                padding: "4px 10px", borderRadius: 8,
                background: msg.ok ? `${ACCENT.todo}10` : "#dc262610",
                color: msg.ok ? ACCENT.todo : "#dc2626",
                fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 600,
                border: msg.ok ? `1px solid ${ACCENT.todo}25` : "1px solid #dc262625",
              }}>{msg.text}</div>
            )
          }
          return (
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
          )
        })}
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
  calEvents, persons, onAddEvent, onDeleteEvent, onOpenAddEvent, onOpenDayModal, userId,
  // meals
  mealsByWeekday, mealTagsLocal, onSetMealText, onSetMealTag,
  foodPrefs, setFoodPrefs, onAiGenerate,
  // settings
  session, household, members, onCreateInvite, tvData, tvSlots, onSaveTvSlots,
  tvPhotoUrl, onSaveTvPhoto,
  // activity + countdowns + meal history
  activity, countdowns, onAddCountdown, onDeleteCountdown,
  householdIdProp, currentWeekStart,
}) {
  const pad = isMobile ? "16px 16px 16px" : "24px 28px"
  if (tab === "hem") {
    return (
      <div style={{ padding: isMobile ? "20px 16px 16px" : "24px 28px" }}>
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <ClockDisplay size="small" />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <WeatherMini weather={weather} />
              <NotificationBell activity={activity} persons={persons} members={members} userId={userId} />
            </div>
          </div>
        )}
        {!isMobile && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>Hem</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <WeatherMini weather={weather} />
              <NotificationBell activity={activity} persons={persons} members={members} userId={userId} />
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <HomeCalendar
            events={calEvents}
            persons={persons}
            onDayClick={d => onOpenDayModal(d)}
            isMobile={isMobile}
          />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <TodoCard pinnedList={pinnedList} onToggle={onToggleItem} />
            <MealCard mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal} onSetMealText={onSetMealText} onSetMealTag={onSetMealTag} />
          </div>
          <CountdownsCard countdowns={countdowns} onAdd={onAddCountdown} onDelete={onDeleteCountdown} />
          <ActivityFeed activity={activity} persons={persons} members={members} userId={userId} max={5} />
        </div>
      </div>
    )
  }
  if (tab === "kalender") return <div style={{ padding: pad }}><CalendarTab isMobile={isMobile} events={calEvents} persons={persons} onAddEvent={onAddEvent} onDeleteEvent={onDeleteEvent} onOpenAddEvent={onOpenAddEvent} onOpenDayModal={onOpenDayModal} userId={userId} /></div>
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
  if (tab === "mat") return <div style={{ padding: pad }}><MealTab isMobile={isMobile} mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal} onSetMealText={onSetMealText} onSetMealTag={onSetMealTag} foodPrefs={foodPrefs} setFoodPrefs={setFoodPrefs} onAiGenerate={onAiGenerate} householdId={householdIdProp} currentWeekStart={currentWeekStart} /></div>
  if (tab === "mer") return (
    <div style={{ padding: pad }}>
      <SettingsTab isMobile={isMobile} session={session} household={household} members={members}
        foodPrefs={foodPrefs} setFoodPrefs={setFoodPrefs}
        onCreateInvite={onCreateInvite}
        tvData={tvData} tvSlots={tvSlots} onSaveTvSlots={onSaveTvSlots}
        tvPhotoUrl={tvPhotoUrl} onSaveTvPhoto={onSaveTvPhoto}
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
  if (type === "calendar") return <CalendarWidget events={p.calEvents} persons={p.persons} fill onDayClick={p.onDayClick} />
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
function TvViewContent({ persons, calEvents, pinnedList, onToggleItem, mealsByWeekday, mealTagsLocal, weather, slots, slotOverlay, onDayClick, photoUrl }) {
  const s = { ...DEFAULT_TV_SLOTS, ...(slots || {}) }
  const widgetProps = { persons, calEvents, pinnedList, onToggleItem, mealsByWeekday, mealTagsLocal, onDayClick }
  return (
    <div style={{
      width: "100%", height: "100%",
      background: t.bg, fontFamily: "Nunito, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      boxSizing: "border-box",
    }}>
      {photoUrl && (
        <div style={{
          width: "100%", height: 100, flexShrink: 0,
          backgroundImage: `url("${photoUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(240,242,245,0.85) 100%)",
          }} />
        </div>
      )}
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

// Bestämmer om det är "natt" — dimmar TV-skärmen mellan 20:00 och 07:00
function useIsNightTime() {
  const [isNight, setIsNight] = useState(() => {
    const h = new Date().getHours()
    return h >= 20 || h < 7
  })
  useEffect(() => {
    const i = setInterval(() => {
      const h = new Date().getHours()
      setIsNight(h >= 20 || h < 7)
    }, 60000) // kollar varje minut
    return () => clearInterval(i)
  }, [])
  return isNight
}

// Riktig TV-vy (visas på 1080x1920-skärm via zoom:2 på 540x960 logiskt).
function TvLayout(props) {
  const isNight = useIsNightTime()
  return (
    <div style={{
      width: 540, height: 960,
      position: "fixed", top: 0, left: 0, overflow: "hidden",
      zoom: 2, transformOrigin: "top left",
      filter: isNight ? "brightness(0.45) contrast(0.95)" : "none",
      transition: "filter 0.6s ease",
    }}>
      <style>{"html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important}"}</style>
      <TvViewContent {...props} />
      {isNight && (
        <div style={{
          position: "absolute", top: 8, right: 8, zIndex: 50,
          background: "rgba(0,0,0,0.3)", borderRadius: 8,
          padding: "2px 8px", display: "flex", alignItems: "center", gap: 4,
          color: "rgba(255,255,255,0.5)", fontFamily: "Nunito, sans-serif",
          fontSize: 9, fontWeight: 700,
        }}>🌙 Nattläge</div>
      )}
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
  const [tvPhotoUrl, setTvPhotoUrl] = useState(null)
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([]) // senaste aktiviteter i hushållet
  const [countdowns, setCountdowns] = useState([])
  const [weather, setWeather] = useState(null)

  // ── v11 stub state (no Supabase persistence yet — see MIGRATIONS.sql) ──
  // ── Event-modal: hanterar både skapa och redigera ──
  const [eventModal, setEventModal] = useState({ open: false, date: null, editEvent: null })
  function openAddEvent(date) { setEventModal({ open: true, date, editEvent: null }) }
  function openEditEvent(ev) { setEventModal({ open: true, date: null, editEvent: ev }) }
  function closeAddEvent() { setEventModal({ open: false, date: null, editEvent: null }) }

  // Day-modal: visar dagens events + knapp för att lägga till ny
  const [dayModal, setDayModal] = useState({ open: false, date: null })
  function openDayModal(date) { setDayModal({ open: true, date }) }
  function closeDayModal() { setDayModal({ open: false, date: null }) }

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
      let data = null
      const r1 = await supabase.from("tv_layouts").select("widgets,slots,photo_url").eq("household_id", householdId).maybeSingle()
      if (!r1.error) {
        data = r1.data
      } else {
        const r2 = await supabase.from("tv_layouts").select("widgets").eq("household_id", householdId).maybeSingle()
        if (!r2.error) data = r2.data
      }
      if (cancelled) return
      if (data?.widgets) setTvWidgets(data.widgets)
      if (data?.photo_url !== undefined) setTvPhotoUrl(data.photo_url)
      if (data?.slots) {
        setTvSlots(data.slots)
      } else if (typeof window !== "undefined") {
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
      if (p.new && "photo_url" in p.new) setTvPhotoUrl(p.new.photo_url)
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

  // ── Load + subscribe: countdowns ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase.from("countdowns")
        .select("*").eq("household_id", householdId)
        .order("target_date", { ascending: true })
      if (!cancelled && data) setCountdowns(data)
    }
    load()
    const ch = supabase.channel("countdowns:" + householdId).on("postgres_changes", {
      event: "*", schema: "public", table: "countdowns", filter: "household_id=eq." + householdId,
    }, p => {
      setCountdowns(prev => {
        if (p.eventType === "INSERT") return prev.some(c => c.id === p.new.id) ? prev : [...prev, p.new].sort((a, b) => a.target_date.localeCompare(b.target_date))
        if (p.eventType === "UPDATE") return prev.map(c => c.id === p.new.id ? p.new : c)
        if (p.eventType === "DELETE") return prev.filter(c => c.id !== p.old.id)
        return prev
      })
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId])

  // ── Load + subscribe: activity_log ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase.from("activity_log")
        .select("*").eq("household_id", householdId)
        .order("created_at", { ascending: false }).limit(50)
      if (!cancelled && data) setActivity(data)
    }
    load()
    const ch = supabase.channel("activity:" + householdId).on("postgres_changes", {
      event: "INSERT", schema: "public", table: "activity_log", filter: "household_id=eq." + householdId,
    }, p => {
      setActivity(prev => prev.some(a => a.id === p.new.id) ? prev : [p.new, ...prev].slice(0, 50))
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId])

  // Logga aktivitet (fire-and-forget)
  function logActivity(action, entityType, entityId, description) {
    if (!householdId || !userId) return
    supabase.from("activity_log").insert({
      household_id: householdId, user_id: userId,
      action, entity_type: entityType, entity_id: String(entityId || ""),
      description,
    }).then(({ error }) => { if (error) console.warn("[activity]", error.message) })
  }

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
    else if (nd) logActivity("complete_todo", "todo", item.id, `bockade av "${item.text}"`)
  }
  async function handleAddTodo(text, listId) {
    const tmp = { id: "tmp-" + Date.now(), household_id: householdId, text, done: false, list_id: listId, shared: true, created_by: userId, created_at: new Date().toISOString() }
    setTodos(p => [...p, tmp])
    const { data, error } = await supabase.from("todos").insert({ household_id: householdId, text, done: false, list_id: listId, created_by: userId }).select().single()
    if (error) setTodos(p => p.filter(td => td.id !== tmp.id))
    else {
      setTodos(p => p.map(td => td.id === tmp.id ? data : td))
      const list = lists.find(l => l.id === listId)
      logActivity("add_todo", "todo", data.id, `lade till "${text}"${list ? ` på ${list.name}` : ""}`)
    }
  }
  async function handleDeleteTodo(item) {
    setTodos(p => p.filter(td => td.id !== item.id))
    await supabase.from("todos").delete().eq("id", item.id)
  }
  async function handleAddList(list) {
    const { data, error } = await supabase.from("lists").insert({
      household_id: householdId, name: list.name, shared: list.shared,
      color: list.color, expires_at: list.expires_at, created_by: userId,
    }).select().single()
    if (!error && data) logActivity("add_list", "list", data.id, `skapade listan "${list.name}"`)
  }
  async function handleDeleteList(id) {
    setLists(p => p.filter(l => l.id !== id))
    await supabase.from("lists").delete().eq("id", id)
  }
  // Arkivera = soft-delete: listan göms från huvudvyn men finns kvar i Arkiv.
  async function handleArchiveList(id) {
    const list = lists.find(l => l.id === id)
    const now = new Date().toISOString()
    setLists(p => p.map(l => l.id === id ? { ...l, archived: true, archived_at: now } : l))
    await supabase.from("lists").update({ archived: true, archived_at: now }).eq("id", id)
    if (list) logActivity("archive_list", "list", id, `arkiverade "${list.name}"`)
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
    const { data, error } = await supabase.from("calendar_events").insert({
      household_id: householdId, title: ev.title,
      start_time: ev.start_time, end_time: ev.end_time,
      location: ev.location, color: ev.color, shared: ev.shared,
      recurrence_rule: ev.recurrence_rule || null,
      reminder_minutes: ev.reminder_minutes ?? null,
      created_by: userId,
    }).select().single()
    if (!error && data) {
      const dateStr = new Date(ev.start_time).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
      logActivity("add_event", "event", data.id, `lade till "${ev.title}" ${dateStr}${ev.recurrence_rule ? " (återkommande)" : ""}`)
    }
  }
  async function handleUpdateEvent(id, updates) {
    // Optimistic UI: uppdatera local state direkt
    setCalEvents(p => p.map(e => e.id === id ? { ...e, ...updates } : e))
    const { error } = await supabase.from("calendar_events").update({
      title: updates.title,
      start_time: updates.start_time,
      end_time: updates.end_time,
      location: updates.location,
      color: updates.color,
      shared: updates.shared,
      recurrence_rule: updates.recurrence_rule,
      reminder_minutes: updates.reminder_minutes,
    }).eq("id", id)
    if (error) console.error("[handleUpdateEvent]", error)
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
  async function handleAddCountdown(c) {
    const { data, error } = await supabase.from("countdowns").insert({
      household_id: householdId, title: c.title, target_date: c.target_date,
      color: c.color || ACCENT.calendar, emoji: c.emoji || null, created_by: userId,
    }).select().single()
    if (!error && data) logActivity("add_countdown", "countdown", data.id, `lade till nedräkningen "${c.title}"`)
  }
  async function handleDeleteCountdown(id) {
    setCountdowns(p => p.filter(c => c.id !== id))
    await supabase.from("countdowns").delete().eq("id", id)
  }
  async function handleSaveTvPhoto(url) {
    setTvPhotoUrl(url)
    if (!householdId) return
    const { error } = await supabase.from("tv_layouts").upsert({
      household_id: householdId, photo_url: url, updated_at: new Date().toISOString(),
    }, { onConflict: "household_id" })
    if (error) console.warn("[tvPhoto]", error.message)
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

  // AI Tool dispatcher — mappar verktygsanrop till handlers
  async function executeAiTool(name, args) {
    try {
      if (name === "add_todo") {
        const list = findByName(lists, args.list_name, l => l.name, true) || lists.find(l => !l.archived)
        if (!list) return { ok: false, message: "Inga aktiva listor finns. Skapa en först." }
        await handleAddTodo(args.text, list.id)
        return { ok: true, message: `Lagt till "${args.text}" på ${list.name}` }
      }
      if (name === "complete_todo") {
        const list = args.list_name ? findByName(lists, args.list_name, l => l.name, true) : null
        const candidates = list ? todos.filter(td => td.list_id === list.id) : todos
        const td = findByName(candidates, args.text, t => t.text, true)
        if (!td) return { ok: false, message: `Hittade ingen aktiv uppgift som matchar "${args.text}"` }
        await handleToggleTodo(td)
        return { ok: true, message: `Bockade av "${td.text}"` }
      }
      if (name === "delete_todo") {
        const td = findByName(todos, args.text, t => t.text)
        if (!td) return { ok: false, message: `Hittade ingen uppgift "${args.text}"` }
        await handleDeleteTodo(td)
        return { ok: true, message: `Tog bort "${td.text}"` }
      }
      if (name === "add_list") {
        await handleAddList({
          name: args.name,
          color: args.color || "#7c3aed",
          shared: args.shared !== false,
          expires_at: null,
        })
        return { ok: true, message: `Skapade listan "${args.name}"` }
      }
      if (name === "archive_list") {
        const list = findByName(lists, args.list_name, l => l.name, true)
        if (!list) return { ok: false, message: `Hittade ingen lista "${args.list_name}"` }
        await handleArchiveList(list.id)
        return { ok: true, message: `Arkiverade "${list.name}"` }
      }
      if (name === "add_event") {
        await handleAddEvent({
          title: args.title,
          start_time: args.start_time,
          end_time: args.end_time,
          location: args.location || null,
          color: persons[0]?.color || ACCENT.event,
          shared: true,
          recurrence_rule: args.recurrence
            ? (args.recurrence_until ? { freq: args.recurrence, until: args.recurrence_until } : { freq: args.recurrence })
            : null,
        })
        return { ok: true, message: `Lade till "${args.title}"${args.recurrence ? " (återkommande)" : ""} ${new Date(args.start_time).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })} ${fmtTime(args.start_time)}` }
      }
      if (name === "delete_event") {
        const ev = findByName(calEvents, args.title, e => e.title)
        if (!ev) return { ok: false, message: `Hittade ingen händelse "${args.title}"` }
        await handleDeleteEvent(ev.id)
        return { ok: true, message: `Tog bort "${ev.title}"` }
      }
      if (name === "set_meal") {
        const wd = parseInt(args.weekday)
        if (wd < 1 || wd > 7) return { ok: false, message: "Ogiltig veckodag" }
        await handleSetMealText(wd, args.meal_text || "")
        return { ok: true, message: args.meal_text ? `${DAYS[wd - 1]}: ${args.meal_text}` : `Rensade ${DAYS[wd - 1]}` }
      }
      if (name === "set_meal_tag") {
        const wd = parseInt(args.weekday)
        if (wd < 1 || wd > 7) return { ok: false, message: "Ogiltig veckodag" }
        await handleSetMealTag(wd, args.tag || null)
        return { ok: true, message: `Satte tag på ${DAYS[wd - 1]}` }
      }
      if (name === "generate_week_menu") {
        await handleAiGenerateMeals(foodPrefs)
        return { ok: true, message: "Genererade ny veckomatsedel" }
      }
      if (name === "pin_list") {
        const list = findByName(lists, args.list_name, l => l.name, true)
        if (!list) return { ok: false, message: `Hittade ingen lista "${args.list_name}"` }
        if (!list.pinned) await handleTogglePin(list.id)
        return { ok: true, message: `"${list.name}" visas nu på Hem` }
      }
      return { ok: false, message: `Okänt verktyg: ${name}` }
    } catch (e) {
      return { ok: false, message: "Fel: " + (e.message || String(e)) }
    }
  }

  // Skickar message till ai-chat-edge function. Returnerar { reply, tool_calls, assistant_message }.
  async function callAiChat(message, previous) {
    const ctx = {
      lists: listsWithItems.map(l => ({
        name: l.name, shared: l.shared, pinned: l.pinned,
        items: l.items.map(it => ({ text: it.text, done: it.done })),
      })),
      events: calEvents.slice(0, 30).map(e => ({
        title: e.title, start_time: e.start_time, location: e.location,
        recurrence_rule: e.recurrence_rule,
      })),
      meals: meals.map(m => ({ weekday: m.weekday, meal_text: m.meal_text, tag: m.tag })),
      foodPrefs,
      persons: persons.map(p => ({ name: p.name, color: p.color })),
    }
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: { message, context: ctx, today, previous },
    })
    if (error) throw new Error(error.message || "AI-anrop misslyckades")
    return data
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
      /* Tunna scrollbars som matchar v11-estetiken */
      *::-webkit-scrollbar { width: 6px; height: 6px; }
      *::-webkit-scrollbar-track { background: transparent; }
      *::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; transition: background 0.2s; }
      *::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
      * { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.15) transparent; }
    `}</style>
  )

  const liftedModals = (
    <>
      <DayModal
        open={dayModal.open}
        date={dayModal.date}
        events={calEvents}
        persons={persons}
        onClose={closeDayModal}
        onAddEvent={(d) => { closeDayModal(); openAddEvent(d) }}
        onEditEvent={(ev) => { closeDayModal(); openEditEvent(ev) }}
        onDeleteEvent={handleDeleteEvent}
      />
      <AddEventModal
        open={eventModal.open}
        prefillDate={eventModal.date}
        editEvent={eventModal.editEvent}
        persons={persons}
        onClose={closeAddEvent}
        onSave={handleAddEvent}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />
    </>
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
          photoUrl={tvPhotoUrl}
          onDayClick={openDayModal}
        />
        {liftedModals}
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
    calEvents, persons, onAddEvent: handleAddEvent, onDeleteEvent: handleDeleteEvent, onOpenAddEvent: openAddEvent, onOpenDayModal: openDayModal, userId,
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
      photoUrl: tvPhotoUrl,
    },
    tvSlots, onSaveTvSlots: handleSaveTvSlots,
    tvPhotoUrl, onSaveTvPhoto: handleSaveTvPhoto,
    activity,
    countdowns, onAddCountdown: handleAddCountdown, onDeleteCountdown: handleDeleteCountdown,
    householdIdProp: householdId, currentWeekStart,
  }

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
          <AiChat position="mobile" callAi={callAiChat} executeTool={executeAiTool} />
        </div>
        {liftedModals}
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
          <AiChat position="desktop" callAi={callAiChat} executeTool={executeAiTool} />
        </div>
      </div>
      {liftedModals}
    </>
  )
}
