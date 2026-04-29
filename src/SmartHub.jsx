import { useState, useEffect, useMemo } from "react"
import { supabase } from "./lib/supabase"

const ACCENT = "#5B52E7"
const ACCENT_SOFT = "#EEEDFE"
const ACCENT_TEXT = "#3C3489"
const GREEN = "#1D9E75"
const GREEN_BG = "#E1F5EE"
const BLUE = "#185FA5"
const BLUE_BG = "#E6F1FB"
const AMBER = "#BA7517"
const AMBER_BG = "#FAEEDA"
const BG = "#F2F1EE"
const CARD = "#FFFFFF"
const BORDER = "rgba(0,0,0,0.07)"
const T1 = "#1A1A1A"
const T2 = "#666660"
const T3 = "#9E9E98"

const WEEKDAYS = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"]
const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"]
const MEAL_DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]

const BACKGROUNDS = [
  { id: "sunset", label: "Solnedgång", style: { background: "linear-gradient(160deg,#1a1a2e 0%,#16213e 40%,#0f3460 70%,#e94560 100%)" }, textColor: "#fff" },
  { id: "forest", label: "Skog", style: { background: "linear-gradient(160deg,#0f2027 0%,#203a43 50%,#2c5364 100%)" }, textColor: "#fff" },
  { id: "nordic", label: "Nordisk", style: { background: "linear-gradient(160deg,#e8f4f8 0%,#d6eaf8 50%,#a9cce3 100%)" }, textColor: "#1a3a5c" },
  { id: "warm", label: "Morgon", style: { background: "linear-gradient(160deg,#f8e7d3 0%,#f5c6a0 50%,#e8956d 100%)" }, textColor: "#6b3a1f" },
  { id: "night", label: "Natt", style: { background: "linear-gradient(160deg,#0d0d0d 0%,#1a1a1a 50%,#2d2d2d 100%)" }, textColor: "#fff" },
  { id: "aurora", label: "Aurora", style: { background: "linear-gradient(160deg,#0b1a2e 0%,#0d4f3c 40%,#1a7a5e 70%,#00d4aa 100%)" }, textColor: "#c8fff4" }
]

const LAYOUTS = [
  { id: "big-two-small", label: "1 stor + 2 små", preview: [[2], [1, 1]], cols: 2, rows: 2, rowFr: [2, 1], slots: [{ id: "A", col: 1, colSpan: 2, row: 1, rowSpan: 1 }, { id: "B", col: 1, colSpan: 1, row: 2, rowSpan: 1 }, { id: "C", col: 2, colSpan: 1, row: 2, rowSpan: 1 }] },
  { id: "two-two", label: "2x2 grid", preview: [[1, 1], [1, 1]], cols: 2, rows: 2, rowFr: [1, 1], slots: [{ id: "A", col: 1, colSpan: 1, row: 1, rowSpan: 1 }, { id: "B", col: 2, colSpan: 1, row: 1, rowSpan: 1 }, { id: "C", col: 1, colSpan: 1, row: 2, rowSpan: 1 }, { id: "D", col: 2, colSpan: 1, row: 2, rowSpan: 1 }] },
  { id: "tall-right", label: "Stor höger", preview: [[1, 1], [1, 1]], cols: 2, rows: 2, rowFr: [1, 1], slots: [{ id: "A", col: 1, colSpan: 1, row: 1, rowSpan: 1 }, { id: "B", col: 1, colSpan: 1, row: 2, rowSpan: 1 }, { id: "C", col: 2, colSpan: 1, row: 1, rowSpan: 2 }] },
  { id: "two-small-big", label: "2 små + 1 stor", preview: [[1, 1], [2]], cols: 2, rows: 2, rowFr: [1, 2], slots: [{ id: "A", col: 1, colSpan: 1, row: 1, rowSpan: 1 }, { id: "B", col: 2, colSpan: 1, row: 1, rowSpan: 1 }, { id: "C", col: 1, colSpan: 2, row: 2, rowSpan: 1 }] },
  { id: "three", label: "3 lika", preview: [[1, 1, 1]], cols: 3, rows: 1, rowFr: [1], slots: [{ id: "A", col: 1, colSpan: 1, row: 1, rowSpan: 1 }, { id: "B", col: 2, colSpan: 1, row: 1, rowSpan: 1 }, { id: "C", col: 3, colSpan: 1, row: 1, rowSpan: 1 }] }
]

const WIDGET_DEFS = [
  { id: "kalender", label: "Kalender", icon: "📅" },
  { id: "todo", label: "Att göra", icon: "☑️" },
  { id: "mat", label: "Matsedel", icon: "🍽️" },
  { id: "events", label: "Händelser", icon: "📋" },
  { id: "vader", label: "Väder", icon: "🌤️" },
  { id: "tom", label: "Tom", icon: "➕" }
]

// ----- Helpers -----
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return { week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7), year: d.getUTCFullYear() }
}

function fmtTime(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// Group calendar events by day-of-month for the *currently visible* month in the small calendar.
// Since the small widget only shows current month, we use date.getDate() as key.
function groupEventsByDay(events, year, month) {
  const out = {}
  events.forEach(ev => {
    const d = new Date(ev.start_time)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!out[day]) out[day] = []
      out[day].push({
        time: fmtTime(ev.start_time),
        title: ev.title,
        color: ev.color || ACCENT
      })
    }
  })
  // sort each day by time
  Object.keys(out).forEach(k => out[k].sort((a, b) => a.time.localeCompare(b.time)))
  return out
}

function getEventsToday(events) {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  return events
    .filter(ev => {
      const dt = new Date(ev.start_time)
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .map(ev => {
      const start = new Date(ev.start_time)
      const end = ev.end_time ? new Date(ev.end_time) : null
      const now = new Date()
      const isNow = end ? now >= start && now <= end : Math.abs(now - start) < 30 * 60 * 1000
      return {
        id: ev.id,
        start: fmtTime(ev.start_time),
        title: ev.title,
        location: ev.location,
        color: ev.color || ACCENT,
        now: isNow
      }
    })
}

// ----- Widgets -----
function WidgetKalender({ calEventsByDay }) {
  const now = new Date()
  const [vm, setVm] = useState(now.getMonth())
  const [vy, setVy] = useState(now.getFullYear())
  const firstDay = new Date(vy, vm, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const days = new Date(vy, vm + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let i = 1; i <= days; i++) cells.push(i)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const isToday = d => d === now.getDate() && vm === now.getMonth() && vy === now.getFullYear()

  // Only show events when viewing current month (small widget compromise)
  const viewingCurrentMonth = vm === now.getMonth() && vy === now.getFullYear()
  const eventsForView = viewingCurrentMonth ? calEventsByDay : {}

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={() => { if (vm === 0) { setVm(11); setVy(y => y - 1) } else setVm(m => m - 1) }} style={{ background: "none", border: "none", cursor: "pointer", color: T2, fontSize: 14 }}>{"<"}</button>
        <span style={{ fontSize: 11, fontWeight: 700, color: T1 }}>{MONTHS[vm].slice(0, 3).toUpperCase()} {vy}</span>
        <button onClick={() => { if (vm === 11) { setVm(0); setVy(y => y + 1) } else setVm(m => m + 1) }} style={{ background: "none", border: "none", cursor: "pointer", color: T2, fontSize: 14 }}>{">"}</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", flex: 1, tableLayout: "fixed" }}>
        <thead>
          <tr>
            {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
              <th key={i} style={{ fontSize: 8, color: i >= 5 ? ACCENT : T3, fontWeight: 600, textAlign: "center", padding: "2px 0" }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => {
                const evs = d ? (eventsForView[d] || []) : []
                const today = d && isToday(d)
                return (
                  <td key={di} style={{ verticalAlign: "top", padding: "1px", textAlign: "center" }}>
                    {d && (
                      <>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: today ? ACCENT : "transparent", color: today ? "#fff" : di >= 5 ? ACCENT : T1, fontSize: 9, fontWeight: today ? 700 : 400, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1px" }}>{d}</div>
                        {evs.slice(0, 2).map((ev, ei) => (
                          <div key={ei} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 1, paddingLeft: 2, borderLeft: `2px solid ${ev.color}` }}>
                            <span style={{ fontSize: 7, color: T3, fontWeight: 600, flexShrink: 0 }}>{ev.time}</span>
                            <span style={{ fontSize: 7, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{ev.title}</span>
                          </div>
                        ))}
                        {evs.length === 0 && <div style={{ height: 3 }} />}
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WidgetTodo({ todos, onToggle }) {
  const remaining = todos.filter(i => !i.done).length

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T1 }}>Att göra</span>
        <span style={{ fontSize: 9, color: GREEN, background: GREEN_BG, padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>{remaining} kvar</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, overflowY: "auto" }}>
        {todos.length === 0 && <span style={{ fontSize: 10, color: T3, fontStyle: "italic" }}>Inga uppgifter</span>}
        {todos.map(item => (
          <div key={item.id} onClick={() => onToggle(item)} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", flexShrink: 0 }}>
            <div style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0, border: item.done ? "none" : `1.5px solid ${BORDER}`, background: item.done ? GREEN : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff" }}>{item.done ? "✓" : ""}</div>
            <span style={{ fontSize: 11, color: item.done ? T3 : T1, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetMat({ meals }) {
  const now = new Date()
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1

  // Build a map day_of_week (0-6, where 0=Mon) -> description
  // Assumption: db stores day_of_week 0-6 with 0=Mon. If your data uses Sunday=0, adjust here.
  const byDay = {}
  meals.forEach(m => { byDay[m.day_of_week] = m.description })

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T1, flexShrink: 0 }}>Matsedel</span>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
        {MEAL_DAYS.map((day, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", flexShrink: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: i === todayIdx ? AMBER : T3, minWidth: 22, textAlign: "right", flexShrink: 0 }}>{day}</span>
            <span style={{ fontSize: 11, color: i === todayIdx ? T1 : T2, fontWeight: i === todayIdx ? 600 : 400 }}>{byDay[i] || <span style={{ color: T3, fontStyle: "italic" }}>—</span>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetEvents({ eventsToday }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T1, flexShrink: 0 }}>Idag</span>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {eventsToday.length === 0 && <span style={{ fontSize: 10, color: T3, fontStyle: "italic" }}>Inget inplanerat idag</span>}
        {eventsToday.map(e => (
          <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexShrink: 0 }}>
            <div style={{ width: 3, minHeight: 32, background: e.color, borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 9, color: T3, fontWeight: 500 }}>
                {e.start}
                {e.now && <span style={{ background: ACCENT, color: "#fff", fontSize: 8, padding: "1px 5px", borderRadius: 6, marginLeft: 4 }}>Nu</span>}
              </div>
              <div style={{ fontSize: 11, color: T1, fontWeight: 500 }}>{e.title}</div>
              {e.location && <div style={{ fontSize: 9, color: T3 }}>📍 {e.location}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetVader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 4 }}>
      <span style={{ fontSize: 32 }}>☁️</span>
      <span style={{ fontSize: 28, fontWeight: 200, color: T1 }}>15°</span>
      <span style={{ fontSize: 10, color: T3 }}>Mulet · Kalmar</span>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        {[{ d: "Sön", i: "🌧️", t: "11°" }, { d: "Mån", i: "☀️", t: "14°" }, { d: "Tis", i: "⛅", t: "12°" }].map(w => (
          <div key={w.d} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: T3 }}>{w.d}</div>
            <div style={{ fontSize: 14 }}>{w.i}</div>
            <div style={{ fontSize: 10, color: T2, fontWeight: 500 }}>{w.t}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetTom({ onEdit }) {
  return (
    <div onClick={onEdit} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 6, opacity: 0.3, cursor: "pointer" }}>
      <span style={{ fontSize: 22 }}>➕</span>
      <span style={{ fontSize: 10, color: T3 }}>Lägg till</span>
    </div>
  )
}

function renderWidget(id, ctx) {
  switch (id) {
    case "kalender": return <WidgetKalender calEventsByDay={ctx.calEventsByDay} />
    case "todo": return <WidgetTodo todos={ctx.todos} onToggle={ctx.onToggleTodo} />
    case "mat": return <WidgetMat meals={ctx.meals} />
    case "events": return <WidgetEvents eventsToday={ctx.eventsToday} />
    case "vader": return <WidgetVader />
    default: return <WidgetTom onEdit={ctx.onEdit} />
  }
}

function ClockHero({ bg, onChangeBg }) {
  const [time, setTime] = useState(new Date())
  const [showPicker, setShowPicker] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const h = String(time.getHours()).padStart(2, "0")
  const m = String(time.getMinutes()).padStart(2, "0")
  const s = String(time.getSeconds()).padStart(2, "0")
  const tc = bg.textColor
  const ts = tc === "#fff" ? "0 2px 12px rgba(0,0,0,0.3)" : "none"

  return (
    <div style={{ ...bg.style, padding: "20px 20px 14px", position: "relative", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 50, fontWeight: 200, color: tc, letterSpacing: "-0.02em", lineHeight: 1, textShadow: ts, fontVariantNumeric: "tabular-nums" }}>
            {h}:{m}<span style={{ fontSize: 18, opacity: 0.5 }}>:{s}</span>
          </div>
          <div style={{ fontSize: 12, color: tc, opacity: 0.75, marginTop: 5, textShadow: ts }}>
            {WEEKDAYS[time.getDay()]} · {time.getDate()} {MONTHS[time.getMonth()]}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26 }}>☁️</div>
          <div style={{ fontSize: 20, fontWeight: 200, color: tc, textShadow: ts }}>15°</div>
          <div style={{ fontSize: 10, color: tc, opacity: 0.7 }}>Mulet</div>
        </div>
      </div>
      <button onClick={() => setShowPicker(p => !p)} style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 20, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: tc }}>🎨</button>
      {showPicker && (
        <div style={{ position: "absolute", top: 38, right: 10, background: "rgba(10,10,10,0.9)", borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 20, minWidth: 145 }}>
          {BACKGROUNDS.map(b => (
            <button key={b.id} onClick={() => { onChangeBg(b); setShowPicker(false) }} style={{ display: "flex", alignItems: "center", gap: 8, background: bg.id === b.id ? "rgba(255,255,255,0.15)" : "transparent", border: `1px solid ${bg.id === b.id ? "rgba(255,255,255,0.3)" : "transparent"}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>
              <div style={{ ...b.style, width: 22, height: 22, borderRadius: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#fff", fontWeight: bg.id === b.id ? 600 : 400 }}>{b.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditPanel({ layout, assignments, onSave, onClose }) {
  const [selLayout, setSelLayout] = useState(layout)
  const [selAssign, setSelAssign] = useState({ ...assignments })
  const [pickingSlot, setPickingSlot] = useState(null)
  const curLayout = LAYOUTS.find(l => l.id === selLayout)

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: CARD, borderRadius: "20px 20px 0 0", maxHeight: "88%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER }} />
        </div>
        <div style={{ padding: "14px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `0.5px solid ${BORDER}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Anpassa dashboard</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T3 }}>Avbryt</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Layout</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {LAYOUTS.map(l => (
              <button key={l.id} onClick={() => { setSelLayout(l.id); setSelAssign({}) }} style={{ flexShrink: 0, background: selLayout === l.id ? ACCENT_SOFT : BG, border: `1.5px solid ${selLayout === l.id ? ACCENT : BORDER}`, borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "center", minWidth: 82 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
                  {l.preview.map((row, ri) => (
                    <div key={ri} style={{ display: "flex", gap: 3 }}>
                      {row.map((span, ci) => (
                        <div key={ci} style={{ height: 14, background: selLayout === l.id ? ACCENT : T3, borderRadius: 3, flex: span, opacity: 0.6 }} />
                      ))}
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: selLayout === l.id ? ACCENT_TEXT : T2, whiteSpace: "nowrap" }}>{l.label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 0 10px" }}>Innehåll per ruta</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {curLayout.slots.map(slot => {
              const wid = selAssign[slot.id] || "tom"
              const def = WIDGET_DEFS.find(w => w.id === wid) || WIDGET_DEFS[WIDGET_DEFS.length - 1]
              return (
                <div key={slot.id}>
                  <button onClick={() => setPickingSlot(pickingSlot === slot.id ? null : slot.id)} style={{ width: "100%", background: BG, border: `1.5px solid ${pickingSlot === slot.id ? ACCENT : BORDER}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                    <span style={{ fontSize: 20 }}>{def.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>Ruta {slot.id}</div>
                      <div style={{ fontSize: 11, color: T3 }}>{def.label}</div>
                    </div>
                    <span style={{ fontSize: 12, color: T3 }}>{pickingSlot === slot.id ? "▲" : "▼"}</span>
                  </button>
                  {pickingSlot === slot.id && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 2px" }}>
                      {WIDGET_DEFS.map(w => (
                        <button key={w.id} onClick={() => { setSelAssign(a => ({ ...a, [slot.id]: w.id })); setPickingSlot(null) }} style={{ display: "flex", alignItems: "center", gap: 6, background: wid === w.id ? ACCENT_SOFT : CARD, border: `1.5px solid ${wid === w.id ? ACCENT : BORDER}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
                          <span style={{ fontSize: 16 }}>{w.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: wid === w.id ? ACCENT_TEXT : T1 }}>{w.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ padding: "12px 16px 28px", flexShrink: 0, borderTop: `0.5px solid ${BORDER}` }}>
          <button onClick={() => onSave(selLayout, selAssign)} style={{ width: "100%", background: ACCENT, color: "#fff", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Spara layout</button>
        </div>
      </div>
    </div>
  )
}

function GridDash({ layoutId, assignments, onEdit, widgetCtx }) {
  const layout = LAYOUTS.find(l => l.id === layoutId)
  const rowFrStr = layout.rowFr.map(f => `${f}fr`).join(" ")

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, flexShrink: 0 }}>
        <button onClick={onEdit} style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500, color: T2 }}>✏️ Anpassa</button>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${layout.cols},1fr)`, gridTemplateRows: rowFrStr, gap: 8, minHeight: 0 }}>
        {layout.slots.map(slot => {
          const wid = assignments[slot.id] || "tom"
          return (
            <div key={slot.id} style={{ gridColumn: `${slot.col} / span ${slot.colSpan}`, gridRow: `${slot.row} / span ${slot.rowSpan}`, background: CARD, borderRadius: 14, border: `0.5px solid ${BORDER}`, padding: 10, overflow: "hidden", minHeight: 0 }}>
              {renderWidget(wid, { ...widgetCtx, onEdit })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FullKal({ events }) {
  const now = new Date()
  const [vm, setVm] = useState(now.getMonth())
  const [vy, setVy] = useState(now.getFullYear())
  const firstDay = new Date(vy, vm, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const days = new Date(vy, vm + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let i = 1; i <= days; i++) cells.push(i)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const isToday = d => d === now.getDate() && vm === now.getMonth() && vy === now.getFullYear()
  const getWeek = d => {
    if (!d) return ""
    return getISOWeek(new Date(vy, vm, d)).week
  }

  // Group events for the visible month
  const eventsByDay = useMemo(() => groupEventsByDay(events, vy, vm), [events, vy, vm])

  return (
    <div style={{ background: CARD, borderRadius: 14, border: `0.5px solid ${BORDER}`, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `0.5px solid ${BORDER}` }}>
        <button onClick={() => { if (vm === 0) { setVm(11); setVy(y => y - 1) } else setVm(m => m - 1) }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: T2 }}>{"<"}</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: T1 }}>{MONTHS[vm].charAt(0).toUpperCase() + MONTHS[vm].slice(1)} {vy}</span>
        <button onClick={() => { if (vm === 11) { setVm(0); setVy(y => y + 1) } else setVm(m => m + 1) }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: T2 }}>{">"}</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "22px" }} />
          <col /><col /><col /><col /><col /><col /><col />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: `0.5px solid ${BORDER}` }}>
            <th style={{ padding: "6px 0", fontSize: 9, color: T3, textAlign: "center" }}>#</th>
            {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d, i) => (
              <th key={d} style={{ padding: "6px 2px", fontSize: 10, color: i >= 5 ? ACCENT : T3, fontWeight: 600, textAlign: "center", textTransform: "uppercase" }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi} style={{ borderBottom: wi < weeks.length - 1 ? `0.5px solid ${BORDER}` : "none" }}>
              <td style={{ padding: "4px 2px", textAlign: "center", borderRight: `0.5px solid ${BORDER}` }}>
                <span style={{ fontSize: 9, color: T3 }}>{week.find(d => d) ? getWeek(week.find(d => d)) : ""}</span>
              </td>
              {week.map((d, di) => {
                const evs = d ? (eventsByDay[d] || []) : []
                const today = d && isToday(d)
                return (
                  <td key={di} style={{ padding: "3px", verticalAlign: "top", borderRight: di < 6 ? `0.5px solid ${BORDER}` : "none", background: today ? "rgba(91,82,231,0.05)" : "transparent" }}>
                    {d && (
                      <>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: today ? ACCENT : "transparent", color: today ? "#fff" : di >= 5 ? ACCENT : T1, fontSize: 11, fontWeight: today ? 700 : 400, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>{d}</div>
                        {evs.map((ev, ei) => (
                          <div key={ei} style={{ display: "flex", flexDirection: "column", marginTop: 2, paddingLeft: 3, borderLeft: `2px solid ${ev.color}`, lineHeight: 1.1 }}>
                            <span style={{ fontSize: 8, color: T3, fontWeight: 600 }}>{ev.time}</span>
                            <span style={{ fontSize: 9, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TABS = [
  { key: "hem", label: "Hem", icon: "🏠" },
  { key: "kalender", label: "Kalender", icon: "📅" },
  { key: "listor", label: "Listor", icon: "☑️" },
  { key: "mat", label: "Mat", icon: "🍽️" },
  { key: "mer", label: "Mer", icon: "⚙️" }
]

export default function SmartHub({ session, household }) {
  const userId = session?.user?.id
  const householdId = household?.id

  const [tab, setTab] = useState("hem")
  const [bg, setBg] = useState(BACKGROUNDS[0])
  const [layoutId, setLayoutId] = useState("big-two-small")
  const [assignments, setAssign] = useState({ A: "kalender", B: "todo", C: "events" })
  const [editOpen, setEditOpen] = useState(false)

  const [todos, setTodos] = useState([])
  const [calEvents, setCalEvents] = useState([])
  const [meals, setMeals] = useState([])
  const [loaded, setLoaded] = useState({ todos: false, events: false, meals: false, layout: false })

  // ----- Load layout for this user -----
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadLayout() {
      const { data, error } = await supabase
        .from("layouts")
        .select("layout_id, assignments, bg_id")
        .eq("user_id", userId)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        console.error("[layouts] load:", error)
      } else if (data) {
        if (data.layout_id) setLayoutId(data.layout_id)
        if (data.assignments) setAssign(data.assignments)
        if (data.bg_id) {
          const found = BACKGROUNDS.find(b => b.id === data.bg_id)
          if (found) setBg(found)
        }
      }
      setLoaded(s => ({ ...s, layout: true }))
    }

    loadLayout()
    return () => { cancelled = true }
  }, [userId])

  // ----- Load todos + realtime -----
  useEffect(() => {
    if (!householdId) return
    let cancelled = false

    async function loadTodos() {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true })
      if (cancelled) return
      if (error) console.error("[todos] load:", error)
      else setTodos(data || [])
      setLoaded(s => ({ ...s, todos: true }))
    }
    loadTodos()

    const ch = supabase
      .channel(`todos:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos", filter: `household_id=eq.${householdId}` },
        payload => {
          setTodos(prev => {
            if (payload.eventType === "INSERT") {
              if (prev.some(t => t.id === payload.new.id)) return prev
              return [...prev, payload.new]
            }
            if (payload.eventType === "UPDATE") {
              return prev.map(t => t.id === payload.new.id ? payload.new : t)
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(t => t.id !== payload.old.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [householdId])

  // ----- Load calendar_events + realtime -----
  useEffect(() => {
    if (!householdId) return
    let cancelled = false

    async function loadEvents() {
      // Pull a generous window: 6 months back, 12 months forward.
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString()
      const to = new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString()

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("household_id", householdId)
        .gte("start_time", from)
        .lte("start_time", to)
        .order("start_time", { ascending: true })

      if (cancelled) return
      if (error) console.error("[calendar_events] load:", error)
      else setCalEvents(data || [])
      setLoaded(s => ({ ...s, events: true }))
    }
    loadEvents()

    const ch = supabase
      .channel(`events:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events", filter: `household_id=eq.${householdId}` },
        payload => {
          setCalEvents(prev => {
            if (payload.eventType === "INSERT") {
              if (prev.some(e => e.id === payload.new.id)) return prev
              return [...prev, payload.new]
            }
            if (payload.eventType === "UPDATE") {
              return prev.map(e => e.id === payload.new.id ? payload.new : e)
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(e => e.id !== payload.old.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [householdId])

  // ----- Load meals (current ISO week) + realtime -----
  const { week: currentWeek, year: currentYear } = useMemo(() => getISOWeek(new Date()), [])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false

    async function loadMeals() {
      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("household_id", householdId)
        .eq("week_number", currentWeek)
        .eq("year", currentYear)

      if (cancelled) return
      if (error) console.error("[meals] load:", error)
      else setMeals(data || [])
      setLoaded(s => ({ ...s, meals: true }))
    }
    loadMeals()

    const ch = supabase
      .channel(`meals:${householdId}:${currentYear}-${currentWeek}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meals", filter: `household_id=eq.${householdId}` },
        payload => {
          // Only react to current week
          const row = payload.new || payload.old
          if (!row) return
          if (row.week_number !== currentWeek || row.year !== currentYear) return

          setMeals(prev => {
            if (payload.eventType === "INSERT") {
              if (prev.some(m => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            }
            if (payload.eventType === "UPDATE") {
              return prev.map(m => m.id === payload.new.id ? payload.new : m)
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(m => m.id !== payload.old.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [householdId, currentWeek, currentYear])

  // ----- Toggle todo (writes to Supabase, realtime echoes back) -----
  async function handleToggleTodo(item) {
    const newDone = !item.done
    // Optimistic update
    setTodos(prev => prev.map(t => t.id === item.id ? { ...t, done: newDone, completed_at: newDone ? new Date().toISOString() : null } : t))
    const { error } = await supabase
      .from("todos")
      .update({ done: newDone, completed_at: newDone ? new Date().toISOString() : null })
      .eq("id", item.id)
    if (error) {
      console.error("[todos] toggle:", error)
      // Revert on failure
      setTodos(prev => prev.map(t => t.id === item.id ? item : t))
    }
  }

  // ----- Persist layout (debounced via simple effect) -----
  useEffect(() => {
    if (!userId || !loaded.layout) return
    const t = setTimeout(async () => {
      const { error } = await supabase
        .from("layouts")
        .upsert({
          user_id: userId,
          layout_id: layoutId,
          assignments,
          bg_id: bg.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" })
      if (error) console.error("[layouts] save:", error)
    }, 400)
    return () => clearTimeout(t)
  }, [userId, layoutId, assignments, bg, loaded.layout])

  const handleSave = (lid, assign) => {
    setLayoutId(lid)
    setAssign(assign)
    setEditOpen(false)
  }

  // ----- Derived data -----
  const now = new Date()
  const calEventsByDay = useMemo(
    () => groupEventsByDay(calEvents, now.getFullYear(), now.getMonth()),
    [calEvents]
  )
  const eventsToday = useMemo(() => getEventsToday(calEvents), [calEvents])

  const widgetCtx = {
    todos,
    onToggleTodo: handleToggleTodo,
    calEventsByDay,
    eventsToday,
    meals
  }

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: BG, display: "flex", flexDirection: "column", height: "100dvh", position: "relative", overflow: "hidden", zoom: 2.25 }}>
      <ClockHero bg={bg} onChangeBg={setBg} />
      <div style={{ display: "flex", borderBottom: `0.5px solid ${BORDER}`, background: CARD, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "7px 0 9px", borderBottom: tab === t.key ? `2px solid ${ACCENT}` : "2px solid transparent" }}>
            <span style={{ fontSize: 17 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: tab === t.key ? ACCENT : T3 }}>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: 10, minHeight: 0, overflow: "hidden" }}>
        {tab === "hem" && <GridDash layoutId={layoutId} assignments={assignments} onEdit={() => setEditOpen(true)} widgetCtx={widgetCtx} />}
        {tab === "kalender" && <div style={{ height: "100%", overflowY: "auto" }}><FullKal events={calEvents} /></div>}
        {tab === "listor" && <div style={{ height: "100%", overflowY: "auto" }}><div style={{ background: CARD, borderRadius: 14, border: `0.5px solid ${BORDER}`, padding: 16 }}><WidgetTodo todos={todos} onToggle={handleToggleTodo} /></div></div>}
        {tab === "mat" && <div style={{ height: "100%", overflowY: "auto" }}><div style={{ background: CARD, borderRadius: 14, border: `0.5px solid ${BORDER}`, padding: 16 }}><WidgetMat meals={meals} /></div></div>}
        {tab === "mer" && <div style={{ background: CARD, borderRadius: 14, border: `0.5px solid ${BORDER}`, padding: 16, color: T3, fontSize: 14 }}>Inställningar</div>}
      </div>
      {editOpen && <EditPanel layout={layoutId} assignments={assignments} onSave={handleSave} onClose={() => setEditOpen(false)} />}
    </div>
  )
}
