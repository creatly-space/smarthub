// ════════════════════════════════════════════════
//  TIDSHANTERING
// ════════════════════════════════════════════════
// All tid i SmartHub går genom den här filen. Regeln är enkel:
//
//   • I databasen är start_time/end_time timestamptz, dvs. äkta UTC-instanser.
//   • På skärmen visas alltid svensk lokaltid, oavsett vad enheten tror.
//
// Den andra halvan är viktig. Köks-TV:n är en Raspberry Pi som mycket väl kan
// stå kvar på UTC, och då hade Date#getHours() renderat två timmar fel på
// väggen men rätt i mobilen. Därför tvingar vi Europe/Stockholm explicit i
// stället för att lita på enhetens tidszon.
//
// Ingen annanstans i kodbasen får en timestamp strängmanipuleras.

export const TZ = "Europe/Stockholm"

// Intl-formatterare är dyra att skapa. TV:n renderar om varje sekund, så vi
// bygger varje formatterare en gång och återanvänder den.
const fmtCache = new Map()
function getFormatter(opts) {
  const key = JSON.stringify(opts)
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, ...opts })
    fmtCache.set(key, f)
  }
  return f
}

function toDate(ts) {
  if (ts instanceof Date) return isNaN(ts) ? null : ts
  if (!ts) return null
  const d = new Date(ts)
  return isNaN(d) ? null : d
}

// ── Läsa: instant → svensk lokaltid ──

// "14:00" — klockslaget i svensk tid.
export function formatTime(ts) {
  const d = toDate(ts)
  if (!d) return ""
  return getFormatter({ hour: "2-digit", minute: "2-digit" }).format(d)
}

// Datum i svensk tid. Skicka Intl-optioner för att styra formatet,
// t.ex. formatDate(ts, { weekday: "long", day: "numeric", month: "long" }).
export function formatDate(ts, opts = { day: "numeric", month: "long" }) {
  const d = toDate(ts)
  if (!d) return ""
  return getFormatter(opts).format(d)
}

// "2026-08-11" — vilket svenskt kalenderdatum en instant tillhör.
// Det här är nyckeln som events sorteras in på i kalendervyerna. Att räkna ut
// den via enhetens tidszon skulle lägga ett event 00:30 svensk tid på fel dag
// på en UTC-ställd Pi.
export function dayKey(ts) {
  const d = toDate(ts)
  if (!d) return ""
  // sv-SE med dessa optioner ger redan "YYYY-MM-DD".
  return getFormatter({ year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
}

// Dagens datum i Sverige, som "2026-08-11".
export function todayKey() {
  return dayKey(new Date())
}

// ── Skriva: svensk lokaltid → instant ──

// Hur många ms svensk tid ligger före UTC vid en given instant (+2h sommar, +1h vinter).
function tzOffsetMs(date) {
  const parts = getFormatter({
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const p = {}
  for (const part of parts) p[part.type] = part.value
  const wallAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return wallAsUTC - date.getTime()
}

// Bygger en korrekt UTC-timestamp från svensk lokal input.
// toISO("2026-08-11", "14:00") → "2026-08-11T12:00:00.000Z" (sommartid)
// toISO("2026-01-15", "14:00") → "2026-01-15T13:00:00.000Z" (vintertid)
//
// Det här är hela poängen med filen. Tidigare skickades "2026-08-11T14:00:00"
// rakt in i Postgres, som har sin session i UTC och därför lagrade 14:00 UTC —
// två timmar fel.
export function toISO(dateStr, timeStr = "00:00", seconds = 0) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split("-").map(Number)
  const [hh, mm] = String(timeStr || "00:00").split(":").map(Number)
  if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return null
  // Väggtiden tolkad som om den vore UTC — utgångspunkt för iterationen.
  const wall = Date.UTC(y, m - 1, d, hh, mm, seconds)
  // Vi söker instansen I där I + offset(I) === wall. Två varv räcker överallt
  // utom exakt på DST-gränsen, där svaret ändå är tvetydigt.
  let instant = wall - tzOffsetMs(new Date(wall))
  instant = wall - tzOffsetMs(new Date(instant))
  return new Date(instant).toISOString()
}

// ── Hjälpare för formulär och rutnät ──

// "HH:MM" i svensk tid — för att prefylla tidsfält vid redigering.
export function toTimeInput(ts) {
  return formatTime(ts)
}

// "YYYY-MM-DD" i svensk tid — för att prefylla datumfält vid redigering.
export function toDateInput(ts) {
  return dayKey(ts)
}

// "2026-08-11" → Date vid lokal midnatt.
// Rent triplet-räknande: det som stoppas in kommer ut, oavsett enhetens
// tidszon. Används för att stega mellan kalenderdagar i rutnäten.
export function keyToDate(key) {
  if (!key) return null
  const [y, m, d] = String(key).split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// Date → "YYYY-MM-DD" med enhetens fält. Motsatsen till keyToDate.
// Gäller bara Date-objekt som byggts från rena y/m/d-tripplar (kalenderceller),
// aldrig instanser som kommer från databasen — använd dayKey() till dem.
export function dateToKey(date) {
  if (!(date instanceof Date) || isNaN(date)) return ""
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0")
}

// Start- och slutinstans för ett svenskt kalenderdygn, som ISO-strängar.
// Används som fönster när events filtreras fram för en viss dag.
export function dayBounds(key) {
  return {
    from: new Date(toISO(key, "00:00")),
    to: new Date(toISO(key, "23:59", 59)),
  }
}
