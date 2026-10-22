# Catholica

A personal, mobile-first companion for the Mass. Next.js (App Router) on Vercel, Supabase for data.

## Develop

```bash
pnpm install
cp .env.example .env.local   # fill in values
pnpm dev
```

## Checks

```bash
pnpm lint
pnpm tsc --noEmit
pnpm vitest run
pnpm build && pnpm playwright test
```

Playwright builds and serves the production app on port 3000. In CI it installs Chromium itself
(`pnpm exec playwright install --with-deps chromium`).

## Design

Serif design system (`docs/design/serif-design-system.md`). Colors exist only as CSS variables in
`src/app/globals.css`; components use Tailwind token classes (`bg-background`, `text-accent`, ...).
Theme (`light|dark|auto`) and text size (90% to 150%) are set by `ThemeProvider` and stored in
`localStorage` (`catholica.theme`, `catholica.textScale`).

## Environment

See `.env.example`. All variables are configured in Vercel.

## Supabase (local)

Schema lives in `supabase/migrations`. The local stack needs Docker:

```bash
pnpm supabase start -x studio,imgproxy,vector,logflare,edge-runtime,realtime,mailpit
eval "$(pnpm -s supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export SUPABASE_TEST_URL=$API_URL SUPABASE_TEST_ANON_KEY=$ANON_KEY SUPABASE_TEST_SERVICE_KEY=$SERVICE_ROLE_KEY
pnpm vitest run tests/integration   # skipped when SUPABASE_TEST_URL is unset
pnpm supabase db reset              # re-apply migrations and seed
```

Production sign-in is Google only. The integration tests create two throwaway email/password users
through the admin API on the local stack only.

## Production

- Supabase: apply `supabase/migrations/*.sql` in order (this also creates the private `bulletins` bucket). Enable the
  Google provider, set the Site URL, add `https://<domain>/auth/callback` to Redirect URLs, and turn off email sign-ups.
- Vercel: set every variable in `.env.example` for Production and Preview. `maxDuration = 300` on the cron routes needs
  Fluid compute.
- Crons (`vercel.json`, UTC): `/api/cron/readings` keeps today through today + 7 saved. It reads USCCB's feed
  (`bible.usccb.org/readings.rss`) first, because the readings pages challenge datacenter requests; the feed holds
  only the last ten days and adds each day at 4:30 a.m. Eastern, so the cron runs at 10:00 UTC and future days are
  best effort from the pages; `/api/cron/bulletin` probes
  recent Sundays at `files.ecatholic.com/17181/bulletins/YYYYMMDD.pdf` (the parish list page is behind a Cloudflare
  challenge). Both need `Authorization: Bearer $CRON_SECRET`, which Vercel sends automatically.
- Seed after the first deploy:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/readings
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/backfill-bulletins.ts --since 2025-01-05
```

The full archive (the default `--since` is 2023-08-06) is several hundred MB of PDFs; check storage against the
free tier's 1 GB.
