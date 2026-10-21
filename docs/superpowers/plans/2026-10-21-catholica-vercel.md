# Catholica on Vercel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A personal, mobile-first Catholic Mass companion on Vercel whose readings and bulletins are copied verbatim from USCCB and St. Anselm Parish, with synced personal data and offline use in church.

**Architecture:** One Next.js App Router app. Two Vercel cron routes copy USCCB readings and St. Anselm bulletin PDFs into Supabase (Postgres + Storage); pages read only from Supabase. Supabase Auth (Google) gates personal data and Gemini calls to one allowlisted email. A hand-written service worker caches the shell and the coming week.

**Tech Stack:** Next.js 16 (App Router, TypeScript, React 19), Tailwind CSS v4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI migrations), `cheerio` (HTML parsing), `unpdf` (PDF text), `@google/genai` (Gemini), `resend` (alerts), `idb-keyval` (offline outbox), `lucide-react` (icons), Vitest, Playwright, pnpm, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-21-catholica-vercel-design.md` (design system: `docs/design/serif-design-system.md`)

## Global Constraints

- Scripture, Catechism and bulletin text are only ever copied from their source. No code path may send AI-generated text to a readings, Catechism-paragraph or bulletin field. AI text is stored only in `reflections` and returned only by `/api/catechism/ask`, always rendered under a label reading "AI reflection" or "AI answer".
- Translation label: "NABRE · Source: USCCB" with a link to the day's `sourceUrl`.
- All calendar dates are `YYYY-MM-DD` strings in `America/Chicago`. Never use `new Date('YYYY-MM-DD')` local getters for liturgical math; use UTC-noon dates internally.
- Liturgical year starts on the First Sunday of Advent. Sunday cycle: liturgical year (calendar year + 1 from Advent on) mod 3: 1 → A, 2 → B, 0 → C. Weekday cycle: even liturgical year → II, odd → I.
- Colors only through CSS variables in `src/app/globals.css`; components use Tailwind token classes (`bg-background`, `text-accent`, …), never hex.
- Fonts via `next/font/google`: Playfair Display (`--font-display`), Source Sans 3 (`--font-sans`), IBM Plex Mono (`--font-mono`).
- Touch targets ≥ 44px; no horizontal scroll at 360px; motion 200ms ease-out fades only, disabled under `prefers-reduced-motion`.
- Only the email in env `ALLOWED_EMAIL` may hold a session; any other sign-in is signed out and shown "This Catholica is private."
- Cron routes require header `Authorization: Bearer ${CRON_SECRET}`; otherwise 401.
- Env vars (all in Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL`, `CRON_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), `RESEND_API_KEY`, `ALERT_EMAIL`. Missing `RESEND_API_KEY` = alerts logged to `job_runs` only.
- Outbound fetches send `User-Agent: Catholica/1.0 (personal use)` and time out after 15s.
- This cloud container's proxy blocks usccb.org and the parish hosts; fetch live pages from a Vercel Sandbox or a deployed preview, never invent fixture HTML.

## Review Focus

1. **A USCCB day with alternate readings or several Masses** (Christmas, Easter Vigil, Palm Sunday, a memorial with "or" options): the parser keeps every section in page order with its own title, never merging or dropping one. Test in Task 4 (`christmas` fixture).
2. **Late or missing bulletin** (parish posts Tuesday, or skips a week): the job stays green and Today shows the newest bulletin it has, labeled with its date; the alert fires only by the Monday rule. Test in Task 6.
3. **Opening the app offline on a date not cached:** Today shows "Not saved for offline. Connect to load, or open USCCB." with the USCCB link, never a blank screen or error. Test in Task 13.
4. **Signing in with a second Google account:** session is refused and nothing personal is readable. Tests in Task 3.
5. **Date near midnight / DST change:** "today" is Chicago's date, not UTC's (a 11:30 PM Saturday visit shows Saturday). Test in Task 2 (`todayInChicago`).

---

## File Structure

```
src/
  app/
    layout.tsx, globals.css, manifest.ts         shell, fonts, tokens, PWA manifest
    (tabs)/layout.tsx                            bottom/top tab bar
    (tabs)/page.tsx                              Today (accepts ?date=)
    (tabs)/mass/page.tsx                         Order of the Mass
    (tabs)/bulletin/page.tsx, [date]/page.tsx    archive + viewer
    (tabs)/me/page.tsx                           routines, notes, bookmarks, intentions, catechism, settings
    auth/callback/route.ts, auth/signin/page.tsx
    api/cron/readings/route.ts, api/cron/bulletin/route.ts
    api/readings/[date]/route.ts                 JSON for client + SW prefetch
    api/bulletins/[date]/pdf/route.ts, api/bulletins/search/route.ts
    api/catechism/[num]/route.ts, api/catechism/ask/route.ts
    api/me/[collection]/route.ts                 personal CRUD
  lib/
    types.ts, dates.ts
    liturgical/calendar.ts
    sources/http.ts, sources/usccb.ts, sources/bulletins.ts, sources/catechism.ts
    ai/gemini.ts
    db/server.ts, db/admin.ts, db/browser.ts, db/readings.ts, db/bulletins.ts, db/jobs.ts
    jobs/readings-job.ts, jobs/bulletin-job.ts, jobs/alert.ts
    auth/allowlist.ts
    offline/outbox.ts
  components/ui/ (Button, Card, SectionLabel, Rule, IconButton, Sheet)
  components/ (TabBar, DateChip, MonthCalendar, ReadingCard, ReadingsCarousel, ReflectionPanel,
               ThisSundayCard, SourceFooter, SpeakButton, BookmarkButton, PostureBadge, MassStep,
               PdfViewer, ThemeProvider, SettingsPanel)
  data/order-of-mass.ts
  proxy.ts       (Next 16 name for middleware)
public/sw.js, public/icons/*
supabase/migrations/0001_init.sql, supabase/seed.sql
scripts/backfill-bulletins.ts, scripts/capture-fixtures.ts
tests/unit/**, tests/fixtures/**, tests/e2e/**
vercel.json, .github/workflows/ci.yml
```

---

### Task 1: Scaffold, design tokens and CI

**Files:**
- Create: Next.js app via `pnpm create next-app@latest . --ts --tailwind --app --src-dir --eslint --use-pnpm --import-alias "@/*"`
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/{Button,Card,SectionLabel,Rule}.tsx`, `src/components/ThemeProvider.tsx`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.env.example`, `README.md`
- Test: `tests/unit/tokens.test.ts`, `tests/e2e/shell.spec.ts`

**Interfaces:**
- Produces: Tailwind token classes `background foreground muted muted-foreground card border accent accent-secondary ring`; font classes `font-display font-sans font-mono`; utility class `small-caps`; `<SectionLabel>{text}</SectionLabel>`, `<Card featured?>`, `<Button variant="primary"|"outline"|"ghost">`; `ThemeProvider` setting `data-theme="light"|"dark"` on `<html>` from `localStorage['catholica.theme']` (`light|dark|auto`) and `data-text-scale` (0.9–1.5) as `--text-scale`.

- [ ] **Step 1: Scaffold and add deps** — run the create command above, then `pnpm add @supabase/supabase-js @supabase/ssr cheerio unpdf @google/genai resend idb-keyval lucide-react` and `pnpm add -D vitest @vitejs/plugin-react @playwright/test tsx supabase`.
- [ ] **Step 2: Write failing test** `tests/unit/tokens.test.ts`: reads `src/app/globals.css` and asserts it contains `--background: #FAFAF8`, `--accent: #B8860B`, `--border: #E8E4DF`, and under `[data-theme="dark"]` `--background: #161513`, `--accent: #D4A84B` (all 8 tokens × 2 themes from the spec table).
- [ ] **Step 3: Run** `pnpm vitest run tests/unit/tokens.test.ts` → FAIL.
- [ ] **Step 4: Implement** `globals.css` with `:root` light tokens, `[data-theme="dark"]` dark tokens, `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` for auto, Tailwind v4 `@theme inline` mapping, `body { font-size: calc(1rem * var(--text-scale, 1)); line-height: 1.75 }`, `.small-caps` exactly as in the design system, light-mode paper-noise overlay (inline SVG data URI, 30% opacity, `pointer-events:none`), `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important } }`. `layout.tsx` loads the three fonts with `display: 'swap'` and an inline pre-paint script that applies the saved theme to avoid a flash.
- [ ] **Step 5: Run** unit test → PASS.
- [ ] **Step 6: Add e2e** `tests/e2e/shell.spec.ts` at viewport 390×844: home responds 200, `document.documentElement.scrollWidth <= 390`. Playwright uses `executablePath: '/opt/pw-browsers/chromium'` when that file exists.
- [ ] **Step 7: CI** `ci.yml` on push/PR: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm tsc --noEmit`, `pnpm vitest run`, `pnpm build`, `pnpm playwright test`.
- [ ] **Step 8: Commit** `feat: scaffold Next.js app with Serif design tokens and CI`

### Task 2: Liturgical calendar

**Files:**
- Create: `src/lib/types.ts`, `src/lib/dates.ts`, `src/lib/liturgical/calendar.ts`
- Test: `tests/unit/calendar.test.ts`, `tests/unit/dates.test.ts`

**Interfaces:**
- Produces (`types.ts`): `Season = 'advent'|'christmas'|'ordinary'|'lent'|'triduum'|'easter'`; `LitColor = 'violet'|'rose'|'white'|'red'|'green'`; `LiturgicalDay { date: string; season: Season; color: LitColor; sundayCycle: 'A'|'B'|'C'; weekdayCycle: 'I'|'II'; isSunday: boolean }`.
- Produces (`dates.ts`): `todayInChicago(now?: Date): string`, `addDays(date: string, n: number): string`, `dayOfWeek(date: string): number` (0 = Sunday), `usccbSlug(date: string): string` (`'2026-10-25'` → `'102526'`).
- Produces (`calendar.ts`): `firstSundayOfAdvent(year: number): string`, `easterSunday(year: number): string`, `baptismOfTheLord(year: number): string`, `liturgicalDay(date: string): LiturgicalDay`, `comingSunday(date: string): string` (the date itself if Sunday, else the next Sunday).

- [ ] **Step 1: Write failing tests** with these exact values:
  - `firstSundayOfAdvent`: 2025 → `2025-11-30`, 2026 → `2026-11-29`, 2027 → `2027-11-28`, 2028 → `2028-12-03`, 2029 → `2029-12-02`, 2030 → `2030-12-01`.
  - `easterSunday`: 2025 → `2025-04-20`, 2026 → `2026-04-05`, 2027 → `2027-03-28`, 2028 → `2028-04-16`, 2029 → `2029-04-01`, 2030 → `2030-04-21`.
  - `baptismOfTheLord` (US: Epiphany = Sunday Jan 2–8; Baptism = next Sunday, or Monday after if Epiphany is Jan 7 or 8): 2026 → `2026-01-11`, 2029 → `2029-01-08`, 2030 → `2030-01-13`.
  - Cycles: `2026-11-28` → A / II; `2026-11-29` → B / I; `2025-11-29` → C / I; `2025-11-30` → A / II.
  - Seasons/colors: `2026-11-29` advent violet; `2026-12-13` (Gaudete) advent rose; `2026-12-25` christmas white; `2026-01-11` christmas white; `2026-01-12` ordinary green; `2026-02-18` lent violet; `2026-03-15` (Laetare) lent rose; `2026-03-29` (Palm Sunday) lent red; `2026-04-02` triduum white; `2026-04-03` triduum red; `2026-04-05` easter white; `2026-05-24` (Pentecost) easter red; `2026-05-25` ordinary green.
  - `comingSunday('2026-10-21')` → `2026-10-25`; `comingSunday('2026-10-25')` → `2026-10-25`.
  - `todayInChicago(new Date('2026-10-25T04:30:00Z'))` → `2026-10-24`; `todayInChicago(new Date('2026-11-01T06:30:00Z'))` → `2026-11-01` (DST end); `usccbSlug('2026-10-25')` → `102526`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/calendar.test.ts tests/unit/dates.test.ts` → FAIL.
- [ ] **Step 3: Implement** — `todayInChicago` via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' })`; all date math on `Date.UTC(y, m, d, 12)`. Easter by the anonymous Gregorian algorithm. Seasons: Advent = [Advent 1, Dec 24]; Christmas = [Dec 25, Baptism]; Lent = [Ash Wednesday = Easter − 46, Holy Thursday − 1]; Triduum = [Holy Thursday, Holy Saturday]; Easter = [Easter, Pentecost = Easter + 49]; else Ordinary. Colors: season default (advent/lent violet, christmas/easter/triduum white, ordinary green); rose on Advent 3 and Lent 4 Sundays; red on Palm Sunday, Good Friday, Pentecost.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: Advent-aware liturgical calendar`

### Task 3: Supabase schema, auth and allowlist

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `src/lib/db/{server,admin,browser}.ts`, `src/lib/auth/allowlist.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/signin/page.tsx`
- Test: `tests/unit/allowlist.test.ts`, `tests/integration/rls.test.ts` (runs against `supabase start` locally/CI; skipped when `SUPABASE_TEST_URL` unset)

**Interfaces:**
- Produces: `createServerClient(): SupabaseClient` (cookie session, RLS applies), `createAdminClient(): SupabaseClient` (service role, server only, used by jobs), `createBrowserClient()`; `isAllowed(email: string | null | undefined, allowed = process.env.ALLOWED_EMAIL): boolean` (case-insensitive, trims); `requireUser(): Promise<{ id: string; email: string }>` throwing a 401 `Response` when absent or not allowed.
- Tables exactly as spec Data model, plus: `readings.date date primary key`, `sections jsonb`, `lectionary text`; `reflections.date date primary key references readings`; `bulletins.sunday_date date primary key`, `text_search tsvector generated always as (to_tsvector('english', coalesce(text,''))) stored` with GIN index; `job_runs.id bigserial`; personal tables have `id uuid default gen_random_uuid()`, `user_id uuid default auth.uid() references auth.users`, `updated_at timestamptz default now()`; `routine_ticks unique (routine_id, date)`; `bookmarks unique (user_id, date, section)`; `notes unique (user_id, date)`.
- RLS: shared tables `select` for `anon, authenticated`, no write policies (service role bypasses). Personal tables: all operations `using (user_id = auth.uid()) with check (user_id = auth.uid())`. Storage bucket `bulletins` private; PDFs served via `api/bulletins/[date]/pdf` with the admin client.

- [ ] **Step 1: Failing tests** — `isAllowed('Joel@Example.com ', 'joel@example.com')` → true; `isAllowed('other@example.com', 'joel@example.com')` → false; `isAllowed(null, 'x')` → false; `isAllowed('a@b.c', undefined)` → false. RLS test: user A inserts a note; user B `select * from notes` → 0 rows; anon can `select` from `readings`; anon `insert into readings` → error.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** migration, clients, `allowlist.ts`. `auth/callback` exchanges the code, then if `!isAllowed(user.email)` calls `signOut()` and redirects to `/auth/signin?denied=1` showing "This Catholica is private." `proxy.ts` (Next 16's renamed middleware) only refreshes the session cookie (public pages stay public).
- [ ] **Step 4: Run** → PASS (`supabase start && pnpm vitest run tests/integration`).
- [ ] **Step 5: Commit** `feat: Supabase schema, RLS and single-user sign-in`

### Task 4: USCCB readings source

**Files:**
- Create: `scripts/capture-fixtures.ts`, `tests/fixtures/usccb/{sunday-2026-10-25,weekday-2026-10-21,christmas-2025-12-25,easter-vigil-2026-04-04}.html`, `src/lib/sources/http.ts`, `src/lib/sources/usccb.ts`, `src/lib/db/readings.ts`
- Test: `tests/unit/usccb.test.ts`

**Interfaces:**
- Produces (`types.ts` additions): `ReadingKind = 'reading1'|'psalm'|'reading2'|'sequence'|'alleluia'|'gospel'|'other'`; `ReadingSection { kind: ReadingKind; title: string; citation: string; text: string }`; `DailyReadings { date: string; feast: string; lectionary: string | null; sections: ReadingSection[]; sourceUrl: string; fetchedAt: string }`.
- Produces: `fetchText(url: string): Promise<string>` and `fetchBytes(url: string): Promise<Uint8Array>` in `http.ts` (UA + 15s timeout, throws `SourceError` with status); `usccbUrl(date: string): string`; `parseUsccb(html: string, date: string): Omit<DailyReadings, 'fetchedAt'>`; `fetchUsccb(date: string): Promise<DailyReadings>`; `getReadings(date: string): Promise<DailyReadings | null>` and `saveReadings(r: DailyReadings): Promise<void>` in `db/readings.ts`.

- [ ] **Step 1: Capture fixtures** — `scripts/capture-fixtures.ts <date...>` saves raw HTML of `usccbUrl(date)` to `tests/fixtures/usccb/`. Run it inside a Vercel Sandbox (Vercel MCP `create_sandboxes_*` + `run_session_command`, then `read_session_file`), because this container cannot reach usccb.org. Commit the four fixtures untouched.
- [ ] **Step 2: Failing tests** — read each fixture and open it in a browser-free way to note the exact expected values, then assert: Sunday fixture has `feast` = the page's h2 title, `lectionary` matches `/^\d+$/`, `sections.map(s => s.kind)` equals `['reading1','psalm','reading2','alleluia','gospel']`, Gospel `citation` non-empty and `text` starts with the first words shown on the page; weekday fixture has no `reading2`; Christmas fixture keeps all Mass options in page order (section count equals the number of `h3.name` headings on the page); every section `text` has no HTML tags, keeps line breaks of the psalm as `\n`, and contains no `&nbsp;`. `usccbUrl('2026-10-25')` → `https://bible.usccb.org/bible/readings/102526.cfm`.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** `parseUsccb` with cheerio, mapping heading words to `ReadingKind` (`Reading 1|Reading I` → reading1, `Responsorial Psalm` → psalm, `Reading 2|Reading II` → reading2, `Sequence`, `Alleluia|Verse Before the Gospel` → alleluia, `Gospel` → gospel, else other); `<br>` → `\n`; collapse other whitespace. Selectors come from the captured fixtures.
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat: verbatim USCCB readings parser with real fixtures`

### Task 5: Readings cron job, Gemini reflection and alerts

**Files:**
- Create: `src/lib/ai/gemini.ts`, `src/lib/jobs/readings-job.ts`, `src/lib/jobs/alert.ts`, `src/lib/db/jobs.ts`, `src/app/api/cron/readings/route.ts`, `src/app/api/readings/[date]/route.ts`, `vercel.json`
- Test: `tests/unit/readings-job.test.ts`, `tests/unit/cron-auth.test.ts`

**Interfaces:**
- Consumes: `fetchUsccb`, `getReadings`, `saveReadings`, `todayInChicago`, `addDays`, `liturgicalDay`.
- Produces: `writeReflection(r: DailyReadings): Promise<string>` (prompt: 150–220 words, second person, plain language, quotes only from the given text, no new Scripture citations; returns text); `runReadingsJob(deps: { fetchUsccb; getReadings; saveReadings; saveReflection; hasReflection; writeReflection; logRun; alert; now: Date }): Promise<{ saved: string[]; failed: string[] }>`; `logRun(job: 'readings'|'bulletin', status: 'ok'|'error', message: string)`; `sendAlert(subject: string, body: string): Promise<void>`; `assertCron(req: Request): Response | null` (401 when header ≠ `Bearer ${CRON_SECRET}`).
- `GET /api/readings/[date]` → `{ day: LiturgicalDay, readings: DailyReadings | null, reflection: string | null, updatedAt: string | null }`, `Cache-Control: public, s-maxage=3600`.
- `vercel.json` crons: `/api/cron/readings` at `0 8 * * *` and `/api/cron/bulletin` at `0 11 * * *` (UTC; 3 AM / 6 AM Central in CDT, an hour earlier in CST; acceptable).

- [ ] **Step 1: Failing tests** with fakes: dates today..today+7 that are missing get fetched, existing ones skipped; a date failing 3 times lands in `failed` and is retried no more; failure for today or tomorrow calls `alert` once, failure only on day +5 does not; a reflection failure still saves readings and does not alert; reflection is written only once per date. `assertCron` returns 401 without header and `null` with the right one.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** job, route (`maxDuration = 300`), Gemini wrapper (`GEMINI_MODEL`), Resend alert to `ALERT_EMAIL`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: daily readings job with AI reflection and failure alerts`

### Task 6: Bulletin source, job and backfill

**Files:**
- Create: `tests/fixtures/bulletins/list.html`, `tests/fixtures/bulletins/20261018.pdf` (captured as in Task 4), `src/lib/sources/bulletins.ts`, `src/lib/db/bulletins.ts`, `src/lib/jobs/bulletin-job.ts`, `src/app/api/cron/bulletin/route.ts`, `scripts/backfill-bulletins.ts`
- Test: `tests/unit/bulletins.test.ts`, `tests/unit/bulletin-job.test.ts`

**Interfaces:**
- Produces: `BULLETIN_LIST_URL = 'https://stanselmparish.org/bulletins'`; `parseBulletinList(html: string): { sundayDate: string; url: string }[]` (from links matching `files.ecatholic.com/17181/bulletins/(\d{8})\.pdf`, keeping the `?t=` query, newest first, de-duplicated by date); `extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }>` (unpdf); `listBulletins(): Promise<Bulletin[]>`, `latestBulletin()`, `hasBulletin(date)`, `saveBulletin(meta, bytes)` (uploads to `bulletins/{date}.pdf`), `searchBulletins(q: string): Promise<{ sundayDate: string; snippet: string }[]>` (`websearch_to_tsquery` + `ts_headline`); `runBulletinJob(deps): Promise<{ added: string[] }>`; `Bulletin { sundayDate; sourceUrl; storagePath; pageCount; fetchedAt }` in `types.ts`.

- [ ] **Step 1: Failing tests** — list fixture: first item `sundayDate` `2026-10-18`, earliest `2023-08-06`, no duplicate dates, every `url` starts with `https://files.ecatholic.com/17181/bulletins/`. PDF fixture: `pageCount > 0`, text contains `Anselm`. Job (fakes): only dates not saved are downloaded; a download error for one PDF logs it and continues with the rest; with newest saved bulletin `2026-10-11` and now Monday `2026-10-19`, `alert` is called; on Sunday `2026-10-18` it is not; a list-page HTTP error logs `error` and alerts.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; backfill script calls `runBulletinJob` with no date limit and a 2s pause between downloads (`pnpm tsx scripts/backfill-bulletins.ts`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: real St. Anselm bulletin archive with search`

### Task 7: App shell and navigation

**Files:**
- Create: `src/app/(tabs)/layout.tsx`, `src/components/TabBar.tsx`, `src/components/ui/{IconButton,Sheet}.tsx`, `src/app/manifest.ts` (name "Catholica", theme_color `#FAFAF8`, background `#FAFAF8`, display `standalone`, icons 192/512 + maskable), `public/icons/*`
- Test: `tests/e2e/nav.spec.ts`

**Interfaces:**
- Produces: tabs `Today /`, `Mass /mass`, `Bulletin /bulletin`, `Me /me` with lucide icons `Sun`, `Church`, `Newspaper`, `User`; active tab = gold text + 2px gold top rule; bar fixed bottom with `env(safe-area-inset-bottom)` below 768px, top bar at ≥ 768px; content column `max-w-[34em]` centered. `<Sheet open onClose title>` = bottom sheet on mobile, centered dialog on desktop (native `<dialog>`).

- [ ] **Step 1: Failing e2e** at 390×844: four links with accessible names Today/Mass/Bulletin/Me, each ≥ 44px tall, clicking each changes URL and sets `aria-current="page"`; at 1280px the bar is at the top.
- [ ] **Step 2: Run** `pnpm playwright test tests/e2e/nav.spec.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: four-tab mobile shell and PWA manifest`

### Task 8: Today screen

**Files:**
- Create: `src/app/(tabs)/page.tsx`, `src/components/{DateChip,MonthCalendar,ReadingCard,ReadingsCarousel,ReflectionPanel,ThisSundayCard,SourceFooter,SpeakButton,BookmarkButton}.tsx`, `src/lib/speech.ts`
- Test: `tests/unit/speech.test.ts`, `tests/e2e/today.spec.ts` (seeded test DB: `supabase/seed.sql` inserts readings for the Sunday and weekday fixtures' parsed output and one bulletin row)

**Interfaces:**
- Consumes: `/api/readings/[date]`, `liturgicalDay`, `comingSunday`, `latestBulletin`.
- Produces: `speakChunks(text: string, max = 200): string[]` (split on sentence ends, never mid-word); `<SpeakButton text>` (Web Speech API; hidden when unsupported; one utterance at a time, tapping again stops); `<BookmarkButton date section>` (writes via outbox from Task 11; hidden when signed out).
- Page: server component reading `?date=` (default `todayInChicago()`); header = `DateChip` (small-caps date, opens `MonthCalendar` in a `Sheet`; picking a day navigates to `/?date=`), feast in Playfair, color dot + season + "Year B · Week I". `ReadingsCarousel` = horizontal scroll-snap cards with a ruled small-caps label per section (FIRST READING, RESPONSORIAL PSALM, SECOND READING, ALLELUIA, GOSPEL) and a pill row of section names that jumps to a card; Gospel card `featured`. "Follow the Mass" primary button → `/mass?date=`. `ReflectionPanel` collapsed `<details>` labeled "AI reflection"; absent when no reflection. `ThisSundayCard` shown Monday–Saturday: coming Sunday feast + Gospel citation (from its saved readings if present) and newest bulletin date with "Open bulletin". `SourceFooter`: "NABRE · Source: USCCB · Updated {h:mm a}" linking `sourceUrl`. When readings are null: "Readings for this day aren't saved yet." + "Open on USCCB" link to `usccbUrl(date)`.

- [ ] **Step 1: Failing tests** — `speakChunks` keeps all words, no chunk > 200 chars; e2e at 390px for the seeded Sunday: feast visible, Gospel reachable in two taps (tap "Gospel" pill → Gospel card in viewport), "AI reflection" label present, footer links to USCCB; for an unseeded date the USCCB fallback link shows and no error text; on seeded Wednesday the This Sunday card appears.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS (light and dark via `page.emulateMedia({ colorScheme })`).
- [ ] **Step 5: Commit** `feat: Today screen with readings, reflection and This Sunday`

### Task 9: Mass screen

**Files:**
- Create: `src/data/order-of-mass.ts` (ported from `Gemini-Apps/src/data/orderOfMassData.ts`: keep `id, part, partTitle, title, posture, summary, rubricNotes, dialogue`; drop Latin titles only if unused), `src/app/(tabs)/mass/page.tsx`, `src/components/{PostureBadge,MassStep}.tsx`, `src/lib/wake-lock.ts`
- Test: `tests/unit/order-of-mass.test.ts`, `tests/e2e/mass.spec.ts`

**Interfaces:**
- Produces: `MassStepData` type; `readingSlotFor(stepId: string): ReadingKind | null` mapping the first reading, psalm, second reading, alleluia/gospel acclamation and gospel steps to their kinds; `useWakeLock(active: boolean)` (Screen Wake Lock API, re-acquired on `visibilitychange`, silent no-op if unsupported).
- Page: steps grouped by part with ruled small-caps part labels; `PostureBadge` sticky at top showing the posture of the step nearest the viewport top (IntersectionObserver) as a large icon + word; reading steps render that day's section text inline (`?date=` default today); sections missing → the step's own summary.

- [ ] **Step 1: Failing tests** — data has 30 steps with unique ids and a posture each; every `ReadingKind` except `other`/`sequence` maps from exactly one step; e2e: seeded Sunday shows the Gospel text inside the Gospel step; scrolling to the Creed shows posture "Stand", to the Eucharistic Prayer shows "Kneel".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: Order of the Mass with postures and inline readings`

### Task 10: Bulletin screen

**Files:**
- Create: `src/app/(tabs)/bulletin/page.tsx`, `src/app/(tabs)/bulletin/[date]/page.tsx`, `src/components/PdfViewer.tsx`, `src/app/api/bulletins/[date]/pdf/route.ts`, `src/app/api/bulletins/search/route.ts`
- Test: `tests/e2e/bulletin.spec.ts`

**Interfaces:**
- Consumes: `listBulletins`, `searchBulletins`, admin storage download.
- Produces: `GET /api/bulletins/[date]/pdf` → `application/pdf`, `Cache-Control: public, max-age=86400`, 404 for unknown dates; `GET /api/bulletins/search?q=` → `{ results: { sundayDate, snippet }[] }` (q < 2 chars → empty).
- Page: newest bulletin card first (featured, date in Playfair, "Open" button); search input (h-12, gold focus ring) with debounced results showing date + snippet with `<mark>`; archive grouped by year under ruled labels. Viewer page embeds the PDF full width (`<iframe>` of the PDF route; "Open PDF" link fallback for iOS), plus "Source: stanselmparish.org" link.

- [ ] **Step 1: Failing e2e** with seeded bulletin: newest card shows its date; search "Anselm" returns ≥ 1 result linking to `/bulletin/{date}`; PDF route returns `content-type: application/pdf`; unknown date → 404 page.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: bulletin archive, viewer and search`

### Task 11: Me tab: routines, notes, bookmarks, intentions, settings

**Files:**
- Create: `src/lib/offline/outbox.ts`, `src/app/api/me/[collection]/route.ts`, `src/app/(tabs)/me/page.tsx`, `src/components/SettingsPanel.tsx`, `src/components/me/{Routines,Notes,Bookmarks,Intentions}.tsx`
- Test: `tests/unit/outbox.test.ts`, `tests/e2e/me.spec.ts`

**Interfaces:**
- Produces: `Collection = 'notes'|'bookmarks'|'intentions'|'routines'|'routine_ticks'`; `/api/me/[collection]` GET (list own rows), POST (upsert by id), DELETE `?id=` — all via `requireUser()` + RLS client; `outbox.enqueue(op: { collection: Collection; method: 'upsert'|'delete'; row: Record<string, unknown> }): Promise<void>`, `outbox.flush(send: (op) => Promise<void>): Promise<number>` (in order; stops at first failure, keeps the rest), auto-flush on `online` event and on load; `usePersonal<T>(collection)` hook returning `{ rows, upsert, remove }` that updates local state at once, caches rows in IndexedDB, and enqueues.
- Default routines created on first sign-in if none: Morning Offering, Angelus, Rosary, Examen. Ticks keyed by `todayInChicago()` so they reset daily.
- Settings: theme (Light/Dark/Auto segmented), text size slider 90–150% step 10, speech voice + rate (0.8–1.2) saved in `localStorage`, sign in with Google / sign out. Signed-out Me shows routines/notes disabled with "Sign in to sync your notes and prayers".

- [ ] **Step 1: Failing tests** — outbox: three ops flush in order; failure on op 2 leaves ops 2–3 queued and returns 1; ops persist across a new outbox instance (fake-indexeddb). e2e (signed-in test user via Supabase test session cookie): tick Angelus → reload → still ticked; add intention, mark answered; set Dark → `html[data-theme=dark]`; go offline (`context.setOffline(true)`), add a note, go online → note exists in DB.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (`pnpm add -D fake-indexeddb`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: synced routines, notes, bookmarks, intentions and settings`

### Task 12: Catechism lookup and AI Q&A

**Files:**
- Create: `src/lib/sources/catechism.ts`, `tests/fixtures/catechism/1324.json` (captured), `src/app/api/catechism/[num]/route.ts`, `src/app/api/catechism/ask/route.ts`, `src/components/me/Catechism.tsx`
- Test: `tests/unit/catechism.test.ts`

**Interfaces:**
- Produces: `CatechismParagraph { num: number; title: string; text: string; footnotes: string[]; crossRefs: number[]; sourceUrl: string }`; `parseCatechismResponse(json: { html: string }, num: number): CatechismParagraph | null` (logic ported from `Gemini-Apps/server.ts` `fetchCccFromCrossReference`); `fetchCatechism(num: number): Promise<CatechismParagraph | null>` (POST as the old app did; 1 ≤ num ≤ 2865 else null); `GET /api/catechism/[num]` with `s-maxage=604800`; `POST /api/catechism/ask { question }` → `{ answer: string; paragraphs: number[] }` (requires `requireUser()`; Gemini prompt demands answers cite paragraph numbers as `CCC 1324`; returned numbers are extracted by regex and each is verified with `fetchCatechism` before it is shown as a link).
- UI: number box → verbatim paragraph with "Catechism of the Catholic Church §1324" small-caps label; question box labeled "AI answer" with linked paragraph chips.

- [ ] **Step 1: Failing tests** — fixture 1324 parses to `num: 1324`, text contains `source and summit`; `fetchCatechism(0)` and `(2866)` → null without a network call; ask route returns 401 signed out.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: verbatim Catechism lookup and labeled AI Q&A`

### Task 13: Offline service worker

**Files:**
- Create: `public/sw.js`, `src/components/ServiceWorker.tsx` (registers in production, then posts `{ type: 'prefetch', urls }` for `/api/readings/{today..today+6}`, `/`, `/mass`, `/bulletin`, and the newest bulletin PDF)
- Test: `tests/e2e/offline.spec.ts` (runs against `pnpm build && pnpm start`)

**Interfaces:**
- `sw.js`: cache `catholica-v1` (bump to invalidate); navigations network-first with 3s timeout falling back to cached page, then to cached `/` shell; `/api/readings/*` and `/api/bulletins/*/pdf` stale-while-revalidate; `/_next/static/*` cache-first; `/api/me/*`, `/api/cron/*`, `/auth/*` never cached.
- Today page renders client-side from `/api/readings/[date]` when the server render fails offline; uncached date offline → "Not saved for offline. Connect to load, or open USCCB." with link.

- [ ] **Step 1: Failing e2e** — load `/`, wait for SW `ready` and prefetch done, `setOffline(true)`, reload `/` → feast and Gospel text visible; open `/mass` offline → steps visible; navigate to `/?date=` 30 days ahead offline → the "Not saved for offline" message.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: offline support for the coming week`

### Task 14: Provision, deploy and verify

**Files:**
- Modify: `README.md` (setup + env + backfill instructions)
- Create: `tests/e2e/screens.spec.ts` (screenshots of 4 tabs × light/dark at 390px into `test-results/`)

- [ ] **Step 1: Supabase** — with Joel's go-ahead, create project `catholica` (free tier, region `us-east-1`) via Supabase MCP, apply `0001_init.sql`, create private bucket `bulletins`. Give Joel the exact clicks to enable Google provider and set redirect URL `https://<vercel-domain>/auth/callback`.
- [ ] **Step 2: Vercel** — create project from `T4C0B4ND1T/catholica` (framework Next.js), set every env var from Global Constraints (Joel enters `GEMINI_API_KEY`, `RESEND_API_KEY`; generate `CRON_SECRET` with `openssl rand -hex 32`).
- [ ] **Step 3: Seed live data** — call `/api/cron/readings` with the secret; run `scripts/backfill-bulletins.ts` against production; check `job_runs` shows `ok` for both.
- [ ] **Step 4: Verify** — `pnpm playwright test tests/e2e/screens.spec.ts` with `BASE_URL` = production; confirm Today reads verbatim text matching the USCCB page for today, Year cycle label correct, newest bulletin date equals the parish page's newest, offline reload works on a phone-size browser. Attach screenshots to the PR.
- [ ] **Step 5: Commit** `docs: setup and deploy guide`
