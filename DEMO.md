# SmartHub

En familje-dashboard för hushållet. Den lever på två ytor samtidigt:

**Köks-TV:n** — en vertikal touchskärm (1080×1920) på väggen i köket, driven av
en Raspberry Pi 4 i Chromium kiosk-läge. Alltid på, läses på avstånd, petas på
med fingrar. Inget tangentbord.

**Mobilen** — samma app, portal-vy. Här sker all tyngre inmatning.

Allt är household-scopat och synkas live mellan ytorna via Supabase realtime.
Bockar någon av en punkt i mobilen försvinner den från väggen direkt.

---

## Testa själv

Ingen inloggning behövs, allt är påhittad data:

| | |
|---|---|
| **Mobil / desktop** | https://smarthub-sigma.vercel.app/?demo=1 |
| **Köks-TV:n** | https://smarthub-sigma.vercel.app/?demo=1&mode=tv |

TV-läget är byggt för 1080×1920 stående. På en vanlig skärm ser det avlångt
ut — smalna webbläsarfönstret, eller kör mobilläget i devtools.

Demot kör helt i minnet. Du kan lägga till, bocka av, redigera och ta bort hur
du vill; ingenting sparas och en omladdning återställer allt. Det finns ingen
koppling till hushållets riktiga data — i demoläget skapas ingen
databasanslutning över huvud taget.

### Värt att prova

- **Kalendern på mobilen** — månadsvyn visar prickar och ikoner som en vanlig
  kalender, veckovyn visar titlar och tider. Tap på en dag ger hela listan.
- **Redigera en händelse** — tap på den i dagvyn. Ikonen föreslås utifrån
  titeln: skriv "tandläkare" och se vad som händer.
- **Färgtema** — Mer → Inställningar → Färgtema. Sex teman, och mobilen och
  TV:n har varsin inställning.
- **På TV:n** — tap på en händelse ger en popover med stora knappar i stället
  för ett formulär. Det finns inget tangentbord på en vägg.
- **Matsedeln och listorna** — tap för att fylla i. Avbockat försvinner helt
  från TV:n men ligger kvar hopfällt i mobilen.

---

## Stack

- **Frontend:** React + Vite. Merparten ligger i `src/SmartHub.jsx` — en stor
  fil, medvetet, för att det är ett hobbyprojekt som itereras i småsteg.
- **Backend:** Supabase (Postgres + realtime + auth + edge functions), RLS
  påslagen på allt.
- **Deploy:** Vercel, auto-deploy från `main`.
- **Kiosken:** Raspberry Pi 4, labwc som roterar skärmen 270°, Chromium i
  kiosk-läge.

### Kod värd att titta på

| Fil | Vad |
|---|---|
| `src/SmartHub.jsx` | Nästan hela appen — båda ytorna |
| `src/lib/time.js` | All tidshantering (se nedan) |
| `src/lib/demo.js` | Demoläget: fejkdata + en liten PostgREST-liknande klient i minnet |
| `CLAUDE.md` | Projektkontext, verifierat schema och alla RLS-policies |

---

## Två saker som var lärorika

**Tidszoner bet hårt.** `start_time` är `timestamptz`, men appen skickade in
tidszonslösa strängar (`"2026-08-11T14:00:00"`). Postgres-sessionen står på UTC
och tolkade dem därefter, så 14:00 lagrades som 14:00 UTC och visades sedan som
16:00 svensk tid. Ovanpå det renderades tid via enhetens tidszon — och en
Raspberry Pi som inte fått sin tidszon satt står på UTC, så väggen kunde visa
fel medan mobilen visade rätt. Numera går allt genom `src/lib/time.js`, som
tvingar `Europe/Stockholm` explicit åt båda hållen. Återkommande händelser
stegar dessutom i väggtid och inte i millisekunder, så ett träningspass 18:00
ligger kvar 18:00 efter sommartidsskiftet.

**En nekad skrivning ser ut som en lyckad.** Utan `.select()` returnerar en
RLS-blockerad update i Supabase `error: null` och noll rader. Funktionen som
sparade visningsnamn saknade det, och `household_members` saknade dessutom en
UPDATE-policy — så namnbyten hade misslyckats tyst i månader utan att någon
märkte det. Alla skrivningar som kan nekas har nu `.select()` och kontrollerar
att något faktiskt ändrades.
