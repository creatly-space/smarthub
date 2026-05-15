import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { supabase } from "./lib/supabase"
import {
  Home, CalendarDays, ListChecks, UtensilsCrossed, MoreHorizontal, Settings,
  Check, Plus, Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning,
  CloudDrizzle, CloudFog, Snowflake, Monitor,
  Users, Lock, X, ChevronRight, ChevronLeft, User, LogOut, Sparkles,
  ThumbsUp, ThumbsDown, Grip, Copy, Trash2, Edit3, Mic, MapPin,
  Archive, ArchiveRestore, Search, Repeat, Bell, BellOff, ShoppingCart,
} from "lucide-react"
import groceriesData from "./data/groceries.json"

// Plattlista över alla matvaror för fuzzy-matching, kategoriserad används för UI om vi vill
const ALL_GROCERIES = (() => {
  const out = []
  for (const cat of Object.keys(groceriesData)) {
    for (const item of groceriesData[cat]) {
      out.push({ name: item, category: cat, lower: item.toLowerCase() })
    }
  }
  return out
})()
function findGroceryMatches(query, max = 6) {
  const q = (query || "").toLowerCase().trim()
  if (q.length < 2) return []
  // Sortera: exakta matchningar först, sen startsWith, sen substring.
  // Behåll exakta matches synliga (annars försvinner sista förslaget när användaren skrivit klart).
  const exact = []
  const starts = []
  const contains = []
  for (const g of ALL_GROCERIES) {
    if (g.lower === q) exact.push(g)
    else if (g.lower.startsWith(q)) starts.push(g)
    else if (g.lower.includes(q)) contains.push(g)
    if (exact.length + starts.length >= max) break
  }
  return [...exact, ...starts, ...contains].slice(0, max)
}
function categoryOf(itemName) {
  const found = ALL_GROCERIES.find(g => g.lower === itemName.toLowerCase())
  return found?.category || null
}

// ════════════════════════════════════════════════
//  DESIGN TOKENS (from v11 mockup)
// ════════════════════════════════════════════════
const t = {
  bg: "#f0f2f5", card: "#ffffff", cardBorder: "rgba(0,0,0,0.06)",
  text: "#1a1a2e", textSec: "rgba(0,0,0,0.55)", textMuted: "rgba(0,0,0,0.25)",
  line: "rgba(0,0,0,0.04)", inputBg: "rgba(0,0,0,0.03)", inputBorder: "rgba(0,0,0,0.08)",
}
const ACCENT = { calendar: "#7c3aed", todo: "#059669", meal: "#d97706", event: "#2563eb", weather: "#0ea5e9" }

// ── Hem-vy widget-konfiguration (mobile only, persisted via localStorage) ──
const HOME_WIDGET_META = {
  calendar:  { label: "Veckokalender", icon: "📅", fullWidthInGrid: true },
  todo:      { label: "Fäst lista",    icon: "📝", fullWidthInGrid: false },
  meal:      { label: "Veckomeny",     icon: "🍽️", fullWidthInGrid: false },
  countdown: { label: "Nedräkning",    icon: "⏳", fullWidthInGrid: true },
  activity:  { label: "Aktivitet",     icon: "📣", fullWidthInGrid: true },
}
const DEFAULT_HOME_CONFIG = {
  widgets: [
    { id: "calendar",  enabled: true },
    { id: "todo",      enabled: true },
    { id: "meal",      enabled: true },
    { id: "countdown", enabled: true },
    { id: "activity",  enabled: true },
  ],
  gridMode: false,
  showWeather: true,
}
function loadHomeConfig() {
  if (typeof window === "undefined") return DEFAULT_HOME_CONFIG
  try {
    const raw = localStorage.getItem("smarthub:homeConfig")
    if (!raw) return DEFAULT_HOME_CONFIG
    const saved = JSON.parse(raw)
    // Migrate: lägg till nya widgets som inte fanns när config sparades
    const savedIds = new Set((saved.widgets || []).map(w => w.id))
    const merged = [...(saved.widgets || [])]
    for (const w of DEFAULT_HOME_CONFIG.widgets) {
      if (!savedIds.has(w.id)) merged.push(w)
    }
    // Filtrera bort widgets som inte längre finns i meta
    const valid = merged.filter(w => HOME_WIDGET_META[w.id])
    return {
      widgets: valid.length ? valid : DEFAULT_HOME_CONFIG.widgets,
      gridMode: !!saved.gridMode,
      showWeather: saved.showWeather !== false,
    }
  } catch {
    return DEFAULT_HOME_CONFIG
  }
}
const THEME_PRESETS = [
  { id: "lila",   label: "Lila",  color: "#7c3aed" },
  { id: "bla",    label: "Blå",   color: "#2563eb" },
  { id: "gron",   label: "Grön",  color: "#059669" },
  { id: "rosa",   label: "Rosa",  color: "#db2777" },
  { id: "orange", label: "Orange", color: "#ea580c" },
  { id: "teal",   label: "Teal",  color: "#0d9488" },
]
function getThemeColor() {
  if (typeof window === "undefined") return ACCENT.calendar
  const saved = localStorage.getItem("smarthub:themeColor")
  return saved || ACCENT.calendar
}

// VAPID public key — sätts via env-variabel vid build (Vite: VITE_VAPID_PUBLIC_KEY)
const VAPID_PUBLIC_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_VAPID_PUBLIC_KEY) || ""

// Web Push helpers
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
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
    // Vanlig händelse: ta med om den OVERLAPPAR fönstret (start ≤ to OCH end ≥ from)
    const startMs = new Date(event.start_time).getTime()
    const endMs = new Date(event.end_time || event.start_time).getTime()
    if (startMs <= toMs && endMs >= fromMs) return [event]
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
function Card({ accent, children, style = {}, dark }) {
  const cardBg = dark ? "rgba(255,255,255,0.06)" : t.card
  const border = dark ? "rgba(255,255,255,0.1)" : t.cardBorder
  return (
    <div style={{
      background: cardBg, borderRadius: 14,
      border: `1px solid ${border}`,
      borderTop: accent ? `3px solid ${accent}` : `1px solid ${border}`,
      boxShadow: dark ? "0 2px 8px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)",
      backdropFilter: dark ? "blur(8px)" : "none",
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
function ClockDisplay({ size = "large", textColor, secColor }) {
  const now = useNow(1000)
  const time = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
  const date = now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })
  const sizes = { huge: 96, large: 72, medium: 40, small: 32, tiny: 22 }
  return (
    <div style={{ textAlign: size === "large" || size === "huge" ? "center" : "left" }}>
      <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: sizes[size] || 32, fontWeight: 300, color: textColor || t.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{time}</div>
      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: size === "huge" ? 18 : size === "large" ? 16 : size === "tiny" ? 11 : 13, color: secColor || t.textSec, fontWeight: 500, marginTop: size === "tiny" ? 2 : 4, textTransform: "capitalize" }}>{date}</div>
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
function CalendarWidget({ events, persons, fill, compact, large, onDayClick, dark }) {
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
    const monthStart = new Date(vy, vm, 1)
    const monthEnd = new Date(vy, vm + 1, 0, 23, 59, 59)
    const expanded = expandEvents(events, monthStart, monthEnd)
    const out = {}
    expanded.forEach(ev => {
      const start = new Date(ev.start_time)
      const end = new Date(ev.end_time)
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      const isMultiDay = startDay.getTime() !== endDay.getTime()
      const p = getPersonForEvent(ev, persons)
      // Iterera genom varje dag eventet täcker (för flerdagsevents)
      let cursor = new Date(startDay)
      let safety = 0
      while (cursor <= endDay && safety < 366) {
        safety++
        if (cursor.getFullYear() === vy && cursor.getMonth() === vm) {
          const day = cursor.getDate()
          if (!out[day]) out[day] = []
          out[day].push({
            id: ev.id + "_d" + fmtDate(cursor),
            time: ev.all_day ? "" : fmtTime(ev.start_time),
            title: ev.title,
            color: p.color, name: p.name,
            recurring: !!ev.master_id,
            all_day: !!ev.all_day,
            multi_day: isMultiDay,
            is_first_day: cursor.getTime() === startDay.getTime(),
            is_last_day: cursor.getTime() === endDay.getTime(),
          })
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
      }
    })
    // Sortera: all-day först, sen multi-day, sen efter tid
    Object.keys(out).forEach(k => {
      out[k].sort((a, b) => {
        if (a.all_day !== b.all_day) return a.all_day ? -1 : 1
        if (a.multi_day !== b.multi_day) return a.multi_day ? -1 : 1
        return (a.time || "").localeCompare(b.time || "")
      })
    })
    return out
  }, [events, vy, vm, persons])

  const isCurrentMonth = vm === today.getMonth() && vy === today.getFullYear()
  const txtColor = dark ? "#e8eaf0" : t.text
  const txtSec = dark ? "rgba(255,255,255,0.6)" : t.textSec
  const txtMuted = dark ? "rgba(255,255,255,0.35)" : t.textMuted

  return (
    <Card dark={dark} accent={ACCENT.calendar} style={fill ? { flex: 1, minHeight: 0 } : {}}>
      <div style={{ padding: compact ? "10px 12px" : "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Label color={ACCENT.calendar} icon={CalendarDays}>Kalender</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => { if (vm === 0) { setVm(11); setVy(y => y - 1) } else setVm(m => m - 1) }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: txtMuted }}><ChevronLeft size={14} /></button>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: txtSec, fontWeight: 600, textTransform: "capitalize", minWidth: 80, textAlign: "center" }}>{month} {vy}</span>
            <button onClick={() => { if (vm === 11) { setVm(0); setVy(y => y + 1) } else setVm(m => m + 1) }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: txtMuted }}><ChevronRight size={14} /></button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: "center", fontFamily: "Nunito, sans-serif", fontSize: large ? 12 : compact ? 10 : 11, fontWeight: 700, color: txtMuted, textTransform: "uppercase" }}>{d}</div>
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
                const dateColor = !day ? "transparent" : isToday ? ACCENT.calendar : isRedDay ? "#dc2626" : txtColor
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
                    {dayEvents.slice(0, large ? 2 : fill ? 2 : 1).map((ev) => {
                      // All-day eller multi-day = "bar"-stil (fylld bakgrund, ingen tid visad)
                      const isBar = ev.all_day || ev.multi_day
                      // Avrundning bara på första/sista dagen för multi-day, så det ser sammanhängande ut
                      const rounded = !ev.multi_day
                        ? (large ? 4 : 3)
                        : (ev.is_first_day && ev.is_last_day) ? (large ? 4 : 3)
                          : ev.is_first_day ? `${large ? 4 : 3}px 0 0 ${large ? 4 : 3}px`
                          : ev.is_last_day ? `0 ${large ? 4 : 3}px ${large ? 4 : 3}px 0`
                          : 0
                      return (
                        <div key={ev.id} style={{
                          fontSize: large ? 11 : compact ? 6 : 7,
                          fontFamily: "Nunito, sans-serif", fontWeight: 700,
                          color: isBar ? "#fff" : ev.color,
                          background: isBar ? ev.color : `${ev.color}15`,
                          borderRadius: rounded,
                          padding: large ? "2px 5px" : "0px 2px",
                          lineHeight: 1.3,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginBottom: large ? 2 : 1,
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          {ev.recurring && <Repeat size={large ? 9 : compact ? 5 : 6} style={{ flexShrink: 0 }} />}
                          {/* På multi-day visa bara titeln på första dagen, tomt på fortsättnings-celler */}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ev.multi_day && !ev.is_first_day
                              ? "→"
                              : ev.all_day || ev.multi_day
                                ? ev.title
                                : large ? ev.title : `${ev.time} ${ev.title}`}
                          </span>
                        </div>
                      )
                    })}
                    {dayEvents.length > (large ? 2 : fill ? 2 : 1) && (
                      <div style={{ fontSize: large ? 10 : 6, color: txtMuted, textAlign: "center", fontWeight: 700, marginTop: 1 }}>
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
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 600, color: txtSec }}>{p.name}</span>
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
function AddEventModal({ open, prefillDate, editEvent, persons, userId, onClose, onSave, onUpdate, onDelete }) {
  const isEdit = !!editEvent
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(fmtDate(new Date()))
  const [endDate, setEndDate] = useState(fmtDate(new Date()))
  const [time, setTime] = useState("12:00")
  const [endTime, setEndTime] = useState("13:00")
  const [allDay, setAllDay] = useState(false)
  const [personIdx, setPersonIdx] = useState(0)
  const [shared, setShared] = useState(true)
  const [notify, setNotify] = useState(true)
  const [reminderMinutes, setReminderMinutes] = useState(60)
  const [recurrence, setRecurrence] = useState(null)
  const [recurUntil, setRecurUntil] = useState("")

  // Prefilla från editEvent eller prefillDate när modalen öppnas
  useEffect(() => {
    if (!open) return
    if (editEvent) {
      const start = new Date(editEvent.start_time)
      const end = new Date(editEvent.end_time)
      setTitle(editEvent.title || "")
      setDate(fmtDate(start))
      setEndDate(fmtDate(end))
      setTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`)
      setEndTime(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`)
      setAllDay(!!editEvent.all_day)
      const matchedPerson = persons.findIndex(p => p.user_id === editEvent.created_by)
      setPersonIdx(matchedPerson >= 0 ? matchedPerson : 0)
      setShared(editEvent.shared !== false)
      setReminderMinutes(editEvent.reminder_minutes ?? null)
      setNotify(editEvent.reminder_minutes != null)
      setRecurrence(editEvent.recurrence_rule?.freq || null)
      setRecurUntil(editEvent.recurrence_rule?.until || "")
    } else {
      setTitle("")
      const startDate = prefillDate ? fmtDate(prefillDate) : fmtDate(new Date())
      setDate(startDate)
      setEndDate(startDate)
      setTime("12:00")
      setEndTime("13:00")
      setAllDay(false)
      const myIdx = persons.findIndex(p => p.user_id === userId)
      setPersonIdx(myIdx >= 0 ? myIdx : 0)
      setShared(true)
      setNotify(true)
      setReminderMinutes(60)
      setRecurrence(null)
      setRecurUntil("")
    }
  }, [open, prefillDate, editEvent, persons, userId])

  if (!open) return null

  function submit() {
    if (!title.trim()) return
    const recurrence_rule = recurrence
      ? (recurUntil ? { freq: recurrence, until: recurUntil } : { freq: recurrence })
      : null
    // För all-day: använd start kl 00:00 och end kl 23:59:59 (på respektive datum)
    const effectiveEndDate = endDate < date ? date : endDate // skydda mot end < start
    const startTimestamp = allDay ? `${date}T00:00:00` : `${date}T${time}:00`
    const endTimestamp = allDay
      ? `${effectiveEndDate}T23:59:59`
      : `${effectiveEndDate}T${endTime}:00`
    const payload = {
      title: title.trim(),
      start_time: startTimestamp,
      end_time: endTimestamp,
      all_day: allDay,
      location: editEvent?.location || null,
      color: persons[personIdx]?.color || ACCENT.event,
      shared,
      reminder_minutes: notify && !allDay ? reminderMinutes : null,
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

        {/* Heldags-toggle */}
        <div onClick={() => setAllDay(a => !a)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: allDay ? ACCENT.calendar : t.textMuted, padding: 2, display: "flex", alignItems: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "transform 0.2s", transform: allDay ? "translateX(16px)" : "translateX(0)" }} />
          </div>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: allDay ? t.text : t.textSec }}>Heldag</span>
        </div>

        {/* Datum (start + slut) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, fontWeight: 700, minWidth: 40 }}>FRÅN</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
            {!allDay && <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle, width: 100, fontSize: 13 }} />}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, fontWeight: 700, minWidth: 40 }}>TILL</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={date} style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
            {!allDay && <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: 100, fontSize: 13 }} />}
          </div>
          {date !== endDate && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: ACCENT.event, fontWeight: 700, marginTop: 2 }}>
              📅 Flerdagshändelse
            </span>
          )}
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

// Beräknar antal dagar mellan idag (lokalt) och target_date
function daysUntilDate(dateStr) {
  const today = new Date()
  const target = new Date(dateStr + "T00:00:00")
  return Math.floor((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
}

// Stor, kvadratisk hero-widget för Hem-vyn — visar EN pinned countdown
function BigCountdownWidget({ pinnedCountdown, onOpenTab }) {
  if (!pinnedCountdown) {
    return (
      <Card>
        <div onClick={onOpenTab} style={{
          padding: "20px 16px", textAlign: "center", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <div style={{ fontSize: 32 }}>🎯</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>Inga fästa nedräkningar</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>
            Gå till Nedräkningar-fliken och fäst en så visas den här
          </div>
        </div>
      </Card>
    )
  }
  const c = pinnedCountdown
  const days = daysUntilDate(c.target_date)
  const isToday = days === 0
  const isPast = days < 0
  const isSoon = days <= 7 && days > 0
  // Color-tema
  const bg1 = `${c.color}15`
  const bg2 = `${c.color}06`
  const dateStr = new Date(c.target_date + "T00:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  return (
    <Card accent={c.color}>
      <div style={{
        position: "relative",
        padding: "24px 20px 22px",
        background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
        display: "flex", alignItems: "center", gap: 20,
        minHeight: 160,
      }}>
        {/* Stor siffra till vänster */}
        <div style={{
          flexShrink: 0,
          width: 130, height: 130,
          borderRadius: 20,
          background: `${c.color}20`,
          border: `2px solid ${c.color}40`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 16px ${c.color}25`,
        }}>
          {isToday ? (
            <>
              <div style={{ fontSize: 40 }}>🎉</div>
              <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 22, fontWeight: 700, color: c.color, marginTop: 4 }}>IDAG!</div>
            </>
          ) : isPast ? (
            <>
              <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 56, fontWeight: 700, color: t.textMuted, lineHeight: 1 }}>{Math.abs(days)}</div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textMuted, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                dagar sen
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 64, fontWeight: 700, color: c.color, lineHeight: 1, letterSpacing: "-0.03em" }}>{days}</div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: c.color, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 }}>
                {days === 1 ? "DAG KVAR" : "DAGAR KVAR"}
              </div>
            </>
          )}
        </div>

        {/* Titel + datum till höger */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {c.emoji && <div style={{ fontSize: 36, lineHeight: 1 }}>{c.emoji}</div>}
          <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 22, fontWeight: 700, color: t.text, lineHeight: 1.15, wordBreak: "break-word" }}>
            {c.title}
          </div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, textTransform: "capitalize" }}>
            {dateStr}
          </div>
          {isSoon && !isToday && (
            <div style={{
              alignSelf: "flex-start",
              fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 700,
              color: "#dc2626", background: "#dc262615",
              padding: "3px 8px", borderRadius: 6, marginTop: 4,
            }}>SNART!</div>
          )}
        </div>
      </div>
    </Card>
  )
}

// Full Countdowns-flik: lista alla, pin/unpin, lägg till/ta bort
function CountdownsTab({ isMobile, countdowns, onAdd, onDelete, onTogglePin }) {
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [emoji, setEmoji] = useState("")
  const [color, setColor] = useState(LIST_COLORS[0])

  const today = new Date()
  const todayStr = fmtDate(today)
  const upcoming = countdowns.filter(c => c.target_date >= todayStr).sort((a, b) => a.target_date.localeCompare(b.target_date))
  const past = countdowns.filter(c => c.target_date < todayStr).sort((a, b) => b.target_date.localeCompare(a.target_date))

  function submit() {
    if (!title.trim() || !date) return
    onAdd({ title: title.trim(), target_date: date, color, emoji: emoji.trim() || null })
    setTitle(""); setDate(""); setEmoji(""); setColor(LIST_COLORS[0]); setShowAdd(false)
  }

  function CountdownRow({ c, isPast }) {
    const days = daysUntilDate(c.target_date)
    const isToday = days === 0
    const dateStr = new Date(c.target_date + "T00:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })
    return (
      <Card accent={c.color}>
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          {c.emoji && <div style={{ fontSize: 28, flexShrink: 0 }}>{c.emoji}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>{c.title}</span>
              {c.pinned && <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT.todo, background: `${ACCENT.todo}15`, padding: "1px 6px", borderRadius: 4 }}>📌 Hem</span>}
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, marginTop: 2 }}>{dateStr}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {isToday ? (
              <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 18, fontWeight: 700, color: "#dc2626" }}>Idag!</div>
            ) : isPast ? (
              <>
                <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 22, fontWeight: 700, color: t.textMuted, lineHeight: 1 }}>{Math.abs(days)}</div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 9, color: t.textMuted, marginTop: 2 }}>dagar sen</div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 26, fontWeight: 700, color: c.color, lineHeight: 1 }}>{days}</div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 9, color: t.textMuted, marginTop: 2 }}>{days === 1 ? "dag" : "dagar"}</div>
              </>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
            {!isPast && (
              <button onClick={() => onTogglePin(c.id)} title={c.pinned ? "Ta bort från Hem" : "Visa på Hem"} style={{
                background: c.pinned ? `${ACCENT.todo}15` : "transparent",
                border: "none", cursor: "pointer", padding: 6, borderRadius: 6,
                color: c.pinned ? ACCENT.todo : t.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Home size={14} />
              </button>
            )}
            <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: t.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: isMobile ? 22 : 24, fontWeight: 700, color: t.text, margin: 0 }}>Nedräkningar</h2>
        {!showAdd && <Btn onClick={() => setShowAdd(true)}><Plus size={14} /> Ny nedräkning</Btn>}
      </div>

      {showAdd && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>Ny nedräkning</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 2))} placeholder="🏖️" style={{ ...inputStyle, fontSize: 20, width: 60, textAlign: "center", padding: "8px 4px" }} />
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Vad? T.ex. Mallorca" style={{ ...inputStyle, fontSize: 14, flex: 1 }} autoFocus />
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />
            <div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 600, color: t.textSec, marginBottom: 6, display: "block" }}>Färg</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LIST_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{
                    width: 28, height: 28, borderRadius: 14, background: c,
                    border: color === c ? `3px solid ${t.text}` : "3px solid transparent",
                    cursor: "pointer", padding: 0,
                  }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn outline small onClick={() => { setShowAdd(false); setTitle(""); setDate("") }}><X size={12} /> Avbryt</Btn>
              <Btn small color={ACCENT.calendar} onClick={submit} disabled={!title.trim() || !date}><Check size={12} /> Spara</Btn>
            </div>
          </div>
        </Card>
      )}

      {countdowns.length === 0 && !showAdd && (
        <Card>
          <div style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 40 }}>🎯</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>Inga nedräkningar än</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>Lägg till en så ser du dagarna ticka ner.</div>
          </div>
        </Card>
      )}

      {upcoming.length > 0 && (
        <>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "8px 4px 6px" }}>Kommande</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {upcoming.map(c => <CountdownRow key={c.id} c={c} isPast={false} />)}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "8px 4px 6px" }}>Passerade</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.7 }}>
            {past.slice(0, 5).map(c => <CountdownRow key={c.id} c={c} isPast={true} />)}
          </div>
        </>
      )}
    </div>
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
function DayModal({ open, date, events, persons, onClose, onAddEvent, onEditEvent, onDeleteEvent, userId }) {
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
                // Master-id räknas som ägare av instanser av återkommande events
                const isOwner = ev.created_by === userId
                return (
                  <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: `${p.color}08`, borderRadius: 10, border: `1px solid ${p.color}15` }}>
                    <div style={{ width: 4, height: 36, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, cursor: isOwner && onEditEvent ? "pointer" : "default" }} onClick={() => isOwner && onEditEvent && onEditEvent(ev)}>
                      <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                        {fmtTime(ev.start_time)}
                        {ev.end_time && ev.end_time !== ev.start_time && ` – ${fmtTime(ev.end_time)}`}
                        {isRecurring && <Repeat size={10} color={t.textMuted} />}
                        {ev.reminder_minutes != null && <span title="Påminnelse satt" style={{ fontSize: 10 }}>🔔</span>}
                        {!isOwner && <span title="Skapad av annan medlem" style={{ fontSize: 9, color: t.textMuted }}>· {p.name}</span>}
                      </div>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: t.text, fontWeight: 600 }}>{ev.title}</div>
                      {ev.location && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}><MapPin size={10} /> {ev.location}</div>}
                    </div>
                    {isOwner && onEditEvent && (
                      <button onClick={() => onEditEvent(ev)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }} title="Redigera">
                        <Edit3 size={16} />
                      </button>
                    )}
                    {isOwner && (
                      <button onClick={() => handleDelete(ev)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }} title="Ta bort">
                        <X size={16} />
                      </button>
                    )}
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

  const eventsToday = useMemo(() => {
    const today = new Date()
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    return expandEvents(events, dayStart, dayEnd)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  }, [events])

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
function TodoCard({ pinnedList, onToggle, fill, maxHeight, dark }) {
  const list = pinnedList || { id: null, name: "Att göra", color: ACCENT.todo, items: [] }
  const items = list.items || []
  const activeItems = items.filter(i => !i.done)
  const doneItems = items.filter(i => i.done)
  const [showDone, setShowDone] = useState(false)
  const listColor = list.color || ACCENT.todo
  const txtColor = dark ? "#e8eaf0" : t.text
  const txtSec = dark ? "rgba(255,255,255,0.6)" : t.textSec
  const txtMuted = dark ? "rgba(255,255,255,0.35)" : t.textMuted
  const lineColor = dark ? "rgba(255,255,255,0.08)" : t.line
  const listContainerStyle = fill
    ? { display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", minHeight: 0 }
    : { display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", maxHeight: maxHeight || 280 }
  return (
    <Card dark={dark} accent={listColor} style={fill ? { flex: 1, minHeight: 0 } : {}}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label color={listColor} icon={ListChecks}>{list.name}</Label>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: txtSec }}>{doneItems.length}/{items.length}</span>
        </div>
        <div style={listContainerStyle}>
          {items.length === 0 && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: txtMuted, fontStyle: "italic" }}>Inga uppgifter</span>
          )}
          {activeItems.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }} onClick={() => onToggle(item)}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                border: `2px solid ${txtMuted}`,
                background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }} />
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500, color: txtColor }}>{item.text}</span>
            </div>
          ))}
          {doneItems.length > 0 && (
            <div style={{ borderTop: `1px solid ${lineColor}`, paddingTop: 8, marginTop: 4, flexShrink: 0 }}>
              <div onClick={() => setShowDone(s => !s)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", padding: "2px 0",
                fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: txtSec,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Check size={11} color={listColor} />
                  Bockat ({doneItems.length})
                </span>
                <ChevronRight size={11} color={txtMuted} style={{ transform: showDone ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
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
                        color: txtMuted, textDecoration: "line-through",
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

// ════════════════════════════════════════════════
//  SHOPPING — autocomplete-input + lista + widget
// ════════════════════════════════════════════════

// Återanvändbar autocomplete-input för matvaror
function GroceryAutocomplete({ onSubmit, placeholder = "Lägg till vara...", small, autoFocus, dark }) {
  const [text, setText] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [dropdownPos, setDropdownPos] = useState(null)
  const inputRef = useRef(null)
  const wrapRef = useRef(null)
  const dropdownRef = useRef(null)

  const matches = useMemo(() => findGroceryMatches(text, 6), [text])
  const showDropdown = showSuggestions && matches.length > 0 && text.length >= 2

  // Beräkna dropdown-position relativ till input (fixed positioning, escapas från overflow:hidden parents)
  useLayoutEffect(() => {
    if (!showDropdown || !inputRef.current) return
    function update() {
      if (!inputRef.current) return
      const r = inputRef.current.getBoundingClientRect()
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [showDropdown, text])

  // Stäng dropdown vid klick utanför både input och dropdown
  useEffect(() => {
    if (!showDropdown) return
    function onDocClick(e) {
      const insideWrap = wrapRef.current && wrapRef.current.contains(e.target)
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target)
      if (!insideWrap && !insideDropdown) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [showDropdown])

  function submit(value) {
    const v = (value ?? text).trim()
    if (!v) return
    onSubmit(v)
    setText("")
    setShowSuggestions(false)
    setHighlightIdx(0)
    inputRef.current?.focus()
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (showDropdown && matches[highlightIdx]) {
        submit(matches[highlightIdx].name)
      } else {
        submit()
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, matches.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const inputBg = dark ? "rgba(255,255,255,0.08)" : t.inputBg
  const inputBorder = dark ? "rgba(255,255,255,0.15)" : t.inputBorder
  const txtColor = dark ? "#e8eaf0" : t.text
  const dropdownBg = dark ? "rgba(20,22,30,0.96)" : t.card
  const dropdownBorder = dark ? "rgba(255,255,255,0.12)" : t.cardBorder

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        ref={inputRef}
        value={text}
        onChange={e => { setText(e.target.value); setShowSuggestions(true); setHighlightIdx(0) }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          fontFamily: "Nunito, sans-serif", fontSize: small ? 12 : 14,
          padding: small ? "6px 10px" : "8px 12px",
          borderRadius: 8, border: `1px solid ${inputBorder}`,
          background: inputBg, outline: "none", color: txtColor,
          width: "100%", boxSizing: "border-box",
        }}
      />
      {showDropdown && dropdownPos && typeof document !== "undefined" && createPortal(
        <div ref={dropdownRef} style={{
          position: "fixed",
          top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
          zIndex: 9999,
          background: dropdownBg, border: `1px solid ${dropdownBorder}`,
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          backdropFilter: "blur(12px)",
          maxHeight: 240, overflowY: "auto",
        }}>
          {matches.map((m, i) => (
            <div
              key={m.name}
              onMouseDown={(e) => { e.preventDefault(); submit(m.name) }}
              onMouseEnter={() => setHighlightIdx(i)}
              style={{
                padding: "10px 12px",
                background: highlightIdx === i ? (dark ? "rgba(255,255,255,0.08)" : `${ACCENT.calendar}10`) : "transparent",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}
            >
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: txtColor }}>{m.name}</span>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: dark ? "rgba(255,255,255,0.45)" : t.textMuted }}>{m.category}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// Inköpslista: full vy med autocomplete + items
function ShoppingList({ items, onAdd, onToggle, onDelete, onClearChecked }) {
  const active = items.filter(i => !i.done)
  const done = items.filter(i => i.done)

  // Gruppera aktiva på kategori för bättre översikt
  const byCategory = useMemo(() => {
    const groups = {}
    for (const it of active) {
      const cat = it.category || categoryOf(it.text) || "Övrigt"
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(it)
    }
    return groups
  }, [active])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ overflow: "visible" }}>
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingCart size={16} color={ACCENT.todo} />
            <GroceryAutocomplete onSubmit={onAdd} placeholder="Skriv en vara, t.ex. mjölk..." />
          </div>
        </div>
      </Card>

      {active.length === 0 && done.length === 0 && (
        <Card>
          <div style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 36 }}>🛒</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>Inköpslistan är tom</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec }}>Börja skriva ovanför så får du förslag.</div>
          </div>
        </Card>
      )}

      {Object.entries(byCategory).map(([cat, group]) => (
        <Card key={cat}>
          <div style={{ padding: 12 }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 4px 8px" }}>
              {cat} <span style={{ color: t.textMuted }}>({group.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {group.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}>
                  <div onClick={() => onToggle(item)} style={{
                    width: 22, height: 22, borderRadius: 6, cursor: "pointer", flexShrink: 0,
                    border: `2px solid ${t.textMuted}`, background: "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }} />
                  <span onClick={() => onToggle(item)} style={{ flex: 1, cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 500, color: t.text }}>{item.text}</span>
                  <button onClick={() => onDelete(item)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}

      {done.length > 0 && (
        <Card>
          <div style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 8px" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Köpt ({done.length})
              </div>
              {onClearChecked && (
                <button onClick={onClearChecked} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: ACCENT.todo, padding: 0 }}>
                  Rensa alla
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {done.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}>
                  <div onClick={() => onToggle(item)} style={{
                    width: 22, height: 22, borderRadius: 6, cursor: "pointer", flexShrink: 0,
                    background: ACCENT.todo, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </div>
                  <span onClick={() => onToggle(item)} style={{ flex: 1, cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 500, color: t.textMuted, textDecoration: "line-through" }}>{item.text}</span>
                  <button onClick={() => onDelete(item)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// Kompakt widget för Hem-vy och TV
// Virtuellt tangentbord för TV-bruk (Pi-kiosk har inget on-screen keyboard).
// Renderas som overlay-bottom-sheet.
function VirtualKeyboard({ value, onChange, onSubmit, onClose, suggestions = [] }) {
  const [shift, setShift] = useState(false)
  const rows = [
    "1234567890".split(""),
    "qwertyuiopå".split(""),
    "asdfghjklöä".split(""),
    "zxcvbnm".split(""),
  ]
  function press(k) {
    onChange(value + (shift ? k.toUpperCase() : k))
    setShift(false)
  }
  function backspace() { onChange(value.slice(0, -1)) }
  function space() { onChange(value + " ") }
  function tryVoice() {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = "sv-SE"; rec.continuous = false; rec.interimResults = false
    rec.onresult = e => onChange((value ? value + " " : "") + e.results[0][0].transcript)
    rec.start()
  }

  const keyBase = {
    minWidth: 56, height: 56, padding: "0 4px",
    fontSize: 22, fontWeight: 600,
    background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10,
    cursor: "pointer", fontFamily: "Nunito, sans-serif",
    color: t.text, flex: "1 1 0",
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      zIndex: 9999,
      background: "rgba(248,249,251,0.97)",
      backdropFilter: "blur(12px)",
      borderTop: `1px solid ${t.cardBorder}`,
      boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
      padding: 12,
    }}>
      {/* Inputfält + förslag */}
      <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, background: t.card, border: `2px solid ${ACCENT.todo}`, borderRadius: 12, padding: "12px 16px", fontSize: 20, fontFamily: "Nunito, sans-serif", color: t.text, minHeight: 28 }}>
          {value || <span style={{ color: t.textMuted }}>Skriv vara...</span>}
        </div>
        <button onClick={tryVoice} style={{ ...keyBase, minWidth: 56, flex: "0 0 auto", background: ACCENT.calendar, color: "#fff", fontSize: 18 }}>🎤</button>
        <button onClick={onClose} style={{ ...keyBase, minWidth: 56, flex: "0 0 auto", background: t.inputBg }}>✕</button>
      </div>

      {/* Förslag-chips */}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {suggestions.slice(0, 8).map(s => (
            <button key={s.name} onClick={() => onSubmit(s.name)} style={{
              padding: "8px 14px", borderRadius: 20,
              background: `${ACCENT.todo}15`, border: `1px solid ${ACCENT.todo}30`,
              color: ACCENT.todo, fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 700,
              cursor: "pointer",
            }}>{s.name}</button>
          ))}
        </div>
      )}

      {/* QWERTY */}
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, justifyContent: "center" }}>
          {i === 3 && <button onClick={() => setShift(s => !s)} style={{ ...keyBase, minWidth: 80, background: shift ? ACCENT.calendar : keyBase.background, color: shift ? "#fff" : keyBase.color }}>⇧</button>}
          {row.map(k => (
            <button key={k} onClick={() => press(k)} style={keyBase}>
              {shift ? k.toUpperCase() : k}
            </button>
          ))}
          {i === 3 && <button onClick={backspace} style={{ ...keyBase, minWidth: 80, background: t.inputBg }}>⌫</button>}
        </div>
      ))}
      {/* Mellanslag + Lägg till */}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button onClick={space} style={{ ...keyBase, flex: 3 }}>mellanslag</button>
        <button
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim()}
          style={{ ...keyBase, flex: 2, background: value.trim() ? ACCENT.todo : t.inputBg, color: value.trim() ? "#fff" : t.textMuted, fontWeight: 700 }}
        >
          ✓ Lägg till
        </button>
      </div>
    </div>
  )
}

function ShoppingCard({ items, onToggle, onAdd, fill, dark, virtualKeyboard }) {
  const active = items.filter(i => !i.done)
  const done = items.filter(i => i.done)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [vkValue, setVkValue] = useState("")
  const txtColor = dark ? "#e8eaf0" : t.text
  const txtSec = dark ? "rgba(255,255,255,0.6)" : t.textSec
  const txtMuted = dark ? "rgba(255,255,255,0.35)" : t.textMuted
  const containerStyle = fill
    ? { display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", minHeight: 0 }
    : { display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto", maxHeight: 280 }

  function handleAdd(text) {
    onAdd(text)
    setShowQuickAdd(false)
    setVkValue("")
  }

  // Förslag baserat på vad användaren skrivit i virtuella tangentbordet
  const vkSuggestions = useMemo(() => {
    if (!virtualKeyboard) return []
    if (!vkValue || vkValue.length < 2) {
      // Visa de mest använda när inget skrivits
      return ["Mjölk", "Bröd", "Smör", "Ost", "Ägg", "Pasta", "Kaffe", "Bananer"]
        .map(name => ({ name }))
    }
    return findGroceryMatches(vkValue, 8)
  }, [vkValue, virtualKeyboard])

  return (
    <Card dark={dark} accent={ACCENT.todo} style={fill ? { flex: 1, minHeight: 0 } : {}}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
          <Label color={ACCENT.todo} icon={ShoppingCart}>Inköp</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: txtSec }}>{done.length}/{items.length}</span>
            {onAdd && (
              <button onClick={() => setShowQuickAdd(s => !s)} style={{
                width: 24, height: 24, borderRadius: 12, border: "none",
                background: showQuickAdd ? ACCENT.todo : `${ACCENT.todo}25`,
                color: showQuickAdd ? "#fff" : ACCENT.todo,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }} title="Lägg till vara">
                {showQuickAdd ? <X size={14} /> : <Plus size={14} />}
              </button>
            )}
          </div>
        </div>

        {showQuickAdd && onAdd && !virtualKeyboard && (
          <div style={{ marginBottom: 8 }}>
            <GroceryAutocomplete onSubmit={handleAdd} placeholder="Vara..." small autoFocus dark={dark} />
          </div>
        )}
        {/* Render virtual keyboard via portal till body så det inte clip:as */}
        {showQuickAdd && onAdd && virtualKeyboard && typeof document !== "undefined" && createPortal(
          <VirtualKeyboard
            value={vkValue}
            onChange={setVkValue}
            onSubmit={handleAdd}
            onClose={() => { setShowQuickAdd(false); setVkValue("") }}
            suggestions={vkSuggestions}
          />,
          document.body
        )}

        <div style={containerStyle}>
          {items.length === 0 && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: txtMuted, fontStyle: "italic" }}>Tom inköpslista</span>
          )}
          {active.slice(0, fill ? 12 : 6).map(item => (
            <div key={item.id} onClick={() => onToggle(item)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${txtMuted}`, background: "transparent",
              }} />
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500, color: txtColor }}>{item.text}</span>
            </div>
          ))}
          {active.length > (fill ? 12 : 6) && (
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: txtMuted, fontStyle: "italic", marginTop: 2 }}>
              +{active.length - (fill ? 12 : 6)} till
            </span>
          )}
          {done.length > 0 && (
            <div style={{ marginTop: 4, paddingTop: 4, opacity: 0.6 }}>
              {done.slice(0, fill ? 4 : 2).map(item => (
                <div key={item.id} onClick={() => onToggle(item)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "2px 0" }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    background: ACCENT.todo, display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Check size={11} color="#fff" strokeWidth={3} /></div>
                  <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 500, color: txtMuted, textDecoration: "line-through" }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// Tabs överst i listor-tabben: Att göra / Inköp
// Pill-segmented control (primär växling — tydlig "container" känsla)
function ListsTopTabs({ mode, setMode, todoActiveCount, todoArchivedCount, shoppingItems }) {
  const shoppingActive = shoppingItems.filter(i => !i.done).length
  const tabs = [
    { id: "todo", icon: ListChecks, label: "Att göra", count: todoActiveCount, color: ACCENT.calendar },
    { id: "shopping", icon: ShoppingCart, label: "Inköp", count: shoppingActive, color: ACCENT.todo },
  ]
  return (
    <div style={{
      display: "flex", padding: 4, gap: 4,
      background: t.inputBg,
      border: `1px solid ${t.inputBorder}`,
      borderRadius: 14,
      marginBottom: 18,
    }}>
      {tabs.map(tab => {
        const active = mode === tab.id
        const Icon = tab.icon
        return (
          <button key={tab.id} onClick={() => setMode(tab.id)} style={{
            flex: 1,
            padding: "11px 14px",
            background: active ? t.card : "transparent",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontFamily: "Nunito, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: active ? tab.color : t.textSec,
            boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.2s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: active ? `${tab.color}15` : "rgba(0,0,0,0.05)",
                color: active ? tab.color : t.textMuted,
                padding: "1px 7px", borderRadius: 8,
                minWidth: 18, textAlign: "center",
              }}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ListItem({ item, listColor, onToggle, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left" }}>
      <div onClick={onToggle} style={{
        width: 20, height: 20, borderRadius: 6, cursor: "pointer", flexShrink: 0,
        border: item.done ? "none" : `2px solid ${t.textMuted}`,
        background: item.done ? listColor : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{item.done && <Check size={12} color="#fff" strokeWidth={3} />}</div>
      <span onClick={onToggle} style={{
        flex: 1, minWidth: 0, cursor: "pointer", textAlign: "left",
        fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 500,
        color: item.done ? t.textMuted : t.text,
        textDecoration: item.done ? "line-through" : "none",
      }}>{item.text}</span>
      <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 2, flexShrink: 0 }}>
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

function ListsView({ lists, pinnedListId, onToggleItem, onTogglePin, onToggleShared, onAddTodo, onAddList, onDeleteList, onDeleteTodo, onArchiveList, userId }) {
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
        const isOwner = list.created_by === userId
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
                    {/* Pin är personlig — alla kan välja vilken lista som visas på sin Hem */}
                    <Btn small outline color={pinned ? ACCENT.todo : t.textSec} onClick={e => { e.stopPropagation(); onTogglePin(list.id) }}>
                      <Home size={12} /> {pinned ? "Visas på hem" : "Visa på hem"}
                    </Btn>
                    {/* Shared/Archive/Delete — endast ägaren */}
                    {isOwner ? (
                      <>
                        <Btn small outline color={list.shared ? ACCENT.calendar : t.textSec} onClick={e => { e.stopPropagation(); onToggleShared(list) }}>
                          {list.shared ? <><Users size={12} /> Delad</> : <><Lock size={12} /> Privat</>}
                        </Btn>
                        <Btn small outline color={t.textSec} onClick={e => { e.stopPropagation(); onArchiveList(list.id) }}>
                          <Archive size={12} /> Arkivera
                        </Btn>
                        <Btn small outline color="#dc2626" onClick={e => { e.stopPropagation(); onDeleteList(list.id) }}>
                          <Trash2 size={12} /> Ta bort
                        </Btn>
                      </>
                    ) : (
                      <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, fontStyle: "italic", padding: "4px 8px" }}>
                        Bara ägaren kan ändra inställningar
                      </span>
                    )}
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
// Subtila text-tabs (sekundärt filter — minimalistiska, blandar inte ihop med top-tabs)
function ListTabSwitch({ activeCount, archivedCount, showArchive, setShowArchive }) {
  const tabStyle = (active) => ({
    background: "none",
    border: "none",
    padding: "6px 0",
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    fontWeight: active ? 700 : 500,
    fontSize: 12,
    color: active ? t.text : t.textMuted,
    borderBottom: active ? `2px solid ${t.text}` : "2px solid transparent",
    marginBottom: -1,
    transition: "all 0.15s",
    display: "inline-flex", alignItems: "center", gap: 5,
    letterSpacing: "0.02em",
  })
  return (
    <div style={{ display: "flex", gap: 20, marginBottom: 14, padding: "0 4px", borderBottom: `1px solid ${t.line}` }}>
      <button onClick={() => setShowArchive(false)} style={tabStyle(!showArchive)}>
        Aktiva
        {activeCount > 0 && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>· {activeCount}</span>}
      </button>
      <button onClick={() => setShowArchive(true)} style={tabStyle(showArchive)}>
        Arkiverade
        {archivedCount > 0 && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>· {archivedCount}</span>}
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
function MealCard({ fill, mealsByWeekday, mealTagsLocal, onSetMealText, onSetMealTag, dark }) {
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState("")
  const todayIdx = (new Date().getDay() + 6) % 7
  const txtColor = dark ? "#e8eaf0" : t.text
  const txtSec = dark ? "rgba(255,255,255,0.6)" : t.textSec
  const txtMuted = dark ? "rgba(255,255,255,0.35)" : t.textMuted

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
    <Card dark={dark} accent={ACCENT.meal} style={fill ? { flex: 1, minHeight: 0 } : {}}>
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
                    fontWeight: isToday ? 700 : 500, color: isToday ? ACCENT.meal : txtSec,
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
                          color: txtColor, textAlign: "right", background: "transparent",
                          border: "none", outline: "none", borderBottom: `2px solid ${ACCENT.meal}`,
                          padding: "1px 0", width: "100%", maxWidth: 180,
                        }} />
                    ) : (
                      <span style={{
                        fontFamily: "Nunito, sans-serif", fontSize: fill ? 13 : 12,
                        fontWeight: isToday ? 700 : 500,
                        color: mealText ? txtColor : txtMuted,
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

// Veckonavigator + MealCard — samma logik men hämtar meals för vald vecka.
// Tillåter användaren att bläddra framåt/bakåt och planera mat.
function MealWeekNavigator({ householdId, currentWeekStart, dark }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [meals, setMeals] = useState([])

  const weekStart = useMemo(() => {
    const cur = new Date(currentWeekStart + "T00:00:00")
    const d = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + weekOffset * 7)
    return fmtDate(d)
  }, [currentWeekStart, weekOffset])

  // Load meals för vald vecka + realtime-sub
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    supabase.from("meals").select("*").eq("household_id", householdId).eq("week_start_date", weekStart)
      .then(({ data }) => { if (!cancelled) setMeals(data || []) })
    const ch = supabase.channel("meals-nav:" + householdId + ":" + weekStart).on("postgres_changes", {
      event: "*", schema: "public", table: "meals", filter: "household_id=eq." + householdId,
    }, p => {
      const row = p.new || p.old
      if (!row || row.week_start_date !== weekStart) return
      setMeals(prev => {
        if (p.eventType === "INSERT") return prev.some(m => m.id === p.new.id) ? prev : [...prev, p.new]
        if (p.eventType === "UPDATE") return prev.map(m => m.id === p.new.id ? p.new : m)
        if (p.eventType === "DELETE") return prev.filter(m => m.id !== p.old.id)
        return prev
      })
    }).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId, weekStart])

  async function setMealText(weekday, text) {
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
      const tmp = { id: "tmp-" + Date.now(), household_id: householdId, week_start_date: weekStart, weekday, meal_text: text }
      setMeals(p => [...p, tmp])
      const { data, error } = await supabase.from("meals").insert({ household_id: householdId, week_start_date: weekStart, weekday, meal_text: text }).select().single()
      if (error) setMeals(p => p.filter(m => m.id !== tmp.id))
      else setMeals(p => p.map(m => m.id === tmp.id ? data : m))
    }
  }

  async function setMealTag(weekday, tag) {
    const ex = meals.find(m => m.weekday === weekday)
    if (ex) {
      setMeals(p => p.map(m => m.id === ex.id ? { ...m, tag } : m))
      await supabase.from("meals").update({ tag }).eq("id", ex.id)
    } else if (tag) {
      const tmp = { id: "tmp-" + Date.now(), household_id: householdId, week_start_date: weekStart, weekday, meal_text: "", tag }
      setMeals(p => [...p, tmp])
      const { data, error } = await supabase.from("meals").insert({ household_id: householdId, week_start_date: weekStart, weekday, meal_text: "", tag }).select().single()
      if (error) setMeals(p => p.filter(m => m.id !== tmp.id))
      else setMeals(p => p.map(m => m.id === tmp.id ? data : m))
    }
  }

  const mealsByWeekday = useMemo(() => {
    const m = {}
    meals.forEach(meal => { m[meal.weekday] = meal })
    return m
  }, [meals])
  const tagsByWeekday = useMemo(() => {
    const map = {}
    meals.forEach(m => { if (m.tag) map[m.weekday] = m.tag })
    return map
  }, [meals])

  const wsDate = new Date(weekStart + "T00:00:00")
  const weDate = new Date(wsDate.getFullYear(), wsDate.getMonth(), wsDate.getDate() + 6)
  const weekNum = isoWeekNumber(wsDate)
  const sameMonth = wsDate.getMonth() === weDate.getMonth()
  const rangeLabel = sameMonth
    ? `${wsDate.getDate()}–${weDate.getDate()} ${MONTHS_SHORT[wsDate.getMonth()]}`
    : `${wsDate.getDate()} ${MONTHS_SHORT[wsDate.getMonth()]} – ${weDate.getDate()} ${MONTHS_SHORT[weDate.getMonth()]}`

  return (
    <div>
      {/* Vecko-navigator */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", marginBottom: 10,
        background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 12,
      }}>
        <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: t.textSec, display: "flex" }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 15, fontWeight: 700, color: t.text }}>
            v.{weekNum} · {rangeLabel}
          </div>
          {weekOffset === 0 && (
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: ACCENT.meal, fontWeight: 700, marginTop: 2 }}>Denna vecka</div>
          )}
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{
              background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2,
              fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, textDecoration: "underline",
            }}>Tillbaka till denna vecka</button>
          )}
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: t.textSec, display: "flex" }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <MealCard
        mealsByWeekday={mealsByWeekday}
        mealTagsLocal={tagsByWeekday}
        onSetMealText={setMealText}
        onSetMealTag={setMealTag}
        dark={dark}
      />
    </div>
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

      <MealWeekNavigator householdId={householdId} currentWeekStart={currentWeekStart} />

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

function ProfileSection({ onBack, session, themeColor, setThemeColor, displayName, onSaveDisplayName, pushStatus, onEnablePush, onDisablePush }) {
  const email = session?.user?.email || ""
  const initial = (displayName?.[0] || email[0] || "?").toUpperCase()
  const [name, setName] = useState(displayName || "")
  const [savedAt, setSavedAt] = useState(null)
  useEffect(() => { setName(displayName || "") }, [displayName])
  // Debouncad save vid redigering
  useEffect(() => {
    if (name === (displayName || "")) return
    const ti = setTimeout(() => {
      onSaveDisplayName(name)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 1500)
    }, 600)
    return () => clearTimeout(ti)
  }, [name, displayName, onSaveDisplayName])
  return (
    <div>
      <SectionHeader title="Profil" onBack={onBack} />
      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: `${themeColor}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 32, fontWeight: 700, color: themeColor }}>{initial}</span>
          </div>
          <Btn small outline><Edit3 size={12} /> Byt profilbild (TODO: storage)</Btn>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec }}>Visningsnamn</span>
                {savedAt && <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: ACCENT.todo, fontWeight: 700 }}>✓ Sparat</span>}
              </div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. Ludvig" style={{ ...inputStyle, fontSize: 14, width: "100%", marginTop: 4 }} />
              <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, margin: "4px 0 0" }}>
                Visas i kalender, listor och chatten istället för din e-post.
              </p>
            </div>
            <div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: t.textSec }}>E-post</span>
              <input value={email} disabled style={{ ...inputStyle, fontSize: 14, width: "100%", marginTop: 4, opacity: 0.6 }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Push-notiser */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 16 }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>🔔 Notiser</div>
          {pushStatus === "unsupported" && (
            <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textMuted, margin: "0 0 8px" }}>
              Den här webbläsaren stödjer inte push-notiser.
            </p>
          )}
          {pushStatus === "denied" && (
            <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#dc2626", margin: "0 0 8px" }}>
              Notiser blockerade. Aktivera i webbläsarens inställningar.
            </p>
          )}
          {pushStatus !== "unsupported" && pushStatus !== "denied" && (
            <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, margin: "0 0 12px" }}>
              {pushStatus === "subscribed"
                ? "Du får notiser om event-påminnelser och när andra gör saker i hushållet."
                : "Aktivera så får du notiser för event-påminnelser och hushållsaktivitet."}
              {" "}<strong>iPhone:</strong> Lägg till på hemskärm först (Safari → Dela → Lägg till på hemskärm).
            </p>
          )}
          {pushStatus === "subscribed" ? (
            <Btn small outline color="#dc2626" onClick={onDisablePush}>
              <BellOff size={12} /> Stäng av notiser
            </Btn>
          ) : pushStatus !== "unsupported" && pushStatus !== "denied" ? (
            <Btn small color={ACCENT.calendar} onClick={onEnablePush}>
              <Bell size={12} /> Aktivera notiser
            </Btn>
          ) : null}
        </div>
      </Card>

      {/* Tema-väljare */}
      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>🎨 Tema-färg</div>
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: t.textSec, margin: "0 0 12px" }}>
            Välj din primärfärg. Påverkar knappar, sidebar och accenter på din enhet.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {THEME_PRESETS.map(p => {
              const active = themeColor === p.color
              return (
                <button key={p.id} onClick={() => setThemeColor(p.color)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "8px 6px", borderRadius: 12,
                  background: active ? `${p.color}15` : "transparent",
                  border: active ? `2px solid ${p.color}` : `2px solid transparent`,
                  cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  minWidth: 60,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 16, background: p.color,
                    boxShadow: active ? `0 2px 8px ${p.color}50` : "0 1px 3px rgba(0,0,0,0.1)",
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: active ? p.color : t.textSec }}>{p.label}</span>
                </button>
              )
            })}
          </div>
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, margin: "12px 0 0" }}>
            Sparas lokalt på din enhet. Andra familjemedlemmar har egna val.
          </p>
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

// Liten visuell mini-preview för varje layout
function LayoutPresetMini({ layoutKey, active }) {
  const preset = LAYOUT_PRESETS[layoutKey]
  const color = active ? ACCENT.calendar : t.textMuted
  const cellStyle = {
    background: `${color}25`,
    border: `1px solid ${color}50`,
    borderRadius: 2,
  }
  const W = 32, H = 50
  // Specialfall för sidebar
  if (preset.sidebarLayout) {
    return (
      <div style={{ width: W, height: H, display: "flex", gap: 2 }}>
        <div style={{ ...cellStyle, flex: 1 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ ...cellStyle, flex: 1 }} />
          <div style={{ ...cellStyle, flex: 1 }} />
        </div>
      </div>
    )
  }
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", gap: 2 }}>
      {preset.rows.map((row, ri) => (
        <div key={ri} style={{ flex: row.flex, display: "flex", gap: 2 }}>
          {row.slots.map((s, si) => (
            <div key={si} style={{ ...cellStyle, flex: s.flex }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function TvEditorSection({ onBack, isMobile, tvData, tvSlots, onSaveTvSlots, tvPhotoUrl, onSaveTvPhoto, onUploadTvPhoto }) {
  const [slots, setSlots] = useState(() => ({ ...DEFAULT_TV_SLOTS, ...(tvSlots || {}) }))
  const [pickerOpen, setPickerOpen] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const scale = isMobile ? 0.45 : 0.55

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError(null)
    const result = await onUploadTvPhoto(file)
    setUploading(false)
    if (!result?.ok) setUploadError(result?.error || "Uppladdning misslyckades")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

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
  // Byter aktiv layout. Slot-keys ändras → använder defaults för nya, behåller widget-val där samma key finns.
  function changeLayout(newLayout) {
    const preset = LAYOUT_PRESETS[newLayout]
    if (!preset) return
    const newSlots = { layout: newLayout, ...preset.defaults }
    // Behåll redan-valda widgets för slot-keys som är samma i båda layouts
    preset.slots.forEach(key => {
      if (slots[key]) newSlots[key] = slots[key]
    })
    setSlots(newSlots)
    saveSlots(newSlots)
  }
  const currentLayout = slots.layout || "standard"

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

      <Card style={{ marginBottom: 12 }}>
        <div style={{ padding: 14 }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>📐 Layout</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8 }}>
            {Object.entries(LAYOUT_PRESETS).map(([key, preset]) => {
              const active = currentLayout === key
              return (
                <button key={key} onClick={() => changeLayout(key)} style={{
                  padding: "10px 8px", borderRadius: 10,
                  background: active ? `${ACCENT.calendar}10` : t.inputBg,
                  border: active ? `2px solid ${ACCENT.calendar}` : "2px solid transparent",
                  cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  textAlign: "center",
                }}>
                  <LayoutPresetMini layoutKey={key} active={active} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: active ? ACCENT.calendar : t.text }}>{preset.label}</span>
                  <span style={{ fontSize: 9, color: t.textMuted, lineHeight: 1.2 }}>{preset.description}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Card>

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
            Ladda upp en bild — visas som banner högst upp på TV:n. Bra för familjebild, semesterminne eller stämningsbild.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFilePick}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn small color={ACCENT.calendar} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Laddar upp..." : <>📁 Välj bild från enheten</>}
            </Btn>
            {tvPhotoUrl && (
              <Btn small outline color="#dc2626" onClick={() => onSaveTvPhoto(null)}>
                <X size={12} /> Ta bort
              </Btn>
            )}
          </div>

          {uploadError && (
            <div style={{ marginTop: 8, fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#dc2626" }}>
              ⚠ {uploadError}
            </div>
          )}

          {tvPhotoUrl && (
            <div style={{ marginTop: 10, height: 80, borderRadius: 8, backgroundImage: `url("${tvPhotoUrl}")`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${t.cardBorder}` }} />
          )}

          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: t.textMuted, margin: "8px 0 0" }}>
            JPG, PNG, WebP eller GIF · Max 10 MB
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
                Välj widget för {SLOT_LABELS[pickerOpen] || pickerOpen}
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

function SettingsTab({ isMobile, session, household, members, foodPrefs, setFoodPrefs, onCreateInvite, tvData, tvSlots, onSaveTvSlots, tvPhotoUrl, onSaveTvPhoto, onUploadTvPhoto, userId, themeColor, setThemeColor, displayName, onSaveDisplayName, pushStatus, onEnablePush, onDisablePush }) {
  const [activeSection, setActiveSection] = useState(null)
  const sections = [
    { id: "profile", icon: User, label: "Profil", desc: "Namn, profilbild" },
    { id: "tv", icon: Monitor, label: "TV-editor", desc: "Anpassa TV-vyn, widgets & layout" },
    { id: "household", icon: Users, label: "Hushåll & Medlemmar", desc: "Invite-kod, medlemmar" },
    { id: "food", icon: UtensilsCrossed, label: "Matpreferenser", desc: "Gillar, gillar inte, budget" },
    { id: "account", icon: LogOut, label: "Konto", desc: "Logga ut" },
  ]
  if (activeSection === "tv") return <TvEditorSection onBack={() => setActiveSection(null)} isMobile={isMobile} tvData={tvData} tvSlots={tvSlots} onSaveTvSlots={onSaveTvSlots} tvPhotoUrl={tvPhotoUrl} onSaveTvPhoto={onSaveTvPhoto} onUploadTvPhoto={onUploadTvPhoto} />
  if (activeSection === "profile") return <ProfileSection onBack={() => setActiveSection(null)} session={session} themeColor={themeColor} setThemeColor={setThemeColor} displayName={displayName} onSaveDisplayName={onSaveDisplayName} pushStatus={pushStatus} onEnablePush={onEnablePush} onDisablePush={onDisablePush} />
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
function AiChat({ position = "fixed", callAi, executeTool, transcribeAudio }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hej! Jag kan göra grejer i appen åt dig. Prova:\n• \"Lägg till mjölk på handlingslistan\"\n• \"Boka tandläkare imorgon kl 10\"\n• \"Bocka av äggen\"\n• \"Generera ny veckomeny\"\n• \"Vad äter vi på fredag?\"" },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const messagesEndRef = useRef(null)
  const recorderRef = useRef(null)
  // AI-historik i OpenAI-format (kumulerar mellan turer för löpande dialog).
  // Använder ref för att undvika stale-closure i async-handlern.
  const aiHistoryRef = useRef([])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function handleSend(overrideText) {
    const text = (typeof overrideText === "string" ? overrideText : input).trim()
    if (!text || loading) return

    // Säkerhetstimer: tvinga reset om något hänger > 60 sek
    let safetyTimer = null

    setMessages(p => [...p, { role: "user", text }])
    setInput("")
    setLoading(true)
    safetyTimer = setTimeout(() => {
      setLoading(false)
      setMessages(p => [...p, { role: "ai", text: "Tog för lång tid — försök igen." }])
    }, 60000)

    // Bygg upp historik LOKALT (inte bara via ref) så vi kan skicka senaste version
    let localHistory = [...aiHistoryRef.current, { role: "user", content: text }]

    try {
      // Steg 1: skicka till AI med full historik
      const data = await callAi("", localHistory)
      const { reply, tool_calls, assistant_message } = data || {}

      if (assistant_message) {
        localHistory.push(assistant_message)
      }

      if (reply) {
        setMessages(p => [...p, { role: "ai", text: reply }])
      }

      // Exekvera tool calls om några finns
      if (tool_calls && tool_calls.length > 0) {
        for (const tc of tool_calls) {
          let result
          try {
            result = await executeTool(tc.name, tc.arguments)
          } catch (e) {
            result = { ok: false, message: "Tool-fel: " + (e?.message || String(e)) }
          }
          localHistory.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result.ok ? result.message : ("Misslyckades: " + result.message),
          })
          setMessages(p => [...p, {
            role: "tool",
            text: (result.ok ? "✓ " : "✗ ") + result.message,
            ok: result.ok,
          }])
        }

        // Steg 2: skicka tillbaka tool-resultaten så AI:n kan ge naturlig sammanfattning
        try {
          const followup = await callAi("", localHistory)
          if (followup?.assistant_message) {
            localHistory.push(followup.assistant_message)
          }
          if (followup?.reply) {
            setMessages(p => [...p, { role: "ai", text: followup.reply }])
          }
        } catch (e) {
          console.warn("[ai followup failed]", e)
        }
      } else if (!reply) {
        setMessages(p => [...p, { role: "ai", text: "(tomt svar)" }])
      }

      // Spara uppdaterad historik. Trimma till senaste 30 meddelandena för att inte växa oändligt.
      aiHistoryRef.current = localHistory.slice(-30)
    } catch (e) {
      console.error("[ai chat error]", e)
      setMessages(p => [...p, { role: "ai", text: "Något gick fel: " + (e?.message || "okänt fel") }])
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  async function handleMic() {
    // Stoppa pågående inspelning — onstop tar hand om resten.
    if (listening && recorderRef.current) {
      try { recorderRef.current.stop() } catch {}
      return
    }
    if (transcribing || loading) return

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessages(p => [...p, { role: "ai", text: "Röstinmatning stöds inte i den här webbläsaren." }])
      return
    }
    if (!transcribeAudio) {
      setMessages(p => [...p, { role: "ai", text: "Röstinmatning är inte konfigurerad." }])
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      console.error("[mic getUserMedia]", e)
      const name = e?.name || ""
      const msg = (name === "NotAllowedError" || name === "SecurityError")
        ? "Mikrofonbehörighet nekad. Tillåt mikrofon i inställningarna."
        : name === "NotFoundError"
          ? "Ingen mikrofon hittades."
          : "Kunde inte starta mikrofonen: " + (e?.message || name || "okänt fel")
      setMessages(p => [...p, { role: "ai", text: msg }])
      return
    }

    const chunks = []
    let rec
    try {
      // Default mime: iOS Safari ger audio/mp4, Chrome ger audio/webm — Whisper accepterar båda.
      rec = new MediaRecorder(stream)
    } catch (e) {
      console.error("[mic MediaRecorder]", e)
      stream.getTracks().forEach(t => t.stop())
      setMessages(p => [...p, { role: "ai", text: "Kunde inte starta inspelning: " + (e?.message || "okänt fel") }])
      return
    }

    recorderRef.current = rec

    rec.ondataavailable = ev => { if (ev.data && ev.data.size > 0) chunks.push(ev.data) }
    rec.onerror = ev => { console.error("[mic recorder]", ev) }
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      recorderRef.current = null
      setListening(false)

      if (chunks.length === 0) {
        setMessages(p => [...p, { role: "ai", text: "Ingen inspelning gjord." }])
        return
      }

      const mime = rec.mimeType || "audio/mp4"
      const ext = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "m4a"
      const blob = new Blob(chunks, { type: mime })

      if (blob.size < 1000) {
        setMessages(p => [...p, { role: "ai", text: "Inspelningen var för kort. Försök igen." }])
        return
      }

      setTranscribing(true)
      try {
        const text = await transcribeAudio(blob, ext)
        if (!text) {
          setMessages(p => [...p, { role: "ai", text: "Inget tal upptäckt." }])
          return
        }
        // Auto-skicka direkt — riktig voice assistant.
        await handleSend(text)
      } catch (e) {
        console.error("[mic transcribe]", e)
        setMessages(p => [...p, { role: "ai", text: "Transkribering misslyckades: " + (e?.message || "okänt fel") }])
      } finally {
        setTranscribing(false)
      }
    }

    try {
      rec.start()
      setListening(true)
    } catch (e) {
      console.error("[mic start]", e)
      stream.getTracks().forEach(t => t.stop())
      recorderRef.current = null
      setMessages(p => [...p, { role: "ai", text: "Kunde inte starta inspelning: " + (e?.message || "okänt fel") }])
    }
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
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: "#dc2626" }}>Lyssnar... (tryck igen för att stoppa)</span>
        </div>
      )}
      {transcribing && (
        <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#f59e0b", animation: "pulse 1s infinite" }} />
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>Transkriberar...</span>
        </div>
      )}
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${t.line}`, display: "flex", gap: 6 }}>
        <button onClick={handleMic} disabled={transcribing} style={{
          width: 34, height: 34, borderRadius: 10, border: "none",
          cursor: transcribing ? "default" : "pointer",
          background: listening ? "#dc262615" : transcribing ? "#f59e0b15" : t.inputBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: transcribing ? 0.6 : 1,
        }}>
          <Mic size={14} color={listening ? "#dc2626" : transcribing ? "#f59e0b" : t.textSec} />
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
//  HOME EDIT BAR + DRAGGABLE WIDGET (mobile only)
// ════════════════════════════════════════════════
function HomeEditBar({ homeConfig, setHomeConfig, onDone, themeColor }) {
  function setGridMode(v) { setHomeConfig(c => ({ ...c, gridMode: v })) }
  function setShowWeather(v) { setHomeConfig(c => ({ ...c, showWeather: v })) }
  function resetDefaults() {
    if (confirm("Återställ Hem-vyn till standardlayouten?")) {
      setHomeConfig(DEFAULT_HOME_CONFIG)
    }
  }
  return (
    <div style={{
      background: `${themeColor}10`, border: `1px solid ${themeColor}40`, borderRadius: 14,
      padding: "12px 14px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "Comfortaa, sans-serif", fontWeight: 700, fontSize: 15, color: t.text }}>
          ✏️ Anpassa Hem
        </div>
        <button onClick={onDone} style={{
          background: themeColor, color: "#fff", border: "none", borderRadius: 8,
          padding: "6px 14px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>Klar</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Layout-toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>Layout</span>
          <div style={{ display: "flex", gap: 4, background: t.inputBg, borderRadius: 8, padding: 3 }}>
            <button onClick={() => setGridMode(false)} style={{
              padding: "5px 12px", border: "none", borderRadius: 6,
              background: !homeConfig.gridMode ? t.card : "transparent",
              color: !homeConfig.gridMode ? themeColor : t.textSec,
              fontWeight: !homeConfig.gridMode ? 700 : 500, fontSize: 12, cursor: "pointer",
              boxShadow: !homeConfig.gridMode ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
            }}>📜 Lista</button>
            <button onClick={() => setGridMode(true)} style={{
              padding: "5px 12px", border: "none", borderRadius: 6,
              background: homeConfig.gridMode ? t.card : "transparent",
              color: homeConfig.gridMode ? themeColor : t.textSec,
              fontWeight: homeConfig.gridMode ? 700 : 500, fontSize: 12, cursor: "pointer",
              boxShadow: homeConfig.gridMode ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
            }}>▦ Rutnät</button>
          </div>
        </div>

        {/* Väder-toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>Visa väder i toppen</span>
          <button onClick={() => setShowWeather(!homeConfig.showWeather)} style={{
            width: 44, height: 24, border: "none", borderRadius: 12, cursor: "pointer",
            background: homeConfig.showWeather ? themeColor : t.inputBorder,
            position: "relative", transition: "background 0.15s",
          }}>
            <div style={{
              position: "absolute", top: 2, left: homeConfig.showWeather ? 22 : 2,
              width: 20, height: 20, borderRadius: 10, background: "#fff",
              transition: "left 0.15s",
            }} />
          </button>
        </div>

        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4, marginTop: 4 }}>
          Dra widgets för att ändra ordning. Tryck på ögat för att dölja.
        </div>

        <button onClick={resetDefaults} style={{
          background: "transparent", border: `1px solid ${t.inputBorder}`,
          borderRadius: 8, padding: "6px 10px", fontSize: 12, color: t.textSec,
          fontFamily: "Nunito, sans-serif", cursor: "pointer", marginTop: 2,
        }}>↻ Återställ standard</button>
      </div>
    </div>
  )
}

// Widget-wrapper med drag-handle + visibility-toggle (visas bara i edit-mode)
function DraggableWidget({
  widgetId, idx, editMode, enabled, themeColor,
  isDragging, isDragTarget, onPointerDown, onToggleEnabled,
  fullWidthInGrid, gridMode, children,
}) {
  const meta = HOME_WIDGET_META[widgetId]
  if (!editMode && !enabled) return null
  const spans2 = gridMode && (fullWidthInGrid || !enabled)
  const opacity = isDragging ? 0.4 : (enabled ? 1 : 0.45)
  return (
    <div
      data-widget-idx={idx}
      data-widget-id={widgetId}
      style={{
        position: "relative",
        gridColumn: spans2 ? "1 / -1" : "auto",
        opacity, transition: isDragging ? "none" : "opacity 0.15s",
      }}
    >
      {/* Top: drop-indicator */}
      {isDragTarget && (
        <div style={{
          position: "absolute", top: -6, left: 0, right: 0, height: 3,
          background: themeColor, borderRadius: 2, pointerEvents: "none",
          boxShadow: `0 0 8px ${themeColor}80`,
        }} />
      )}

      {editMode && (
        <div style={{
          position: "absolute", top: -2, left: 0, right: 0, height: 28,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0 6px", zIndex: 5, pointerEvents: "none",
        }}>
          {/* Drag-handle (vänster) */}
          <div
            onPointerDown={(e) => { e.preventDefault(); onPointerDown(e) }}
            style={{
              pointerEvents: "auto", touchAction: "none",
              width: 32, height: 32, borderRadius: 8, background: themeColor,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "grab", boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              fontSize: 16,
            }}
            aria-label={`Dra ${meta?.label || widgetId}`}
          >⋮⋮</div>
          {/* Visibility toggle (höger) */}
          <button
            onClick={() => onToggleEnabled(widgetId)}
            style={{
              pointerEvents: "auto",
              width: 32, height: 32, borderRadius: 8, border: "none",
              background: enabled ? t.card : t.textMuted,
              color: enabled ? t.text : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              fontSize: 14,
            }}
            aria-label={enabled ? `Dölj ${meta?.label}` : `Visa ${meta?.label}`}
          >{enabled ? "👁" : "🚫"}</button>
        </div>
      )}

      {/* Widget-innehåll. Disabled = grå placeholder, enabled = riktigt innehåll */}
      {enabled ? (
        <div style={{
          outline: editMode ? `2px dashed ${themeColor}60` : "none",
          outlineOffset: 2, borderRadius: 18,
          paddingTop: editMode ? 32 : 0,
          transition: "padding-top 0.15s",
        }}>
          {children}
        </div>
      ) : (
        <div style={{
          background: t.inputBg, border: `1px dashed ${t.inputBorder}`,
          borderRadius: 14, padding: "20px 16px", marginTop: editMode ? 32 : 0,
          display: "flex", alignItems: "center", gap: 10,
          color: t.textMuted, fontSize: 13, fontStyle: "italic",
        }}>
          <span style={{ fontSize: 18 }}>{meta?.icon}</span>
          <span><strong>{meta?.label}</strong> är dold</span>
        </div>
      )}
    </div>
  )
}

// Mobil Hem-vy med customization + drag-and-drop reorder
function MobileHome({
  weather, calEvents, persons,
  pinnedList, onToggleItem,
  mealsByWeekday, mealTagsLocal, onSetMealText, onSetMealTag,
  countdowns, setTab,
  activity, members, userId,
  onOpenDayModal,
  homeConfig, setHomeConfig, editMode, setEditMode,
}) {
  const themeColor = getThemeColor()
  // ── Drag-state ──
  const [drag, setDrag] = useState(null) // { fromIdx, pointerId, startY, currentY, targetIdx }
  const containerRef = useRef(null)

  // Pointer down på drag-handle
  function handlePointerDown(fromIdx) {
    return (e) => {
      // Bara primary pointer (vänster mus / första finger)
      if (e.pointerType === "mouse" && e.button !== 0) return
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
      setDrag({
        fromIdx, pointerId: e.pointerId,
        startY: e.clientY, currentY: e.clientY,
        targetIdx: fromIdx,
      })
    }
  }

  // Beräkna vilken widget pekaren är över
  function computeTargetIdx(clientY) {
    if (!containerRef.current) return drag?.fromIdx ?? 0
    const widgets = containerRef.current.querySelectorAll("[data-widget-idx]")
    let best = drag?.fromIdx ?? 0
    for (const el of widgets) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (clientY < mid) {
        best = parseInt(el.dataset.widgetIdx, 10)
        return best
      }
      best = parseInt(el.dataset.widgetIdx, 10)
    }
    return best
  }

  // Pointer move/up — lyssna globalt så drag fortsätter även om fingret lämnar handle
  useEffect(() => {
    if (!drag) return
    function onMove(e) {
      if (e.pointerId !== drag.pointerId) return
      const newTarget = computeTargetIdx(e.clientY)
      setDrag(d => d ? { ...d, currentY: e.clientY, targetIdx: newTarget } : d)
    }
    function onUp(e) {
      if (e.pointerId !== drag.pointerId) return
      const { fromIdx, targetIdx } = drag
      if (fromIdx !== targetIdx) {
        setHomeConfig(c => {
          const arr = [...c.widgets]
          const [moved] = arr.splice(fromIdx, 1)
          arr.splice(targetIdx, 0, moved)
          return { ...c, widgets: arr }
        })
      }
      setDrag(null)
    }
    window.addEventListener("pointermove", onMove, { passive: false })
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.pointerId])

  function toggleWidgetEnabled(widgetId) {
    setHomeConfig(c => ({
      ...c,
      widgets: c.widgets.map(w => w.id === widgetId ? { ...w, enabled: !w.enabled } : w),
    }))
  }

  // Render varje widget-typ
  function renderWidget(id) {
    if (id === "calendar") return <HomeCalendar events={calEvents} persons={persons} onDayClick={d => onOpenDayModal(d)} isMobile={true} />
    if (id === "todo")     return <TodoCard pinnedList={pinnedList} onToggle={onToggleItem} />
    if (id === "meal")     return <MealCard mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal} onSetMealText={onSetMealText} onSetMealTag={onSetMealTag} />
    if (id === "countdown") return <BigCountdownWidget pinnedCountdown={countdowns.find(c => c.pinned && daysUntilDate(c.target_date) >= 0)} onOpenTab={() => setTab("nedrakning")} />
    if (id === "activity") return <ActivityFeed activity={activity} persons={persons} members={members} userId={userId} max={5} />
    return null
  }

  const showWeather = homeConfig.showWeather !== false
  const useGrid = !!homeConfig.gridMode

  return (
    <div style={{ padding: "20px 16px 16px" }}>
      {/* Header: klocka + väder + bell + ✏️ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <ClockDisplay size="small" />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {showWeather && <WeatherMini weather={weather} />}
          <NotificationBell activity={activity} persons={persons} members={members} userId={userId} />
          <button
            onClick={() => setEditMode(v => !v)}
            aria-label={editMode ? "Avsluta redigering" : "Anpassa Hem-vy"}
            style={{
              background: editMode ? themeColor : "transparent",
              color: editMode ? "#fff" : t.textSec,
              border: `1px solid ${editMode ? themeColor : t.inputBorder}`,
              borderRadius: 8, padding: "6px 8px", cursor: "pointer",
              fontSize: 13, marginLeft: 4, display: "flex", alignItems: "center",
            }}
          >{editMode ? "✓" : "✏️"}</button>
        </div>
      </div>

      {editMode && (
        <HomeEditBar
          homeConfig={homeConfig}
          setHomeConfig={setHomeConfig}
          onDone={() => setEditMode(false)}
          themeColor={themeColor}
        />
      )}

      <div
        ref={containerRef}
        style={{
          display: useGrid ? "grid" : "flex",
          flexDirection: useGrid ? undefined : "column",
          gridTemplateColumns: useGrid ? "1fr 1fr" : undefined,
          gap: 12,
          touchAction: drag ? "none" : "auto",
        }}
      >
        {homeConfig.widgets.map((w, idx) => {
          const meta = HOME_WIDGET_META[w.id]
          if (!meta) return null
          return (
            <DraggableWidget
              key={w.id}
              widgetId={w.id}
              idx={idx}
              editMode={editMode}
              enabled={w.enabled}
              themeColor={themeColor}
              isDragging={drag?.fromIdx === idx}
              isDragTarget={drag && drag.targetIdx === idx && drag.fromIdx !== idx}
              onPointerDown={handlePointerDown(idx)}
              onToggleEnabled={toggleWidgetEnabled}
              fullWidthInGrid={meta.fullWidthInGrid}
              gridMode={useGrid}
            >
              {renderWidget(w.id)}
            </DraggableWidget>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
//  TAB CONTENT (shared between Mobile & Desktop)
// ════════════════════════════════════════════════
function TabContent({
  tab, setTab, isMobile, weather,
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
  tvPhotoUrl, onSaveTvPhoto, onUploadTvPhoto,
  themeColor, setThemeColor,
  displayName, onSaveDisplayName,
  pushStatus, onEnablePush, onDisablePush,
  // activity + countdowns + meal history
  activity, countdowns, onAddCountdown, onDeleteCountdown, onTogglePinCountdown,
  householdIdProp, currentWeekStart,
  // shopping
  shoppingItems, onAddShoppingItem, onToggleShoppingItem, onDeleteShoppingItem, onClearCheckedShopping,
  listsTopTab, setListsTopTab,
  // home customization
  homeConfig, setHomeConfig, homeEditMode, setHomeEditMode,
}) {
  const pad = isMobile ? "16px 16px 16px" : "24px 28px"
  if (tab === "hem") {
    // Desktop: oförändrad ursprungslayout (ingen customization än)
    if (!isMobile) {
      return (
        <div style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>Hem</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <WeatherMini weather={weather} />
              <NotificationBell activity={activity} persons={persons} members={members} userId={userId} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <HomeCalendar events={calEvents} persons={persons} onDayClick={d => onOpenDayModal(d)} isMobile={isMobile} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <TodoCard pinnedList={pinnedList} onToggle={onToggleItem} />
              <MealCard mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal} onSetMealText={onSetMealText} onSetMealTag={onSetMealTag} />
            </div>
            <BigCountdownWidget pinnedCountdown={countdowns.find(c => c.pinned && daysUntilDate(c.target_date) >= 0)} onOpenTab={() => setTab("nedrakning")} />
            <ActivityFeed activity={activity} persons={persons} members={members} userId={userId} max={5} />
          </div>
        </div>
      )
    }
    // Mobile: customizable
    return (
      <MobileHome
        weather={weather}
        calEvents={calEvents} persons={persons}
        pinnedList={pinnedList} onToggleItem={onToggleItem}
        mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal}
        onSetMealText={onSetMealText} onSetMealTag={onSetMealTag}
        countdowns={countdowns} setTab={setTab}
        activity={activity} members={members} userId={userId}
        onOpenDayModal={onOpenDayModal}
        homeConfig={homeConfig} setHomeConfig={setHomeConfig}
        editMode={homeEditMode} setEditMode={setHomeEditMode}
      />
    )
  }
  if (tab === "kalender") return <div style={{ padding: pad }}><CalendarTab isMobile={isMobile} events={calEvents} persons={persons} onAddEvent={onAddEvent} onDeleteEvent={onDeleteEvent} onOpenAddEvent={onOpenAddEvent} onOpenDayModal={onOpenDayModal} userId={userId} /></div>
  if (tab === "listor") {
    return (
      <div style={{ padding: pad }}>
        <h2 style={{ fontFamily: "Comfortaa, sans-serif", fontSize: isMobile ? 22 : 24, fontWeight: 700, color: t.text, margin: "0 0 14px" }}>Listor</h2>
        <ListsTopTabs
          mode={listsTopTab}
          setMode={setListsTopTab}
          todoActiveCount={listsWithItems.length}
          todoArchivedCount={archivedLists.length}
          shoppingItems={shoppingItems}
        />
        {listsTopTab === "todo" && (
          <>
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
                userId={userId}
              />
            )}
          </>
        )}
        {listsTopTab === "shopping" && (
          <ShoppingList
            items={shoppingItems}
            onAdd={onAddShoppingItem}
            onToggle={onToggleShoppingItem}
            onDelete={onDeleteShoppingItem}
            onClearChecked={onClearCheckedShopping}
          />
        )}
      </div>
    )
  }
  if (tab === "mat") return <div style={{ padding: pad }}><MealTab isMobile={isMobile} mealsByWeekday={mealsByWeekday} mealTagsLocal={mealTagsLocal} onSetMealText={onSetMealText} onSetMealTag={onSetMealTag} foodPrefs={foodPrefs} setFoodPrefs={setFoodPrefs} onAiGenerate={onAiGenerate} householdId={householdIdProp} currentWeekStart={currentWeekStart} /></div>
  if (tab === "nedrakning") return (
    <div style={{ padding: pad }}>
      <CountdownsTab
        isMobile={isMobile}
        countdowns={countdowns}
        onAdd={onAddCountdown}
        onDelete={onDeleteCountdown}
        onTogglePin={onTogglePinCountdown}
      />
    </div>
  )
  if (tab === "mer") return (
    <div style={{ padding: pad }}>
      <SettingsTab isMobile={isMobile} session={session} household={household} members={members}
        foodPrefs={foodPrefs} setFoodPrefs={setFoodPrefs}
        onCreateInvite={onCreateInvite}
        tvData={tvData} tvSlots={tvSlots} onSaveTvSlots={onSaveTvSlots}
        tvPhotoUrl={tvPhotoUrl} onSaveTvPhoto={onSaveTvPhoto} onUploadTvPhoto={onUploadTvPhoto}
        userId={userId}
        themeColor={themeColor} setThemeColor={setThemeColor}
        displayName={displayName} onSaveDisplayName={onSaveDisplayName}
        pushStatus={pushStatus} onEnablePush={onEnablePush} onDisablePush={onDisablePush} />
    </div>
  )
  return null
}

// ════════════════════════════════════════════════
//  LAYOUTS
// ════════════════════════════════════════════════
function MobileNav({ tab, setTab, themeColor = ACCENT.calendar }) {
  const tabs = [
    { id: "hem", icon: Home, label: "Hem" },
    { id: "kalender", icon: CalendarDays, label: "Kalender" },
    { id: "listor", icon: ListChecks, label: "Listor" },
    { id: "mat", icon: UtensilsCrossed, label: "Mat" },
    { id: "nedrakning", icon: Sparkles, label: "Räknare" },
    { id: "mer", icon: MoreHorizontal, label: "Mer" },
  ]
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: t.card, borderTop: `1px solid ${t.cardBorder}`, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 0 16px", paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))", zIndex: 100 }}>
      {tabs.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => setTab(id)} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          padding: "4px 12px", opacity: tab === id ? 1 : 0.4, transition: "opacity 0.2s",
        }}>
          <Icon size={20} color={tab === id ? themeColor : t.text} strokeWidth={tab === id ? 2.5 : 1.8} />
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: tab === id ? 700 : 500, color: tab === id ? themeColor : t.textSec }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

function DesktopSidebar({ tab, setTab, session, weather, household, themeColor = ACCENT.calendar }) {
  const items = [
    { id: "hem", icon: Home, label: "Hem" },
    { id: "kalender", icon: CalendarDays, label: "Kalender" },
    { id: "listor", icon: ListChecks, label: "Listor" },
    { id: "mat", icon: UtensilsCrossed, label: "Mat" },
    { id: "nedrakning", icon: Sparkles, label: "Nedräkningar" },
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
              background: active ? `${themeColor}10` : "transparent",
              border: "none", cursor: "pointer",
            }}>
              <Icon size={18} color={active ? themeColor : t.textSec} strokeWidth={active ? 2.4 : 1.8} />
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: active ? 700 : 500, color: active ? t.text : t.textSec }}>{label}</span>
            </button>
          )
        })}
      </div>
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${t.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: `${themeColor}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 13, fontWeight: 700, color: themeColor }}>{initial}</span>
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
  { id: "calendar",  label: "Kalender", color: ACCENT.calendar, icon: CalendarDays },
  { id: "todo",      label: "Att göra", color: ACCENT.todo,     icon: ListChecks },
  { id: "shopping",  label: "Inköp",    color: ACCENT.todo,     icon: ShoppingCart },
  { id: "meal",      label: "Matsedel", color: ACCENT.meal,     icon: UtensilsCrossed },
  { id: "events",    label: "Dagens händelser", color: ACCENT.event, icon: CalendarDays },
  { id: "countdown", label: "Nedräkning", color: "#db2777", icon: Sparkles },
  { id: "empty",     label: "Tom",      color: t.textMuted,     icon: X },
]
const DEFAULT_TV_SLOTS = { layout: "standard", main: "calendar", bottomLeft: "todo", bottomRight: "meal" }
const SLOT_LABELS = {
  main: "huvud-rutan",
  top: "övre rutan",
  middle: "mellersta rutan",
  bottom: "nedre rutan",
  topLeft: "övre vänster",
  topRight: "övre höger",
  bottomLeft: "nedre vänster",
  bottomRight: "nedre höger",
  left: "vänstra rutan",
}

// Layout-presets för TV-vyn. Varje preset definierar slot-keys + flex-storlekar.
const LAYOUT_PRESETS = {
  standard: {
    label: "Klassisk",
    description: "Stor topp + 2 små i botten",
    slots: ["main", "bottomLeft", "bottomRight"],
    defaults: { main: "calendar", bottomLeft: "todo", bottomRight: "meal" },
    // Visuellt mönster: rader med flex
    rows: [
      { flex: 6, slots: [{ key: "main", flex: 1 }] },
      { flex: 4, slots: [{ key: "bottomLeft", flex: 1 }, { key: "bottomRight", flex: 1 }] },
    ],
  },
  stacked: {
    label: "Tre staplade",
    description: "3 lika stora rader",
    slots: ["top", "middle", "bottom"],
    defaults: { top: "calendar", middle: "todo", bottom: "meal" },
    rows: [
      { flex: 1, slots: [{ key: "top", flex: 1 }] },
      { flex: 1, slots: [{ key: "middle", flex: 1 }] },
      { flex: 1, slots: [{ key: "bottom", flex: 1 }] },
    ],
  },
  quad: {
    label: "Rutnät 2×2",
    description: "Fyra lika stora rutor",
    slots: ["topLeft", "topRight", "bottomLeft", "bottomRight"],
    defaults: { topLeft: "calendar", topRight: "events", bottomLeft: "todo", bottomRight: "meal" },
    rows: [
      { flex: 1, slots: [{ key: "topLeft", flex: 1 }, { key: "topRight", flex: 1 }] },
      { flex: 1, slots: [{ key: "bottomLeft", flex: 1 }, { key: "bottomRight", flex: 1 }] },
    ],
  },
  hero: {
    label: "En stor",
    description: "En widget fyller hela",
    slots: ["main"],
    defaults: { main: "calendar" },
    rows: [
      { flex: 1, slots: [{ key: "main", flex: 1 }] },
    ],
  },
  sidebar: {
    label: "Sido-stack",
    description: "Hög vänster, 2 högt höger",
    slots: ["left", "topRight", "bottomRight"],
    defaults: { left: "calendar", topRight: "todo", bottomRight: "meal" },
    rows: [], // Renderas som horisontellt flex (inte rader) — hanteras separat
    sidebarLayout: true,
  },
}

// Standardiserad widget-renderer för TV-slots
function renderTvSlotWidget(type, p) {
  if (type === "calendar") return <CalendarWidget events={p.calEvents} persons={p.persons} fill onDayClick={p.onDayClick} dark={p.dark} />
  if (type === "todo")     return <TodoCard pinnedList={p.pinnedList} onToggle={p.onToggleItem} fill dark={p.dark} />
  if (type === "shopping") return <ShoppingCard items={p.shoppingItems || []} onToggle={p.onToggleShoppingItem} onAdd={p.onAddShoppingItem} fill dark={p.dark} virtualKeyboard />
  if (type === "meal")     return <MealCard fill mealsByWeekday={p.mealsByWeekday} mealTagsLocal={p.mealTagsLocal} onSetMealText={() => {}} onSetMealTag={() => {}} dark={p.dark} />
  if (type === "events")   return <TvEventsCard events={p.calEvents} persons={p.persons} dark={p.dark} />
  if (type === "countdown") return <TvCountdownCard countdowns={p.countdowns} dark={p.dark} />
  if (type === "empty")    return <div style={{ flex: 1, background: p.dark ? "rgba(255,255,255,0.04)" : t.inputBg, borderRadius: 14, border: `1px dashed ${p.dark ? "rgba(255,255,255,0.1)" : t.cardBorder}` }} />
  return null
}

// Stor kvadratisk countdown-widget för TV-vyn — visar pinned countdown med fokus på siffran
function TvCountdownCard({ countdowns, dark }) {
  const today = new Date()
  const todayStr = fmtDate(today)
  const upcoming = (countdowns || []).filter(c => c.target_date >= todayStr).sort((a, b) => a.target_date.localeCompare(b.target_date))
  const c = upcoming.find(x => x.pinned) || upcoming[0]
  const txtColor = dark ? "#e8eaf0" : t.text
  const txtMuted = dark ? "rgba(255,255,255,0.5)" : t.textMuted

  if (!c) {
    return (
      <Card dark={dark} accent="#db2777" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 0 }}>
          <div style={{ fontSize: 28 }}>🎯</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: txtMuted, textAlign: "center" }}>
            Inga nedräkningar
          </div>
        </div>
      </Card>
    )
  }

  const days = daysUntilDate(c.target_date)
  const isToday = days === 0
  const dateStr = new Date(c.target_date + "T00:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short" })

  return (
    <Card dark={dark} accent={c.color} style={{ flex: 1, minHeight: 0 }}>
      <div style={{
        padding: "10px 12px",
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        background: dark ? `linear-gradient(135deg, ${c.color}30, ${c.color}10)` : `linear-gradient(135deg, ${c.color}12, ${c.color}04)`,
        minHeight: 0, overflow: "hidden",
      }}>
        {c.emoji && <div style={{ fontSize: 22, lineHeight: 1 }}>{c.emoji}</div>}
        {isToday ? (
          <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 32, fontWeight: 700, color: c.color, lineHeight: 1 }}>IDAG!</div>
        ) : (
          <>
            <div style={{
              fontFamily: "Comfortaa, sans-serif",
              fontSize: 60, fontWeight: 700,
              color: c.color, lineHeight: 0.95, letterSpacing: "-0.04em",
            }}>{days}</div>
            <div style={{
              fontFamily: "Nunito, sans-serif", fontSize: 9, fontWeight: 700,
              color: c.color, opacity: 0.85,
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>{days === 1 ? "DAG KVAR" : "DAGAR KVAR"}</div>
          </>
        )}
        <div style={{
          fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700,
          color: txtColor, marginTop: 4, textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
        }}>{c.title}</div>
        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: txtMuted }}>{dateStr}</div>
      </div>
    </Card>
  )
}

// Lista över dagens & kommande händelser — TV-vänlig
function TvEventsCard({ events, persons, dark }) {
  const upcoming = useMemo(() => {
    const now = new Date()
    return events
      .filter(e => new Date(e.start_time) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 6)
  }, [events])
  const txtColor = dark ? "#e8eaf0" : t.text
  const txtMuted = dark ? "rgba(255,255,255,0.5)" : t.textMuted
  return (
    <Card dark={dark} accent={ACCENT.event} style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Label color={ACCENT.event} icon={CalendarDays}>Kommande</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, flex: 1, overflow: "hidden" }}>
          {upcoming.length === 0 && <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: txtMuted, fontStyle: "italic" }}>Inget inplanerat</span>}
          {upcoming.map(ev => {
            const p = getPersonForEvent(ev, persons)
            const d = new Date(ev.start_time)
            return (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: dark ? `${p.color}25` : `${p.color}08`, borderRadius: 8, border: `1px solid ${p.color}30` }}>
                <div style={{ width: 3, height: 22, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 9, color: txtMuted }}>
                    {d.getDate()} {MONTHS_SHORT[d.getMonth()]} · {fmtTime(ev.start_time)}
                  </div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: txtColor, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
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
// Renderar slot-grid baserat på vald layout
function TvLayoutGrid({ layoutKey, slots, widgetProps, slotOverlay }) {
  const preset = LAYOUT_PRESETS[layoutKey] || LAYOUT_PRESETS.standard
  // minWidth: 0 viktigt — låter flex-items shrinka istället för att tvinga overflow
  const slotStyle = (flex) => ({ flex, display: "flex", minHeight: 0, minWidth: 0, position: "relative", overflow: "hidden" })

  // Sidebar-layouten är speciell: horisontell delning
  if (preset.sidebarLayout) {
    return (
      <div style={{ flex: 1, display: "flex", gap: 10, minHeight: 0, minWidth: 0 }}>
        <div style={slotStyle(1)}>
          {renderTvSlotWidget(slots.left, widgetProps)}
          {slotOverlay && slotOverlay("left", slots.left)}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minHeight: 0, minWidth: 0 }}>
          <div style={slotStyle(1)}>
            {renderTvSlotWidget(slots.topRight, widgetProps)}
            {slotOverlay && slotOverlay("topRight", slots.topRight)}
          </div>
          <div style={slotStyle(1)}>
            {renderTvSlotWidget(slots.bottomRight, widgetProps)}
            {slotOverlay && slotOverlay("bottomRight", slots.bottomRight)}
          </div>
        </div>
      </div>
    )
  }
  // Vanlig rad-baserad layout
  return (
    <>
      {preset.rows.map((row, ri) => (
        <div key={ri} style={{ flex: row.flex, display: "flex", gap: 10, minHeight: 0, minWidth: 0 }}>
          {row.slots.map(s => (
            <div key={s.key} style={slotStyle(s.flex)}>
              {renderTvSlotWidget(slots[s.key], widgetProps)}
              {slotOverlay && slotOverlay(s.key, slots[s.key])}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function TvViewContent({ persons, calEvents, pinnedList, onToggleItem, mealsByWeekday, mealTagsLocal, weather, slots, slotOverlay, onDayClick, photoUrl, countdowns, shoppingItems, onAddShoppingItem, onToggleShoppingItem, dark }) {
  const s = { ...DEFAULT_TV_SLOTS, ...(slots || {}) }
  const layoutKey = s.layout || "standard"
  const widgetProps = { persons, calEvents, pinnedList, onToggleItem, mealsByWeekday, mealTagsLocal, onDayClick, countdowns, shoppingItems, onAddShoppingItem, onToggleShoppingItem, dark }

  // Färgsystem för dark mode på TV
  const tvBg = dark ? "#0a0b14" : t.bg
  const tvText = dark ? "#e8eaf0" : t.text
  const tvTextSec = dark ? "rgba(255,255,255,0.65)" : t.textSec
  const tvTextMuted = dark ? "rgba(255,255,255,0.35)" : t.textMuted
  const tvCardBg = dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)"
  const tvCardBorder = dark ? "rgba(255,255,255,0.1)" : t.cardBorder
  const photoOverlay = dark ? "rgba(10,11,20,0.65)" : "rgba(240,242,245,0.55)"

  return (
    <div style={{
      width: "100%", height: "100%",
      background: tvBg,
      backgroundImage: photoUrl ? `url("${photoUrl}")` : undefined,
      backgroundSize: "cover",
      backgroundPosition: "center",
      fontFamily: "Nunito, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
      boxSizing: "border-box",
      position: "relative",
      transition: "background 0.6s ease",
    }}>
      {photoUrl && (
        <div style={{
          position: "absolute", inset: 0,
          background: photoOverlay,
          backdropFilter: "blur(1px)",
          pointerEvents: "none",
          transition: "background 0.6s ease",
        }} />
      )}
      <div style={{ position: "relative", zIndex: 1, padding: "24px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* ClockDisplay får dark-tema via inline override */}
        <div style={{ color: tvText }}>
          <ClockDisplay size="huge" textColor={tvText} secColor={tvTextSec} />
        </div>
        <div style={{ textAlign: "right" }}>
          {weather ? <>
            <WmoIcon code={weather.code} size={40} color={dark ? "#7dd3fc" : ACCENT.weather} />
            <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 32, fontWeight: 300, color: tvText }}>{weather.temp}°</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: tvTextMuted }}>{weather.desc}</div>
          </> : <span style={{ color: tvTextMuted, fontSize: 12 }}>—</span>}
        </div>
      </div>
      {weather?.forecast && (
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 8, padding: "0 20px 12px" }}>
          {weather.forecast.map(f => (
            <div key={f.day} style={{
              flex: 1, background: tvCardBg, borderRadius: 10, padding: "5px 0", textAlign: "center",
              border: `1px solid ${tvCardBorder}`,
              boxShadow: dark ? "0 1px 2px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.03)",
              backdropFilter: dark ? "blur(8px)" : "none",
            }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 700, color: tvTextMuted, letterSpacing: "0.05em" }}>{f.day}</div>
              <WmoIcon code={f.code} size={16} color={tvTextSec} />
              <div style={{ fontFamily: "Comfortaa, sans-serif", fontSize: 11, fontWeight: 600, color: tvTextSec }}>{f.temp}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", padding: "0 16px 16px", gap: 10, minHeight: 0 }}>
        <TvLayoutGrid layoutKey={layoutKey} slots={s} widgetProps={widgetProps} slotOverlay={slotOverlay} />
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
      transition: "background 0.6s ease",
    }}>
      <style>{"html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important}"}</style>
      <TvViewContent {...props} dark={isNight} />
      {isNight && (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 50,
          background: "rgba(255,255,255,0.08)", borderRadius: 8,
          padding: "3px 10px", display: "flex", alignItems: "center", gap: 4,
          color: "rgba(255,255,255,0.7)", fontFamily: "Nunito, sans-serif",
          fontSize: 10, fontWeight: 700,
          backdropFilter: "blur(8px)",
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
  const [listsTopTab, setListsTopTab] = useState("todo")
  const [pushStatus, setPushStatus] = useState("unknown") // "unknown" | "denied" | "granted-no-sub" | "subscribed" | "unsupported"

  // ── Home customization (persisted per device via localStorage) ──
  const [homeConfig, setHomeConfig] = useState(() => loadHomeConfig())
  const [homeEditMode, setHomeEditMode] = useState(false)
  useEffect(() => {
    try { localStorage.setItem("smarthub:homeConfig", JSON.stringify(homeConfig)) } catch {}
  }, [homeConfig])
  const [themeColor, setThemeColorState] = useState(() => getThemeColor())
  function setThemeColor(c) {
    setThemeColorState(c)
    if (typeof window !== "undefined") {
      try { localStorage.setItem("smarthub:themeColor", c) } catch {}
      // Sätt CSS-variabel så vi kan använda den i style
      document.documentElement.style.setProperty("--smarthub-primary", c)
    }
  }
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.style.setProperty("--smarthub-primary", themeColor)
    }
  }, [themeColor])

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
  const [shoppingItems, setShoppingItems] = useState([])
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
    supabase.from("household_members").select("user_id,role,joined_at,display_name").eq("household_id", householdId)
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

  // ── Load + subscribe: shopping_items ──
  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      const { data } = await supabase.from("shopping_items")
        .select("*").eq("household_id", householdId)
        .order("created_at", { ascending: true })
      if (!cancelled && data) setShoppingItems(data)
    }
    load()
    const ch = supabase.channel("shopping:" + householdId).on("postgres_changes", {
      event: "*", schema: "public", table: "shopping_items", filter: "household_id=eq." + householdId,
    }, p => {
      setShoppingItems(prev => {
        if (p.eventType === "INSERT") return prev.some(i => i.id === p.new.id) ? prev : [...prev, p.new]
        if (p.eventType === "UPDATE") return prev.map(i => i.id === p.new.id ? p.new : i)
        if (p.eventType === "DELETE") return prev.filter(i => i.id !== p.old.id)
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
    // Använd display_name om satt, annars "Du" för egen användare, annars fallback
    name: m.display_name || (m.user_id === userId ? "Du" : "Medlem " + (i + 1)),
    color: PERSON_PALETTE[i % PERSON_PALETTE.length],
    role: m.role,
    display_name: m.display_name,
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
    const newShared = !list.shared
    // Optimistic update
    setLists(p => p.map(l => l.id === list.id ? { ...l, shared: newShared } : l))
    const { error } = await supabase.from("lists").update({ shared: newShared }).eq("id", list.id)
    if (error) {
      console.warn("[toggleSharedList]", error.message)
      // Roll back om RLS eller annat fel
      setLists(p => p.map(l => l.id === list.id ? { ...l, shared: list.shared } : l))
      alert(list.created_by === userId
        ? "Kunde inte ändra: " + error.message
        : "Bara ägaren av listan kan ändra delningsinställningar.")
    }
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
      all_day: ev.all_day || false,
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
    setCalEvents(p => p.map(e => e.id === id ? { ...e, ...updates } : e))
    const { error } = await supabase.from("calendar_events").update({
      title: updates.title,
      start_time: updates.start_time,
      end_time: updates.end_time,
      all_day: updates.all_day || false,
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
  // ── Shopping items ──
  async function handleAddShoppingItem(text) {
    const cleaned = text.trim()
    if (!cleaned) return
    const cat = categoryOf(cleaned)
    const tmp = {
      id: "tmp-" + Date.now(), household_id: householdId,
      text: cleaned, done: false, category: cat,
      added_by: userId, created_at: new Date().toISOString(),
    }
    setShoppingItems(p => [...p, tmp])
    const { data, error } = await supabase.from("shopping_items").insert({
      household_id: householdId, text: cleaned, done: false,
      category: cat, added_by: userId,
    }).select().single()
    if (error) {
      console.error("[addShoppingItem]", error)
      setShoppingItems(p => p.filter(i => i.id !== tmp.id))
      return
    }
    setShoppingItems(p => p.map(i => i.id === tmp.id ? data : i))
    logActivity("add_shopping", "shopping", data.id, `lade till "${cleaned}" i inköpslistan`)
  }
  async function handleToggleShoppingItem(item) {
    const nd = !item.done
    setShoppingItems(p => p.map(i => i.id === item.id ? { ...i, done: nd, completed_at: nd ? new Date().toISOString() : null } : i))
    const { error } = await supabase.from("shopping_items").update({
      done: nd, completed_at: nd ? new Date().toISOString() : null,
    }).eq("id", item.id)
    if (error) setShoppingItems(p => p.map(i => i.id === item.id ? item : i))
  }
  async function handleDeleteShoppingItem(item) {
    setShoppingItems(p => p.filter(i => i.id !== item.id))
    await supabase.from("shopping_items").delete().eq("id", item.id)
  }
  async function handleClearCheckedShopping() {
    const doneIds = shoppingItems.filter(i => i.done).map(i => i.id)
    if (doneIds.length === 0) return
    setShoppingItems(p => p.filter(i => !i.done))
    await supabase.from("shopping_items").delete().in("id", doneIds)
  }

  async function handleAddCountdown(c) {
    // Optimistic: lägg till direkt så användaren ser feedback omgående
    const tmp = {
      id: "tmp-" + Date.now(), household_id: householdId,
      title: c.title, target_date: c.target_date,
      color: c.color || ACCENT.calendar, emoji: c.emoji || null,
      created_by: userId, created_at: new Date().toISOString(),
    }
    setCountdowns(p => [...p, tmp].sort((a, b) => a.target_date.localeCompare(b.target_date)))
    const { data, error } = await supabase.from("countdowns").insert({
      household_id: householdId, title: c.title, target_date: c.target_date,
      color: c.color || ACCENT.calendar, emoji: c.emoji || null, created_by: userId,
    }).select().single()
    if (error) {
      console.error("[handleAddCountdown]", error)
      setCountdowns(p => p.filter(c => c.id !== tmp.id))
      return
    }
    setCountdowns(p => p.map(c => c.id === tmp.id ? data : c))
    logActivity("add_countdown", "countdown", data.id, `lade till nedräkningen "${c.title}"`)
  }
  async function handleDeleteCountdown(id) {
    setCountdowns(p => p.filter(c => c.id !== id))
    await supabase.from("countdowns").delete().eq("id", id)
  }
  // Bara EN countdown kan vara pinned. Toggla av om redan pinned.
  async function handleTogglePinCountdown(id) {
    const target = countdowns.find(c => c.id === id)
    if (!target) return
    const newPinned = !target.pinned
    setCountdowns(p => p.map(c => c.household_id === householdId
      ? { ...c, pinned: c.id === id ? newPinned : false }
      : c))
    await supabase.from("countdowns").update({ pinned: false }).eq("household_id", householdId).neq("id", id)
    await supabase.from("countdowns").update({ pinned: newPinned }).eq("id", id)
  }
  async function handleSaveTvPhoto(url) {
    setTvPhotoUrl(url)
    if (!householdId) return
    const { error } = await supabase.from("tv_layouts").upsert({
      household_id: householdId, photo_url: url, updated_at: new Date().toISOString(),
    }, { onConflict: "household_id" })
    if (error) console.warn("[tvPhoto]", error.message)
  }
  // Laddar upp en bildfil till Supabase Storage och sparar URL:en på tv_layouts
  async function handleUploadTvPhoto(file) {
    if (!householdId || !file) return { ok: false, error: "Ingen fil" }
    // Ext från mime: jpg/png/webp/gif
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
    const path = `${householdId}.${ext}`
    const { error: upErr } = await supabase.storage.from("tv-photos").upload(path, file, {
      upsert: true, cacheControl: "3600",
    })
    if (upErr) {
      console.error("[uploadTvPhoto]", upErr)
      return { ok: false, error: upErr.message }
    }
    // Hämta publik URL + cachebuster så TV:n laddar nya bilden direkt
    const { data: { publicUrl } } = supabase.storage.from("tv-photos").getPublicUrl(path)
    const url = publicUrl + "?v=" + Date.now()
    await handleSaveTvPhoto(url)
    return { ok: true, url }
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
  // ── Web Push (PWA-notiser) ──
  // Registrera service worker + kolla nuvarande prenumerationsstatus vid mount
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported")
      return
    }
    navigator.serviceWorker.register("/sw.js").catch(e => console.warn("[sw register]", e))
    async function checkStatus() {
      try {
        if (Notification.permission === "denied") return setPushStatus("denied")
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) setPushStatus("subscribed")
        else if (Notification.permission === "granted") setPushStatus("granted-no-sub")
        else setPushStatus("unknown")
      } catch (e) { console.warn("[push status]", e) }
    }
    checkStatus()
  }, [])

  async function handleEnablePush() {
    if (!VAPID_PUBLIC_KEY) {
      alert("VAPID_PUBLIC_KEY saknas — kontakta admin (env-variabel inte satt).")
      return
    }
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") { setPushStatus("denied"); return }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }
      // Spara prenumeration i Supabase
      const json = sub.toJSON()
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        last_used_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" })
      if (error) throw error
      setPushStatus("subscribed")
    } catch (e) {
      console.error("[enable push]", e)
      alert("Kunde inte aktivera notiser: " + (e.message || e))
    }
  }
  async function handleDisablePush() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", sub.endpoint)
        await sub.unsubscribe()
      }
      setPushStatus("granted-no-sub")
    } catch (e) {
      console.error("[disable push]", e)
    }
  }

  async function handleCreateInvite() {
    const code = genCode()
    const { error } = await supabase.from("invites").insert({ household_id: householdId, code, created_by: userId })
    return error ? null : code
  }
  // Spara visningsnamn för aktuell användare
  async function handleSaveDisplayName(name) {
    const trimmed = (name || "").trim()
    if (!householdId || !userId) return
    setMembers(p => p.map(m => m.user_id === userId ? { ...m, display_name: trimmed || null } : m))
    await supabase.from("household_members")
      .update({ display_name: trimmed || null })
      .eq("household_id", householdId).eq("user_id", userId)
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

  // Skickar inspelad audio till ai-transcribe (Whisper). Returnerar transkriberad text.
  async function transcribeAudio(blob, ext = "m4a") {
    const form = new FormData()
    form.append("file", blob, "audio." + ext)
    const { data, error } = await supabase.functions.invoke("ai-transcribe", { body: form })
    if (error) throw new Error(error.message || "Transkribering misslyckades")
    if (data?.error) throw new Error(data.error)
    return (data?.text || "").trim()
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
        userId={userId}
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
        userId={userId}
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
          countdowns={countdowns}
          shoppingItems={shoppingItems}
          onAddShoppingItem={handleAddShoppingItem}
          onToggleShoppingItem={handleToggleShoppingItem}
          onDayClick={openDayModal}
        />
        {liftedModals}
      </>
    )
  }

  const tabContentProps = {
    tab, setTab, isMobile: view === "mobile", weather,
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
      countdowns,
      shoppingItems,
      onAddShoppingItem: handleAddShoppingItem,
      onToggleShoppingItem: handleToggleShoppingItem,
    },
    tvSlots, onSaveTvSlots: handleSaveTvSlots,
    tvPhotoUrl, onSaveTvPhoto: handleSaveTvPhoto, onUploadTvPhoto: handleUploadTvPhoto,
    themeColor, setThemeColor,
    displayName: members.find(m => m.user_id === userId)?.display_name || "",
    onSaveDisplayName: handleSaveDisplayName,
    pushStatus, onEnablePush: handleEnablePush, onDisablePush: handleDisablePush,
    activity,
    countdowns, onAddCountdown: handleAddCountdown, onDeleteCountdown: handleDeleteCountdown, onTogglePinCountdown: handleTogglePinCountdown,
    householdIdProp: householdId, currentWeekStart,
    shoppingItems,
    onAddShoppingItem: handleAddShoppingItem,
    onToggleShoppingItem: handleToggleShoppingItem,
    onDeleteShoppingItem: handleDeleteShoppingItem,
    onClearCheckedShopping: handleClearCheckedShopping,
    listsTopTab, setListsTopTab,
    homeConfig, setHomeConfig, homeEditMode, setHomeEditMode,
  }

  // ─── Mobile view ───
  if (view === "mobile") {
    return (
      <>
        {fonts}{globalCss}
        <div style={{ height: "100dvh", background: t.bg, display: "flex", flexDirection: "column", position: "relative", fontFamily: "Nunito, sans-serif", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto", paddingBottom: 84 }}>
            <TabContent {...tabContentProps} />
          </div>
          <MobileNav tab={tab} setTab={setTab} themeColor={themeColor} />
          <AiChat position="mobile" callAi={callAiChat} executeTool={executeAiTool} transcribeAudio={transcribeAudio} />
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
        <DesktopSidebar tab={tab} setTab={setTab} session={session} weather={weather} household={household} themeColor={themeColor} />
        <div style={{ flex: 1, overflow: "auto", minWidth: 0, position: "relative" }}>
          <TabContent {...tabContentProps} />
          <AiChat position="desktop" callAi={callAiChat} executeTool={executeAiTool} transcribeAudio={transcribeAudio} />
        </div>
      </div>
      {liftedModals}
    </>
  )
}
