# AfterDark Index

A free adult video **discovery** platform. It indexes authorised metadata and
renders provider-hosted embedded players. It never downloads, copies, scrapes,
or rehosts third-party video files.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Neon Postgres + Drizzle ORM (versioned migrations in `drizzle/`)
- Zod validation, Postgres full-text search, Vitest
- Vercel + Vercel Cron (`/api/cron/import`)

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, secrets, admin credentials
npm run db:migrate
npm run db:seed              # provider row, admin user, 40 synthetic videos
npm run dev
```

- Public site: http://localhost:3000 (age gate first)
- Admin: http://localhost:3000/admin (credentials from `ADMIN_USERNAME` /
  `ADMIN_PASSWORD` in `.env.local`)

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js lifecycle |
| `npm run db:migrate` | Apply `drizzle/` migrations |
| `npm run db:seed` | Seed provider, admin user, synthetic catalogue |
| `npm run import:initial` | Bounded initial catalogue import |
| `npm run import:incremental` | Incremental catalogue import |
| `npm run import:deletions` | Process provider deletion feed |
| `npm test` | Vitest suite (uses `DATABASE_URL` if set) |
| `npm run typecheck` | `tsc --noEmit` |

Import flags: `--provider <slug> --mode <initial|incremental|deletions>
--dry-run --max-rows N`. Example:

```bash
npx tsx scripts/import.ts --mode incremental --max-rows 2000
npx tsx scripts/import.ts --mode deletions
npx tsx scripts/import.ts --mode initial --max-rows 50000 --dry-run
```

## Environment

See `.env.example`. Never commit real credentials. Required in production:
`DATABASE_URL`, `CRON_SECRET`, `ADMIN_AUTH_SECRET`, `AGE_GATE_SECRET`,
`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AGE_ASSURANCE_MODE`, `NEXT_PUBLIC_SITE_URL`.

## Provider integration

Adapters live in `src/lib/providers/`. The Pornhub adapter uses only the
**documented, public webmaster resources** verified on 2026-10-16 — see
`docs/provider-pornhub.md` for the verified formats, endpoints and the
permissions checklist.

New imports always land as `pending_review`. Nothing is public until an admin
approves it in `/admin/videos`.

## Operations & compliance

- `docs/provider-pornhub.md` — verified integration facts + permissions checklist
- `docs/operations.md` — import job guide, failure modes, locking
- `docs/compliance.md` — age assurance, takedown, retention, security checklist

## Deployment (Vercel)

1. Import the repo into Vercel.
2. Set env vars from `.env.example` (production values).
3. `vercel.json` registers a cron calling `/api/cron/import` every 6h;
   Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
4. Run `npm run db:migrate` and `npm run db:seed` against the production DB.
5. Before public launch: configure a certified age-assurance provider
   (`AGE_ASSURANCE_MODE=external`) — see `docs/compliance.md`.

## Honest limitations

- The Pornhub "added videos" RSS endpoint (`/video/webmasterss`) currently
  redirects to the homepage; incremental sync therefore re-scans the daily
  dump and relies on the deletions feed. See provider doc.
- In-memory rate limiting is per serverless instance; use a shared store for
  production.
- Self-declaration age gate is a development stub, not compliant age
  assurance. Production launches require `AGE_ASSURANCE_MODE=external`.
