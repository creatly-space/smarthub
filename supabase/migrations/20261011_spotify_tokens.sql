-- Spotify-koppling för hushållet.
--
-- En rad per hushåll, inte per person: väggskärmen är gemensam, och den som
-- kopplar är det konto köket styr.
--
-- RLS är påslagen men tabellen har MED FLIT noll policies. En refresh token
-- är i praktiken full åtkomst till Spotify-kontot, och klienten kör med
-- anon-nyckeln — alltså ska den aldrig kunna läsa den här tabellen alls.
-- Bara edge-funktionen `spotify` rör den, via service role, som går förbi RLS.
-- Vill klienten veta om kopplingen finns frågar den funktionen, inte tabellen.

create table if not exists public.spotify_tokens (
  household_id   uuid primary key references public.households(id) on delete cascade,
  access_token   text        not null,
  refresh_token  text        not null,
  expires_at     timestamptz not null,
  scope          text,
  spotify_user   text,
  display_name   text,
  connected_by   uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now()
);

alter table public.spotify_tokens enable row level security;

comment on table public.spotify_tokens is
  'Spotify OAuth-tokens per hushåll. Noll RLS-policies med flit — endast edge-funktionen spotify (service role) läser och skriver här.';
