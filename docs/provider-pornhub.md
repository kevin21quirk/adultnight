# Pornhub provider integration — verified facts

**Verified: 2026-10-16** against https://www.pornhub.com/webmasters (the
official domain — note `pornhub.lifestyle` is an unrelated mirror and must not
be used).

## Permission

The webmasters page publicly invites embedding: "there are no restrictions to
the number of videos you can place on your site" and offers an embed dump of
"video URLs, thumbnail URLs, tags, duration, title, and embed codes".

Commercial/monetised use may additionally require enrolment in their partner
program — re-check terms before monetising. `providers.terms_reviewed_at`
tracks the last review; review at least quarterly.

## Resources

| Resource | URL | Status (2026-10-16) |
|---|---|---|
| Catalogue dump | `https://www.pornhub.com/files/pornhub.com-db.zip` | ✅ ~1.5 GB ZIP, refreshed daily |
| Deletions feed | `https://www.pornhub.com/files/deleted.csv` | ✅ plain CSV |
| Added-videos RSS | `https://www.pornhub.com/video/webmasterss` | ❌ 302 → homepage (unusable) |
| Embed player | `https://www.pornhub.com/embed/{viewkey}` | ✅ HTTP 200 |

## Dump format (`pornhub.com-db.csv` inside the ZIP)

Pipe-delimited, 13 fields, no header row, single deflate-compressed entry:

```
0  embed iframe HTML  — src="https://www.pornhub.com/embed/{viewkey}"
1  primary thumbnail URL (*.phncdn.com)
2  thumbnail URLs, ';'-separated
3  title
4  tags, ';'-separated
5  categories, ';'-separated
6  performer names, ';'-separated
7  duration_seconds (int)
8  view count (int)
9  metric (int; meaning unverified — stored nowhere, not displayed)
10 metric (int; meaning unverified — stored nowhere, not displayed)
11 secondary thumbnail URL
12 further thumbnails, ';'-separated
```

Viewkeys observed: 20-char hex; legacy keys may be `ph`-prefixed. The adapter
accepts `/^(?:ph)?[0-9a-f]{10,24}$/i`.

## Deletions feed

`{numericId},{viewkey},{view_video URL}` per line, no header. Cumulative —
safe to reprocess; rows not present in our catalogue are skipped.

## Sync strategy

- **Initial**: stream the ZIP, inflate on the fly, bounded batches (500),
  upsert on `(provider_id, provider_video_id)`.
- **Incremental**: the added-videos RSS is dead, so incremental runs re-scan
  the (daily-refreshed) dump stream; upserts make this idempotent. Use
  `--max-rows` to bound runtime. The deletions feed is processed every run.
- **Deletions**: parse deleted.csv → set `status='removed'`, `removed_at=now()`.
  A network failure never implies deletion.

## Permissions checklist before launch

- [ ] Re-read https://www.pornhub.com/webmasters + Terms; record
      `terms_reviewed_at` in admin.
- [ ] Confirm embed-dump usage is permitted for this site's purpose.
- [ ] Verify commercial-use constraints (partner program) if monetising.
- [ ] Confirm thumbnail hotlinking remains permitted (urls are `*.phncdn.com`).
- [ ] Keep `allowed_hosts` in `providers` in sync with adapter allowlists.
