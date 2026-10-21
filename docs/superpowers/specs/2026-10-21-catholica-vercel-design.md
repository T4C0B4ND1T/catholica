# Catholica on Vercel: Design Spec

Approved by Joel on 2026-10-21. Living copy: https://claude.ai/artifact/LBUTPmMqQAuJYBbbgKXH8M

## Goal and success criteria

Build a new, personal Catholica site on Vercel: a simple, mobile-first Mass companion whose Scripture and bulletin always come from the real source, never from AI. It replaces the AI Studio app in `T4C0B4ND1T/Gemini-Apps`.

Done means:

- Today's readings open in one tap from the home screen, verbatim from USCCB, with the source shown.
- The liturgical year cycle is right across Advent (Year B from Sunday, Nov 29, 2026).
- The Bulletin tab shows St. Anselm's actual PDFs, from Aug 2023 to the newest, searchable by text.
- Notes, bookmarks, intentions and routines follow Joel between phone and computer.
- The next 7 days of readings, the Order of the Mass and the newest bulletin open with no signal in church.
- A failed weekly bulletin or daily readings pull emails Joel.
- Every screen works one-handed at phone width, in light and dark.

## Decisions made

| Question | Decision |
| --- | --- |
| Audience | Just Joel, personal use |
| Features in v1 | All eight: readings + calendar, Order of the Mass, St. Anselm bulletin, Catechism, AI reflection, prayer routines, listen aloud, notes/bookmarks/intentions |
| Personal data | Synced across devices with sign-in, stored in Supabase |
| Code | New private GitHub repo `T4C0B4ND1T/catholica` |
| AI provider | Gemini, reusing the existing key |
| Main use | In the pew at Mass, and preparing for Sunday during the week |
| Stack | Next.js on Vercel + Supabase |
| Visual style | The Serif design system (`docs/design/serif-design-system.md`), not the old burgundy look |
| Dark mode | Yes, a matching warm dark theme |
| Translation | NABRE from USCCB, the text read at US Masses |

## Architecture

One Next.js app on Vercel, with Supabase for the database, files and sign-in. Scheduled jobs copy content from the real sources into Supabase; the screens never call USCCB or the parish site directly.

```
USCCB ──────────┐                 ┌─ Postgres (readings, bulletins, notes…)
St. Anselm site ─┴─> Vercel cron ──┤
Catechism site ──┐                 ├─ Storage (bulletin PDFs)
Gemini API ──────┴─> Next.js app ──┴─ Auth (Google, Joel only)
                         │
                         └─> Joel's phone (installed, offline cache of next 7 days)
```

Gemini is only called by the server and only for signed-in use. Vercel deploys each push to `main` after tests pass.

## Content sources

| Content | Source | How it is fetched | Shown as |
| --- | --- | --- | --- |
| Daily readings (NABRE) | USCCB daily page, `bible.usccb.org/bible/readings/MMDDYY.cfm` | Parsed into First Reading, Psalm, Second Reading, Alleluia, Gospel; saved per date | Verbatim, with "Source: USCCB" and a link |
| Feast, season, color, cycle | Computed in code (Advent-aware cycle, Easter date, seasons); feast name from the USCCB page | Pure functions, tested | Header of the Today screen |
| St. Anselm bulletin | `https://stanselmparish.org/bulletins`, files at `files.ecatholic.com/17181/bulletins/YYYYMMDD.pdf?t=…` | Read the list page, download new PDFs, extract text; one-time backfill to Aug 6, 2023 | The real PDF, plus text search |
| Catechism | Verbatim paragraphs from catholiccrossreference.online (as the old app did) | Fetched by paragraph number and cached | Verbatim with paragraph number |
| Order of the Mass | Old app's `src/data/orderOfMassData.ts` (30 steps) | Copied into the new repo | Steps with posture |
| Daily reflection | Gemini, given that day's saved readings | Written once per date, stored | Labeled "AI reflection" |
| Catechism Q&A | Gemini, answering with paragraph numbers that link to the verbatim text | On demand, signed in only | Labeled "AI answer" |

If USCCB cannot be reached, the app shows the last saved copy or a link to USCCB. It never falls back to AI text for Scripture.

## Screens

Four tabs in a bottom bar, sized for one thumb. On a computer the same tabs sit in a top bar over a centered reading column.

**Today** (home)

- Header: date chip (tap opens a month calendar to jump to any day), feast name, season and a small dot in the liturgical color, cycle (e.g. "Year B · Week I").
- Readings as swipeable cards: First Reading, Psalm, Second Reading (Sundays and solemnities), Gospel. Each has a speaker button and a bookmark button.
- "Follow the Mass" button that opens the Mass tab with today's readings slotted in.
- AI reflection, collapsed by default, clearly labeled.
- "This Sunday" card (Monday to Saturday): the coming Sunday's feast and Gospel reference, and the newest bulletin's cover with "Open bulletin".
- Footer line: "Readings from USCCB, updated 3:02 AM".

**Mass**

- The Order of the Mass as one scrolling page with a step rail; the current posture (stand, sit, kneel) is a large icon pinned at the top.
- The day's readings appear inside the Liturgy of the Word steps.
- Keep-screen-awake while this tab is open.

**Bulletin**

- Newest PDF first, opening full screen with pinch zoom.
- Search box over the text of every bulletin, results showing date and a snippet.
- Archive list grouped by year, back to Aug 2023.

**Me**

- Prayer routines: daily checklist (Morning Offering, Angelus, Rosary, Examen, editable), ticks reset each day.
- Notes per date, bookmarked readings, prayer intentions with an "answered" toggle.
- Catechism: search by paragraph number or keyword, plus the AI Q&A box.
- Settings: theme (light, dark, auto), text size, listen-aloud voice and speed, sign in and out.

Listen aloud uses the phone's built-in text-to-speech, so it costs nothing and works offline.

## Visual design

Follows the Serif design system: editorial, warm, quiet. Tokens live once, as CSS variables mapped into Tailwind, so no screen hard-codes a color.

| Token | Light | Dark (derived) |
| --- | --- | --- |
| background | #FAFAF8 | #161513 |
| foreground | #1A1A1A | #F2EFEA |
| muted | #F5F3F0 | #211F1C |
| muted-foreground | #6B6B6B | #A8A29A |
| card | #FFFFFF | #1D1B19 |
| border | #E8E4DF | #34302B |
| accent | #B8860B | #D4A84B |
| accent-secondary | #D4A84B | #E2BE6E |
| accent-foreground (text on gold) | #1A1A1A | #161513 |
| accent-ink (gold text and icons) | #8A6508 | #D4A84B |

- **Type:** Playfair Display for headings, feast names and reading titles; Source Sans 3 for body, readings and UI (readings at 19px, line height 1.75, max 34em wide); IBM Plex Mono small caps (0.75rem, 0.15em tracking) for labels, dates and citations.
- **Rules:** 1px warm rules as section dividers; the ruled small-caps section label heads each block; featured cards (Gospel, This Sunday) have a 2px gold top rule.
- **Liturgical color:** only a small dot and a thin rule under the feast name; gold stays the single accent.
- **Mobile:** 24 to 32px between sections; touch targets at least 44px; no horizontal scroll at 360px wide.
- **Motion:** 200ms ease-out fades only; none under reduced motion.
- **Texture:** subtle paper-noise overlay in light mode only.
- **Accessibility:** WCAG AA contrast in both themes, gold focus rings, text size 90% to 150%.

## Data model, sync and offline

Shared content is public-read; personal rows are readable only by their owner through row-level security. Only Joel's Google account can sign in (an allowlist checked on sign-in).

| Table | Key fields | Written by |
| --- | --- | --- |
| `readings` | date, feast, season, color, cycle, sections (JSON: title, citation, text), source_url, fetched_at | Daily job |
| `reflections` | date, text, model, created_at | Daily job |
| `bulletins` | sunday_date, source_url, storage_path, page_count, text, fetched_at | Bulletin job |
| `job_runs` | job, started_at, status, message | Every job |
| `notes` | user_id, date, body, updated_at | App |
| `bookmarks` | user_id, date, section, created_at | App |
| `intentions` | user_id, text, answered_at, created_at | App |
| `routines` / `routine_ticks` | user_id, name, order / routine_id, date | App |

- Bulletin PDFs in a Supabase Storage bucket, served through the app.
- Postgres full-text search on `bulletins.text`.
- Service worker caches the app shell, Order of the Mass, next 7 days of readings and reflections, and the newest bulletin PDF; other dates once viewed.
- Personal edits save to the phone first (IndexedDB) and sync when online; last edit wins per row.
- Web manifest named "Catholica".

## Scheduled jobs and failures

Two Vercel cron jobs, once a day each, protected by a secret.

| Job | Runs | Does | On failure |
| --- | --- | --- | --- |
| Readings | Daily, 3:00 AM Central | Fetches the next 8 days from USCCB not saved yet, then writes each new date's reflection with Gemini | Retries each date 3 times; logs to `job_runs`; emails Joel if any date for the next 2 days is still missing |
| Bulletin | Daily, 6:00 AM Central | Reads the bulletin list page, downloads any PDF not saved yet, extracts text | Logs to `job_runs`; emails Joel if no bulletin newer than 8 days exists by Monday |

- One-time backfill script loads the archive back to Aug 6, 2023.
- Failure emails via Resend to Joel.
- The app shows each source's last successful update.
- Gemini failing only hides the reflection; readings still show.

## Testing

- Liturgical calendar unit tests: cycle A/B/C and weekday I/II around each First Sunday of Advent 2025 to 2030; Easter dates; season boundaries; known feasts.
- Parser unit tests on saved pages: USCCB Sunday, weekday, solemnity with options, vigil; parish bulletin list page; one real PDF's text.
- Data rules: a second account cannot read Joel's notes; jobs reject calls without the secret.
- Playwright at 390px: four tabs render in light and dark; Today reaches the Gospel in two taps; offline reload shows today's readings.
- Deployed-site check on a phone-size browser, screenshots in the PR.

## Out of scope

Other parishes, other users, push notifications, native app store app, Liturgy of the Hours, migrating data from the old app.
