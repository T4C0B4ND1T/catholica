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
