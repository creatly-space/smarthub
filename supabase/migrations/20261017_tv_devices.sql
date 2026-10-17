-- Väggskärmar som loggar in utan lösenord.
--
-- Pi:n har en hemlig enhetsnyckel i sin kiosk-adress (?device=…). Edge-
-- funktionen `tv-login` tar emot nyckeln, slår upp dess hash här och ger
-- tillbaka en engångslänk för TV-kontot, som klienten växlar mot en session.
-- Väggen har inget tangentbord och ingen ska behöva stå där med ett lösenord.
--
-- Bara hashen sparas: läcker tabellen går nyckeln inte att återskapa. Nyckeln
-- själv ligger på Pi:n i ~/.config/smarthub-device och i labwc-autostart.
-- RLS är på och har MED FLIT noll policies — bara edge-funktionen (service
-- role) läser tabellen. Spärra en skärm genom att sätta revoked_at.

create table if not exists public.tv_devices (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  key_hash      text not null unique,
  label         text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index if not exists tv_devices_household_idx on public.tv_devices(household_id);
create index if not exists tv_devices_user_idx on public.tv_devices(user_id);

alter table public.tv_devices enable row level security;

comment on table public.tv_devices is
  'Enhetsnycklar (sha256) för väggskärmar. Noll RLS-policies med flit — endast edge-funktionen tv-login (service role) läser här.';
