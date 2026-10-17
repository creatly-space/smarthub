// Källan till den deployade edge-funktionen push-reminders (version 8).
// Låg tidigare bara i Supabase. Deploya ändringar härifrån.
//
// Kallas av pg_cron var femte minut (cron.job 1, "smarthub-push-reminders").
// Var femte och inte varje minut: varje körning skriver till
// cron.job_run_details och net._http_response, och på minsta instansen tömde
// det disk-I/O-budgeten så att hela databasen ströps (2026-10-17). Dubblett-
// skyddet i push_sent_log gör att ett bredare fönster aldrig ger dubbla notiser.
import webpush from "npm:web-push@3.6.7"
import { createClient } from "npm:@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || ""
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || ""
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:smarthub@example.com"

// Cron-intervallet. Fönstret täcker en hel period bakåt plus lite framåt.
const INTERVAL_MS = 5 * 60 * 1000
const WINDOW_BEFORE_MS = INTERVAL_MS + 30 * 1000
const WINDOW_AFTER_MS = 30 * 1000

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

// Expanderar välåterkommande events för att hitta deras nästa förekomst.
function nextOccurrence(event: any, now: Date): Date | null {
  const start = new Date(event.start_time)
  if (!event.recurrence_rule || !event.recurrence_rule.freq) {
    return start >= now ? start : null
  }
  const rule = event.recurrence_rule
  const until = rule.until ? new Date(rule.until + "T23:59:59") : null
  let cursor = new Date(start)
  let safety = 0
  while (cursor < now && safety < 1000) {
    safety++
    if (rule.freq === "daily") cursor = new Date(cursor.getTime() + 86400000)
    else if (rule.freq === "weekdays") {
      cursor = new Date(cursor.getTime() + 86400000)
      while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor = new Date(cursor.getTime() + 86400000)
    }
    else if (rule.freq === "weekly") cursor = new Date(cursor.getTime() + 7 * 86400000)
    else if (rule.freq === "monthly") cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate(), cursor.getHours(), cursor.getMinutes())
    else if (rule.freq === "yearly") cursor = new Date(cursor.getFullYear() + 1, cursor.getMonth(), cursor.getDate(), cursor.getHours(), cursor.getMinutes())
    else return null
  }
  if (until && cursor > until) return null
  return cursor
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys saknas" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const now = new Date()
  // Förekomsten kan ha passerat med upp till en period när påminnelsen ligger
  // nära starten, så nextOccurrence räknas från fönstrets början.
  const windowStart = new Date(now.getTime() - WINDOW_BEFORE_MS)
  const fromIso = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  const toIso = new Date(now.getTime() + 48 * 3600 * 1000).toISOString()
  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("id, title, start_time, end_time, all_day, reminder_minutes, household_id, created_by, recurrence_rule")
    .not("reminder_minutes", "is", null)
    .gte("start_time", fromIso)
    .lte("start_time", toIso)
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  let triggered = 0
  for (const ev of events || []) {
    const occurrence = nextOccurrence(ev, windowStart)
    if (!occurrence) continue
    const reminderTime = new Date(occurrence.getTime() - (ev.reminder_minutes * 60000))
    const diffMs = reminderTime.getTime() - now.getTime()
    if (diffMs < -WINDOW_BEFORE_MS || diffMs > WINDOW_AFTER_MS) continue

    const { data: members } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", ev.household_id)
    const userIds = (members || []).map((m: any) => m.user_id)
    if (userIds.length === 0) continue

    // Filtrera bort de som redan fått påminnelse för detta event-occurrence
    const occKey = ev.id + "@" + occurrence.toISOString()
    const { data: alreadySent } = await supabase
      .from("push_sent_log")
      .select("user_id")
      .eq("source_table", "calendar_events")
      .eq("source_id", occKey)
      .eq("kind", "reminder")
    const sentSet = new Set((alreadySent || []).map((r: any) => r.user_id))
    const targetUserIds = userIds.filter((u: string) => !sentSet.has(u))
    if (targetUserIds.length === 0) continue

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds)

    const dateStr = occurrence.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" })
    const timeStr = ev.all_day ? "" : occurrence.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" })
    const payload = {
      title: ev.title,
      body: ev.all_day ? `${dateStr}` : `${dateStr} kl ${timeStr}`,
      tag: "reminder-" + ev.id,
      data: { url: "/?tab=kalender", event_id: ev.id },
    }

    const expired: string[] = []
    await Promise.all((subs || []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        )
        await supabase.from("push_sent_log").insert({
          user_id: s.user_id,
          source_table: "calendar_events",
          source_id: occKey,
          kind: "reminder",
        })
      } catch (e: any) {
        if (e?.statusCode === 410 || e?.statusCode === 404) expired.push(s.id)
        console.warn("[reminder fail]", e?.statusCode)
      }
    }))
    if (expired.length > 0) await supabase.from("push_subscriptions").delete().in("id", expired)
    triggered++
  }

  return new Response(JSON.stringify({ triggered, scanned: events?.length || 0, time: now.toISOString() }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
