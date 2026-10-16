# Security & compliance checklist

## Content legality

- [x] No hosting/copying/scraping — metadata + authorised embeds only.
- [x] Imported content starts `pending_review`; only `approved` is public.
- [x] Provider deletions feed processed every import run.
- [x] Blocklist (`domain`, `provider_video` entries) enforced at import.
- [x] Public report flow → `takedown_requests` queue; "actioned" removes the
      video immediately and logs a moderation event.
- [ ] Provider terms re-review scheduled quarterly (track `terms_reviewed_at`).
- [ ] **Production**: certified age-assurance provider configured
      (`AGE_ASSURANCE_MODE=external` + `AGE_ASSURANCE_URL` +
      `AGE_ASSURANCE_CALLBACK_SECRET`). `self_declaration` is a dev stub and
      fails closed in production if unset.

## Age assurance

All content routes are gated by middleware → signed `ad_age` cookie.
Boundary implemented in `src/lib/age-gate.ts` + `/api/age-gate/callback`.
UK OSA compliance requires a real provider before public launch.

## Data protection

- `takedown_requests.reporter_contact` — access restricted to admins;
  recommended retention: delete/anonymise 12 months after resolution.
- `audit_log` — admin actions; retain ≥ 12 months.
- No analytics trackers; embed iframes are sandboxed.

## Security controls implemented

- Parameterised queries via Drizzle; zod validation on API input.
- Admin: scrypt-hashed passwords, JWT session cookie (httpOnly, SameSite=Lax,
  secure in prod), rate-limited login, server-side `requireAdmin()` on every
  panel page + action.
- Cron endpoint requires `Authorization: Bearer $CRON_SECRET`.
- Report endpoint rate-limited per IP (in-memory; move to shared store for
  multi-instance production).
- CSP/HSTS-family headers in `next.config.ts`; `frame-src` restricted to
  provider embed hosts; embeds render via a validating component (DB values
  re-checked against allowlist — never trusted).
- No user-supplied HTML/JS is ever rendered; all output is React-escaped.
- Manual video submission validates scheme/host/id against provider adapters.
- Secrets only in env vars; `.env.local` gitignored; `.env.example` placeholders.

## Before public launch

- [ ] Real age-assurance provider wired + tested.
- [ ] Shared rate limiter (e.g. Upstash Redis) for report/login endpoints.
- [ ] Confirm provider commercial-use permission; record terms review.
- [ ] Confirm thumbnail hotlink policy; consider proxying if required.
- [ ] Review CSP `script-src 'unsafe-inline'` — tighten with nonces.
- [ ] Set production `SITE_NAME`, legal entity details in /legal pages.
- [ ] Pen-test: iframe allowlist, report spam, admin brute force.
