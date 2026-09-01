// ════════════════════════════════════════════════
//  DEMOLÄGE
// ════════════════════════════════════════════════
// Öppnas med ?demo=1 och kör hela appen mot påhittad data i minnet.
//
// Säkerheten ligger i att src/lib/supabase.js aldrig skapar någon riktig
// klient när demoläget är på. Det finns alltså ingen anslutning som skulle
// kunna nå hushållets data — inte ens med rätt nycklar i bygget.
//
// Allt som skrivs hamnar i minnet och försvinner vid omladdning, så den som
// testar kan klicka runt, bocka av och lägga till utan att något sparas.

import { toISO, todayKey, keyToDate, dateToKey } from "./time"

export function isDemoMode() {
  if (typeof window === "undefined") return false
  const p = new URLSearchParams(window.location.search)
  return p.has("demo") && p.get("demo") !== "0" && p.get("demo") !== "false"
}

const DEMO_USER = "demo-user-0000-0000-000000000001"
const DEMO_MATE = "demo-user-0000-0000-000000000002"
const DEMO_HH = "demo-household-0000-000000000001"

// Datum relativt idag så demot alltid ser levande ut
function day(offset) {
  const d = keyToDate(todayKey())
  return dateToKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset))
}
function mondayThisWeek() {
  const d = keyToDate(todayKey())
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  return dateToKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 1))
}
function at(dayOffset, time) {
  return toISO(day(dayOffset), time)
}

let idCounter = 1000
function newId() { return "demo-" + (++idCounter) }

// Byggs på nytt vid varje sidladdning — demot börjar alltid från samma läge.
function buildStore() {
  const household = {
    id: DEMO_HH, name: "Demohemmet", created_by: DEMO_USER,
    created_at: at(-200, "12:00"), tv_theme: "default",
  }
  return {
    households: [household],
    household_members: [
      { household_id: DEMO_HH, user_id: DEMO_USER, role: "owner", joined_at: at(-200, "12:00"), display_name: "Alex", theme: "default", households: { id: household.id, name: household.name } },
      { household_id: DEMO_HH, user_id: DEMO_MATE, role: "member", joined_at: at(-190, "12:00"), display_name: "Robin", theme: "varm", households: { id: household.id, name: household.name } },
    ],
    calendar_events: [
      { id: newId(), household_id: DEMO_HH, title: "Tandläkare", start_time: at(0, "08:15"), end_time: at(0, "09:00"), all_day: false, location: "Folktandvården", color: "#7c3aed", icon: "🦷", created_by: DEMO_USER, created_at: at(-5, "10:00"), shared: true, recurrence_rule: null, reminder_minutes: 60 },
      { id: newId(), household_id: DEMO_HH, title: "Fotbollsträning", start_time: at(0, "18:30"), end_time: at(0, "20:00"), all_day: false, location: "Idrottsplatsen", color: "#db2777", icon: "⚽", created_by: DEMO_MATE, created_at: at(-30, "10:00"), shared: true, recurrence_rule: { freq: "weekly" }, reminder_minutes: 60 },
      { id: newId(), household_id: DEMO_HH, title: "Middag hos mormor", start_time: at(1, "17:00"), end_time: at(1, "20:00"), all_day: false, location: null, color: "#db2777", icon: "🍽️", created_by: DEMO_MATE, created_at: at(-3, "10:00"), shared: true, recurrence_rule: null, reminder_minutes: null },
      { id: newId(), household_id: DEMO_HH, title: "Bilbesiktning", start_time: at(2, "10:45"), end_time: at(2, "11:30"), all_day: false, location: "Bilprovningen", color: "#7c3aed", icon: "🚗", created_by: DEMO_USER, created_at: at(-8, "10:00"), shared: true, recurrence_rule: null, reminder_minutes: 60 },
      { id: newId(), household_id: DEMO_HH, title: "Semestervecka på Gotland", start_time: at(4, "00:00"), end_time: at(8, "23:59"), all_day: true, location: "Visby", color: "#7c3aed", icon: "✈️", created_by: DEMO_USER, created_at: at(-40, "10:00"), shared: true, recurrence_rule: null, reminder_minutes: null },
      { id: newId(), household_id: DEMO_HH, title: "Simskola", start_time: at(3, "16:00"), end_time: at(3, "17:00"), all_day: false, location: "Simhallen", color: "#db2777", icon: "🏊", created_by: DEMO_MATE, created_at: at(-20, "10:00"), shared: true, recurrence_rule: { freq: "weekly" }, reminder_minutes: 30 },
      { id: newId(), household_id: DEMO_HH, title: "Alex födelsedag", start_time: at(11, "00:00"), end_time: at(11, "23:59"), all_day: true, location: null, color: "#7c3aed", icon: "🎂", created_by: DEMO_USER, created_at: at(-60, "10:00"), shared: true, recurrence_rule: { freq: "yearly" }, reminder_minutes: null },
    ],
    lists: [
      { id: "demo-list-1", household_id: DEMO_HH, name: "Att göra", color: "#2563eb", shared: true, pinned: true, archived: false, archived_at: null, created_by: DEMO_USER, created_at: at(-50, "10:00"), expires_at: null },
      { id: "demo-list-2", household_id: DEMO_HH, name: "Inför resan", color: "#0d9488", shared: true, pinned: false, archived: false, archived_at: null, created_by: DEMO_MATE, created_at: at(-10, "10:00"), expires_at: null },
    ],
    todos: [
      { id: newId(), household_id: DEMO_HH, list_id: "demo-list-1", text: "Boka däckbyte", done: false, shared: true, created_by: DEMO_USER, created_at: at(-2, "09:00"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, list_id: "demo-list-1", text: "Ringa elektrikern", done: false, shared: true, created_by: DEMO_MATE, created_at: at(-1, "09:00"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, list_id: "demo-list-1", text: "Vattna blommorna", done: true, shared: true, created_by: DEMO_USER, created_at: at(-3, "09:00"), completed_at: at(0, "07:30") },
      { id: newId(), household_id: DEMO_HH, list_id: "demo-list-1", text: "Sortera i källaren", done: false, shared: true, created_by: DEMO_USER, created_at: at(-6, "09:00"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, list_id: "demo-list-2", text: "Ladda ner offlinekartor", done: false, shared: true, created_by: DEMO_MATE, created_at: at(-4, "09:00"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, list_id: "demo-list-2", text: "Packa laddare", done: true, shared: true, created_by: DEMO_MATE, created_at: at(-4, "09:05"), completed_at: at(-1, "20:00") },
    ],
    shopping_items: [
      { id: newId(), household_id: DEMO_HH, text: "Mjölk", done: false, added_by: DEMO_USER, created_at: at(0, "08:00"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, text: "Bröd", done: false, added_by: DEMO_MATE, created_at: at(0, "08:01"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, text: "Kaffe", done: false, added_by: DEMO_USER, created_at: at(0, "08:02"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, text: "Bananer", done: false, added_by: DEMO_MATE, created_at: at(0, "08:03"), completed_at: null },
      { id: newId(), household_id: DEMO_HH, text: "Tandkräm", done: true, added_by: DEMO_USER, created_at: at(-1, "18:00"), completed_at: at(0, "07:00") },
    ],
    meals: (() => {
      const ws = mondayThisWeek()
      const texter = [
        ["Tacopaj", "snabbt"],
        ["Fisksoppa med aioli", null],
        ["Köttbullar & potatismos", null],
        ["Linsgryta med kokosmjölk", "matlada"],
        ["Pizza hemma", null],
        ["Grillat med klyftpotatis", null],
        ["Söndagsstek med rotfrukter", null],
      ]
      return texter.map(([text, tag], i) => ({
        id: newId(), household_id: DEMO_HH, week_start_date: ws,
        weekday: i + 1, meal_text: text, tag,
      }))
    })(),
    countdowns: [
      { id: newId(), household_id: DEMO_HH, title: "Gotland", target_date: day(4), pinned: true, created_by: DEMO_USER, created_at: at(-40, "10:00") },
      { id: newId(), household_id: DEMO_HH, title: "Alex födelsedag", target_date: day(11), pinned: false, created_by: DEMO_MATE, created_at: at(-40, "10:00") },
    ],
    activity_log: [
      { id: newId(), household_id: DEMO_HH, user_id: DEMO_MATE, action: "add_event", entity: "event", entity_id: null, text: 'lade till "Middag hos mormor"', created_at: at(-1, "19:12") },
      { id: newId(), household_id: DEMO_HH, user_id: DEMO_MATE, action: "add_todo", entity: "todo", entity_id: null, text: 'lade till "Ringa elektrikern"', created_at: at(-1, "09:00") },
    ],
    tv_layouts: [
      { household_id: DEMO_HH, widgets: null, photo_url: null, slots: { layout: "standard", main: "calendar", bottomLeft: "todo", bottomRight: "meal" }, updated_at: at(-5, "10:00") },
    ],
    layouts: [],
    food_preferences: [],
    push_subscriptions: [],
    devices: [],
    invites: [],
  }
}

const store = typeof window === "undefined" ? null : buildStore()

// ── Minimal PostgREST-liknande query-byggare mot minnet ──

function matches(row, filters) {
  return filters.every(f => {
    const v = row[f.col]
    switch (f.op) {
      case "eq": return String(v) === String(f.val)
      case "neq": return String(v) !== String(f.val)
      case "gt": return v > f.val
      case "gte": return v >= f.val
      case "lt": return v < f.val
      case "lte": return v <= f.val
      case "is": return f.val === null ? (v === null || v === undefined) : v === f.val
      case "in": return f.val.includes(v)
      default: return true
    }
  })
}

function makeQuery(table) {
  const filters = []
  let order = null
  let limitN = null
  let single = false
  let op = "select"
  let payload = null

  const q = {
    select() { return q },
    insert(rows) { op = "insert"; payload = Array.isArray(rows) ? rows : [rows]; return q },
    update(patch) { op = "update"; payload = patch; return q },
    upsert(row) { op = "upsert"; payload = row; return q },
    delete() { op = "delete"; return q },
    eq(col, val) { filters.push({ col, val, op: "eq" }); return q },
    neq(col, val) { filters.push({ col, val, op: "neq" }); return q },
    gt(col, val) { filters.push({ col, val, op: "gt" }); return q },
    gte(col, val) { filters.push({ col, val, op: "gte" }); return q },
    lt(col, val) { filters.push({ col, val, op: "lt" }); return q },
    lte(col, val) { filters.push({ col, val, op: "lte" }); return q },
    is(col, val) { filters.push({ col, val, op: "is" }); return q },
    in(col, val) { filters.push({ col, val, op: "in" }); return q },
    not() { return q },
    filter() { return q },
    order(col, opts) { order = { col, asc: opts?.ascending !== false }; return q },
    limit(n) { limitN = n; return q },
    single() { single = true; return q },
    maybeSingle() { single = true; return q },
    then(resolve, reject) {
      let result
      try {
        result = { data: run(), error: null }
      } catch (e) {
        result = { data: null, error: { message: e.message } }
      }
      return Promise.resolve(result).then(resolve, reject)
    },
  }

  function run() {
    const rows = store[table] || (store[table] = [])
    if (op === "insert") {
      const created = payload.map(r => ({ id: newId(), created_at: new Date().toISOString(), ...r }))
      rows.push(...created)
      return single ? created[0] : created
    }
    if (op === "update") {
      const hit = rows.filter(r => matches(r, filters))
      hit.forEach(r => Object.assign(r, payload))
      return single ? (hit[0] ?? null) : hit
    }
    if (op === "upsert") {
      const keys = ["household_id", "user_id", "id"].filter(k => k in payload)
      const existing = rows.find(r => keys.length && keys.every(k => String(r[k]) === String(payload[k])))
      if (existing) { Object.assign(existing, payload); return single ? existing : [existing] }
      const created = { id: newId(), ...payload }
      rows.push(created)
      return single ? created : [created]
    }
    if (op === "delete") {
      const hit = rows.filter(r => matches(r, filters))
      store[table] = rows.filter(r => !matches(r, filters))
      return single ? (hit[0] ?? null) : hit
    }
    let out = rows.filter(r => matches(r, filters))
    if (order) {
      out = [...out].sort((a, b) => {
        const av = a[order.col], bv = b[order.col]
        if (av === bv) return 0
        return (av > bv ? 1 : -1) * (order.asc ? 1 : -1)
      })
    }
    if (limitN != null) out = out.slice(0, limitN)
    return single ? (out[0] ?? null) : out
  }

  return q
}

const noopChannel = {
  on() { return noopChannel },
  subscribe() { return noopChannel },
  unsubscribe() { return Promise.resolve("ok") },
}

const DEMO_SESSION = {
  user: { id: DEMO_USER, email: "demo@smarthub.local" },
  access_token: "demo",
}

export function createDemoClient() {
  return {
    from: table => makeQuery(table),
    channel: () => noopChannel,
    removeChannel: () => Promise.resolve("ok"),
    rpc: (name, args) => {
      if (name === "set_tv_theme") {
        const hh = store.households.find(h => h.id === args?.p_household_id)
        if (hh) hh.tv_theme = args.p_theme
      }
      return Promise.resolve({ data: null, error: null })
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: DEMO_SESSION }, error: null }),
      getUser: () => Promise.resolve({ data: { user: DEMO_SESSION.user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { session: DEMO_SESSION }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    functions: {
      invoke: (name) => {
        if (name === "ai-chat") {
          return Promise.resolve({
            data: {
              reply: "Hej! Det här är en demo, så jag är avstängd här. I den riktiga appen kan jag lägga in händelser, fylla matsedeln och bocka av saker åt dig.",
              tool_calls: [],
            },
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: { message: "Avstängt i demoläget" } })
      },
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: "Avstängt i demoläget" } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  }
}
