# Import operations guide

## Jobs

| Command | What it does |
|---|---|
| `npm run import:initial` | Stream catalogue dump, insert new rows as `pending_review` |
| `npm run import:incremental` | Same stream, bounded; upserts refresh metadata + `last_seen_at` |
| `npm run import:deletions` | Stream deleted.csv; mark matching rows `removed` |
| `GET /api/cron/import` (Bearer `CRON_SECRET`) | Cron entrypoint; runs incremental+deletions for due, enabled providers |

Flags: `--provider <slug> --mode <m> --dry-run --max-rows N`
(`npx tsx scripts/import.ts ...`).

## Safety properties

- **Idempotent**: unique `(provider_id, provider_video_id)` + upsert.
- **Locked**: a partial unique index (`import_runs_running_unique`) allows one
  running import per provider. Contended runs return `skipped`. Runs stuck
  `running` > 60 min are reclaimed as failed on the next attempt.
- **Bounded**: `--max-rows` caps records processed per run.
- **Dry-run**: `--dry-run` parses and counts without writing catalogue rows
  (still records an `import_runs` row marked `dry_run`).
- **Failure-safe**: errors mark the run `failed` with `error_summary` and leave
  existing catalogue untouched. A feed/network failure never implies deletion;
  only explicit rows in the deletions feed remove content.
- **New content is never auto-public**: imports land in `pending_review`.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `another import … already running` | concurrent run or stale lock | wait; stale locks auto-reclaim after 60 min |
| `provider is disabled` | `providers.enabled = false` | enable in /admin/providers |
| `HTTP 429/5xx` in error_summary | provider rate limit / outage | retried with backoff first; check provider status |
| `feed fetch failed` | endpoint moved/down | re-verify endpoints (see provider doc) |

## Monitoring

- `/admin` → catalogue counts, provider health, recent runs.
- `/admin/imports` → full history incl. per-run counters and `error_summary`.
- `providers.operational_status`: `ok` / `error` / `unconfigured`.
- `providers.last_successful_import_at` drives cron due-ness
  (`import_interval_minutes`).

## Manual moderation flow

pending_review → approved (public) | rejected
any → unavailable (temporary suppress) | removed (permanent, incl. takedowns)

Every action writes `moderation_events` + `audit_log`.
