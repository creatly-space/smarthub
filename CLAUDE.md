# SmartHub — projektkontext och underhåll

## Vad det är
SmartHub är en familje-dashboard för hushållet. Den körs på två ytor:

1. **Köks-TV:n** — en vertikal touchskärm (1080×1920 portrait) på väggen i köket,
   driven av en Raspberry Pi 4 i Chromium kiosk-läge. Alltid på. Visas via
   `?mode=tv`. Designas för att läsas på avstånd och petas på med fingrar —
   inget tangentbord.
2. **Mobilen** — samma app, portal-vy. Här sker all tyngre inmatning och
   administration. Två användare i hushållet: jag och Carro.

Data delas household-scopat och syncas live mellan ytorna via Supabase realtime.

Funktioner idag: klock-hero med swappbara gradient-bakgrunder, tabs
(Hem/Kalender/Listor/Mat/Mer), modulärt widget-rutnät med tilldelningsbara
widgets, kalender, multi-list (todo + inköpslista med autocomplete),
veckomatsedel, AI-chattbubbla.

Det här är ett **löpande underhållsprojekt**, inte ett engångsbygge. Vi
itererar i småsteg: buggar in, features ut, deploy, testa på väggen, repeat.

## Stack & infra
- **Frontend:** React + Vite. Merparten av appen ligger i `src/SmartHub.jsx`
  (stor fil).
- **Backend:** Supabase, project `cubalhwxderwpcalfdzw` (region Stockholm),
  RLS påslagen på allt.
- **Repo:** github.com/creatly-space/smarthub (privat)
- **Dev-miljö:** GitHub Codespaces
- **Deploy:** Vercel, auto-deploy från `main`. Live på smarthub-sigma.vercel.app
- **Env vars i Vercel:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Pi:n:** `ssh smarthub@smarthub.local`, labwc autostart roterar skärmen 270°
  och startar Chromium i kiosk-läge

### Repo-layout
- `src/SmartHub.jsx` — nästan hela appen (TV-läge + mobil-portal)
- `src/components/` — Login, Onboarding, Header, BottomNav, LogoutButton
- `src/lib/supabase.js` — Supabase-klient
- `src/data/groceries.json` — autocomplete-data för inköpslistan
- `SmartHub_v8.jsx`, `SmartHub_v9.jsx`, `SmartHub_v10.jsx` i roten är gamla
  versioner som ligger kvar som referens — rör inte, koden som körs är `src/`.

### Tabeller
`households`, `household_members`, `todos`, `calendar_events`, `meals`,
`layouts`, `devices`. RLS-helper: `is_household_member()`. Realtime publicerad
på todos, calendar_events, meals, layouts.

Databasen innehåller dessutom (verifierat via pg_policies 2026-08-11):
`activity_log`, `countdowns`, `food_preferences`, `invites`, `lists`,
`push_subscriptions`, `shopping_items`, `tv_layouts`.

### Verifierat schema (kollat i Supabase — anta inte annat)
- `calendar_events`: id, household_id, title, start_time (timestamptz),
  end_time (timestamptz), location, **color**, created_by, created_at, shared,
  recurrence_rule (jsonb), reminder_minutes, **all_day**
  → `color` och `all_day` FINNS redan. Saknas: `icon`.
- `household_members`: household_id, user_id, role, joined_at, display_name
  → saknar theme-fält
- `households`: id, name, created_by, created_at
  → saknar tv_theme
- `layouts`: user_id, layout_id, assignments (jsonb), bg_id, updated_at

### Verifierade RLS-policies (kollat via pg_policies 2026-08-11 — anta inte annat)

Mönster som återkommer:
- **"member"** = `is_household_member(household_id)` eller motsvarande
  subquery mot `household_members` med `auth.uid()`.
- **"shared/owner"** = `(shared = true AND member) OR (shared = false AND created_by = auth.uid())`.
- **"own"** = `auth.uid() = user_id`.

Per tabell:

| Tabell | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `calendar_events` | shared/owner | member | endast skapare | endast skapare |
| `todos` | shared/owner | member | shared/owner | shared/owner |
| `lists` | shared/owner | member | endast skapare | endast skapare |
| `meals` | member | member | member | member |
| `countdowns` | member | member | endast skapare | endast skapare |
| `devices` | member | member (ALL) | member (ALL) | member (ALL) |
| `layouts` | own | own | own | **ingen policy** |
| `tv_layouts` | member | member | member | **ingen policy** |
| `households` | member | alla inloggade (`with_check true`) | endast `role = 'owner'` | ingen policy |
| `household_members` | own memberships + member | endast sig själv | ingen policy | ingen policy |
| `invites` | **alla inloggade** + member | member | inloggad där `used_by IS NULL` | ingen policy |
| `activity_log` | member | member + `user_id = auth.uid()` | ingen policy | ingen policy |
| `shopping_items` | member | member (ALL) | member (ALL) | member (ALL) |
| `food_preferences` | own | own (ALL) | own (ALL) | own (ALL) |
| `push_subscriptions` | own | own (ALL) | own (ALL) | own (ALL) |

Fallgropar att komma ihåg:
- `calendar_events` och `lists`: den andra i hushållet kan LÄSA delade poster
  men inte ändra/ta bort dem — bara skaparen kan. `todos` tillåter däremot
  update/delete av delade todos för alla medlemmar.
- `layouts` och `tv_layouts` saknar DELETE-policy — en delete från klienten
  misslyckas tyst (0 rader). Använd upsert/update i stället.
- `invites` är läsbara för ALLA inloggade användare (krävs för join-flödet),
  inte bara hushållsmedlemmar.
