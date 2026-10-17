import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client";
import {
  blocklist,
  categories,
  importRuns,
  providers,
  videoCategories,
  videos,
} from "../db/schema";
import { getAdapter } from "../providers/registry";
import type {
  FeedDescriptor,
  NormalizedVideoRecord,
  ProviderAdapter,
} from "../providers/types";
import { streamFeedLines } from "./streams";

export type ImportMode = "initial" | "incremental" | "deletions";

export interface ImportOptions {
  providerSlug: string;
  mode: ImportMode;
  dryRun?: boolean;
  maxRows?: number;
  batchSize?: number;
  /** Bypasses the provider-enabled check. Admin dry-runs only. */
  force?: boolean;
  /** Test hook: replace network fetches with a local line source. */
  lineSource?: (feed: FeedDescriptor) => AsyncGenerator<string>;
  /** Test hook: override the adapter looked up by slug. */
  adapterOverride?: ProviderAdapter;
  /**
   * Optional predicate applied to each parsed record before dedup/insert.
   * Records it rejects are counted as skipped. Used for targeted imports
   * (e.g. a VR-only catalogue scan).
   */
  recordFilter?: (rec: NormalizedVideoRecord) => boolean;
}

export interface ImportSummary {
  runId: string | null;
  status: "completed" | "failed" | "skipped";
  dryRun: boolean;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsDeactivated: number;
  error: string | null;
}

const DEFAULT_BATCH = 500;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

const LOCK_STALE_MINUTES = 60;

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || String(err).includes("duplicate key");
}

/**
 * Import locking is row-based: a partial unique index
 * (import_runs_running_unique) allows at most one 'running' row per provider.
 * Runs stuck 'running' for over an hour are reclaimed as failed.
 */
async function acquireRunLock(
  db: Db,
  providerId: string,
  mode: ImportMode,
  dryRun: boolean
): Promise<{ id: string } | null> {
  const tryInsert = async () =>
    db
      .insert(importRuns)
      .values({ providerId, mode, dryRun })
      .returning({ id: importRuns.id });

  try {
    const [run] = await tryInsert();
    return run;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }

  // Possible stale lock — reclaim runs older than the stale threshold.
  await db.execute(
    sql`update ${importRuns} set status = 'failed', finished_at = now(), error_summary = 'stale run reclaimed' where ${importRuns.providerId} = ${providerId} and ${importRuns.status} = 'running' and ${importRuns.startedAt} < now() - interval '${sql.raw(String(LOCK_STALE_MINUTES))} minutes'`
  );
  try {
    const [run] = await tryInsert();
    return run;
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

export async function runImport(opts: ImportOptions): Promise<ImportSummary> {
  const db = getDb();
  const adapter = opts.adapterOverride ?? getAdapter(opts.providerSlug);
  const summary: ImportSummary = {
    runId: null,
    status: "failed",
    dryRun: !!opts.dryRun,
    recordsSeen: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsDeactivated: 0,
    error: null,
  };

  if (!adapter) {
    summary.error = `unknown provider "${opts.providerSlug}"`;
    return summary;
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.slug, opts.providerSlug),
  });
  if (!provider) {
    summary.error = `provider "${opts.providerSlug}" is not configured`;
    return summary;
  }
  if (!provider.enabled && !opts.force) {
    summary.status = "skipped";
    summary.error = "provider is disabled";
    return summary;
  }

  const run = await acquireRunLock(
    db,
    provider.id,
    opts.mode,
    !!opts.dryRun
  );
  if (!run) {
    summary.status = "skipped";
    summary.error = "another import for this provider is already running";
    return summary;
  }
  summary.runId = run.id;

  try {
      const lines =
        opts.lineSource ??
        ((feed: FeedDescriptor) => streamFeedLines(feed));

      if (opts.mode === "deletions") {
        const feed = adapter.feeds.find((f) => f.role === "deletions");
        if (!feed) throw new Error("provider has no deletions feed");
        await processDeletions(db, provider.id, adapter, lines(feed), summary, opts);
      } else {
        const feed = adapter.feeds.find((f) => f.role === "catalogue");
        if (!feed) throw new Error("provider has no catalogue feed");
        await processCatalogue(db, provider.id, adapter, lines(feed), summary, opts);
      }

      summary.status = "completed";
      await db
        .update(importRuns)
        .set({
          status: "completed",
          finishedAt: new Date(),
          recordsSeen: summary.recordsSeen,
          recordsInserted: summary.recordsInserted,
          recordsUpdated: summary.recordsUpdated,
          recordsSkipped: summary.recordsSkipped,
          recordsDeactivated: summary.recordsDeactivated,
        })
        .where(eq(importRuns.id, run.id));
      if (!opts.dryRun) {
        await db
          .update(providers)
          .set({
            lastSuccessfulImportAt: new Date(),
            operationalStatus: "ok",
            updatedAt: new Date(),
          })
          .where(eq(providers.id, provider.id));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.error = message;
      await db
        .update(importRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          recordsSeen: summary.recordsSeen,
          recordsInserted: summary.recordsInserted,
          recordsUpdated: summary.recordsUpdated,
          recordsSkipped: summary.recordsSkipped,
          recordsDeactivated: summary.recordsDeactivated,
          errorSummary: message.slice(0, 2000),
        })
        .where(eq(importRuns.id, run.id));
      await db
        .update(providers)
        .set({ operationalStatus: "error", updatedAt: new Date() })
        .where(eq(providers.id, provider.id));
    }

  return summary;
}

async function loadBlocklist(db: Db): Promise<Set<string>> {
  const rows = await db
    .select({ entryType: blocklist.entryType, value: blocklist.value })
    .from(blocklist);
  return new Set(rows.map((r) => `${r.entryType}:${r.value.toLowerCase()}`));
}

function recordBlocked(
  blocked: Set<string>,
  providerSlug: string,
  rec: NormalizedVideoRecord
): boolean {
  if (blocked.has(`provider_video:${providerSlug}:${rec.providerVideoId.toLowerCase()}`)) {
    return true;
  }
  for (const raw of [rec.embedUrl, rec.thumbnailUrl, rec.sourceUrl]) {
    if (!raw) continue;
    try {
      if (blocked.has(`domain:${new URL(raw).hostname.toLowerCase()}`)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

async function processCatalogue(
  db: Db,
  providerId: string,
  adapter: ReturnType<typeof getAdapter> & object,
  lines: AsyncGenerator<string>,
  summary: ImportSummary,
  opts: ImportOptions
): Promise<void> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;
  const blocked = await loadBlocklist(db);
  let batch: NormalizedVideoRecord[] = [];
  const seen = new Set<string>();

  const flush = async () => {
    if (batch.length === 0) return;
    const ids = batch.map((r) => r.providerVideoId);
    const existing = await db
      .select({ id: videos.providerVideoId })
      .from(videos)
      .where(
        and(
          eq(videos.providerId, providerId),
          inArray(videos.providerVideoId, ids)
        )
      );
    const existingIds = new Set(existing.map((r) => r.id));
    summary.recordsInserted += batch.length - existingIds.size;
    summary.recordsUpdated += existingIds.size;

    if (!summary.dryRun) {
      const now = new Date();
      await db.transaction(async (tx) => {
        // Chunk the insert — a full batch produces a statement too large
        // for the Neon HTTP driver's payload limit.
        for (let i = 0; i < batch.length; i += 100) {
          const chunk = batch.slice(i, i + 100);
          await tx
            .insert(videos)
            .values(
              chunk.map((r) => ({
              providerId,
              providerVideoId: r.providerVideoId,
              title: r.title,
              description: r.description,
              thumbnailUrl: r.thumbnailUrl,
              embedUrl: r.embedUrl,
              sourceUrl: r.sourceUrl,
              durationSeconds: r.durationSeconds,
              views: r.views,
              tags: r.tags,
              publishedAt: r.publishedAt,
              lastSeenAt: now,
              status: "pending_review" as const,
            }))
          )
          .onConflictDoUpdate({
            target: [videos.providerId, videos.providerVideoId],
            set: {
              title: sql`excluded.title`,
              description: sql`excluded.description`,
              thumbnailUrl: sql`excluded.thumbnail_url`,
              embedUrl: sql`excluded.embed_url`,
              sourceUrl: sql`excluded.source_url`,
              durationSeconds: sql`excluded.duration_seconds`,
              views: sql`excluded.views`,
              tags: sql`excluded.tags`,
              lastSeenAt: sql`excluded.last_seen_at`,
              updatedAt: now,
            },
          });
        }

        // Category links
        const catNames = new Set<string>();
        for (const r of batch) for (const c of r.categories) catNames.add(c);
        if (catNames.size > 0) {
          const catRows = [...catNames].map((name) => ({
            name,
            slug: slugify(name),
          }));
          await tx
            .insert(categories)
            .values(catRows)
            .onConflictDoNothing({ target: categories.slug });
          const slugToName = new Map(catRows.map((c) => [c.slug, c.name]));
          const allSlugs = [...slugToName.keys()];
          const catIds = await tx
            .select({ id: categories.id, slug: categories.slug })
            .from(categories)
            .where(inArray(categories.slug, allSlugs));
          const bySlug = new Map(catIds.map((c) => [c.slug, c.id]));

          const vidIds = await tx
            .select({ id: videos.id, vid: videos.providerVideoId })
            .from(videos)
            .where(
              and(
                eq(videos.providerId, providerId),
                inArray(videos.providerVideoId, ids)
              )
            );
          const vidMap = new Map(vidIds.map((v) => [v.vid, v.id]));

          const links: { videoId: string; categoryId: string }[] = [];
          for (const r of batch) {
            const vid = vidMap.get(r.providerVideoId);
            if (!vid) continue;
            for (const c of r.categories) {
              const cid = bySlug.get(slugify(c));
              if (cid) links.push({ videoId: vid, categoryId: cid });
            }
          }
          // Chunk the links insert — a 500-record batch can produce
          // ~10k links, and a single oversized INSERT exceeds the Neon
          // HTTP driver's payload limit.
          for (let i = 0; i < links.length; i += 2000) {
            await tx
              .insert(videoCategories)
              .values(links.slice(i, i + 2000))
              .onConflictDoNothing();
          }
        }
      });
    }
    batch = [];
  };

  for await (const line of lines) {
    if (opts.maxRows && summary.recordsSeen >= opts.maxRows) break;
    summary.recordsSeen++;
    const rec = adapter.parseDumpRow(line);
    if (!rec) {
      summary.recordsSkipped++;
      continue;
    }
    if (opts.recordFilter && !opts.recordFilter(rec)) {
      summary.recordsSkipped++;
      continue;
    }
    if (recordBlocked(blocked, opts.providerSlug, rec)) {
      summary.recordsSkipped++;
      continue;
    }
    if (seen.has(rec.providerVideoId)) {
      summary.recordsSkipped++;
      continue;
    }
    seen.add(rec.providerVideoId);
    batch.push(rec);
    if (batch.length >= batchSize) await flush();
  }
  await flush();
}

async function processDeletions(
  db: Db,
  providerId: string,
  adapter: ReturnType<typeof getAdapter> & object,
  lines: AsyncGenerator<string>,
  summary: ImportSummary,
  opts: ImportOptions
): Promise<void> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;
  let keys: string[] = [];

  const flush = async () => {
    if (keys.length === 0) return;
    if (!summary.dryRun) {
      const res = await db
        .update(videos)
        .set({ status: "removed", removedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(videos.providerId, providerId),
            inArray(videos.providerVideoId, keys),
            sql`${videos.status} <> 'removed'`
          )
        );
      summary.recordsDeactivated += Number(res.rowCount ?? 0);
    } else {
      const found = await db
        .select({ id: videos.id })
        .from(videos)
        .where(
          and(
            eq(videos.providerId, providerId),
            inArray(videos.providerVideoId, keys)
          )
        );
      summary.recordsDeactivated += found.length;
    }
    keys = [];
  };

  for await (const line of lines) {
    if (opts.maxRows && summary.recordsSeen >= opts.maxRows) break;
    summary.recordsSeen++;
    const rec = adapter.parseDeletedRow(line);
    if (!rec) {
      summary.recordsSkipped++;
      continue;
    }
    keys.push(rec.providerVideoId);
    if (keys.length >= batchSize) await flush();
  }
  await flush();
}
