import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { hasDb, testDb } from "./db";
import { providers, videos, importRuns } from "@/lib/db/schema";
import { runImport } from "@/lib/importer/run";
import { pornhubAdapter } from "@/lib/providers/pornhub";
import { dumpRow, deletedRow } from "./fixtures";
import { listVideos } from "@/lib/queries";

const PROVIDER = "testprov";
// viewkeys must match /^(?:ph)?[0-9a-f]{10,24}$/i
const key = (n: number) => `face${String(n).padStart(16, "0")}`;

async function* source(lines: string[]) {
  yield* lines;
}

const dbTests = hasDb ? describe : describe.skip;

dbTests("importer pipeline (test DB)", () => {
  let providerId = "";

  beforeAll(async () => {
    const db = testDb();
    const [p] = await db
      .insert(providers)
      .values({
        name: "Test Provider",
        slug: PROVIDER,
        integrationType: "embed_dump",
        enabled: true,
        allowedHosts: ["www.pornhub.com"],
      })
      .onConflictDoNothing()
      .returning();
    if (p) providerId = p.id;
    else {
      const found = await db.query.providers.findFirst({
        where: eq(providers.slug, PROVIDER),
      });
      providerId = found!.id;
    }
    // Clean prior test rows so reruns are deterministic.
    await db.execute(
      sql`delete from ${videos} where ${videos.providerId} = ${providerId} and ${videos.providerVideoId} like 'face%'`
    );
  }, 30000);

  const base = { providerSlug: PROVIDER, adapterOverride: pornhubAdapter };

  it("inserts new records as pending_review", async () => {
    const lines = [
      dumpRow({ viewkey: key(1), title: "Test alpha one" }),
      dumpRow({ viewkey: key(2), title: "Test alpha two" }),
      "garbage row |||",
    ];
    const s = await runImport({
      ...base,
      mode: "initial",
      lineSource: () => source(lines),
    });
    expect(s.status).toBe("completed");
    expect(s.recordsSeen).toBe(3);
    expect(s.recordsInserted).toBe(2);
    expect(s.recordsSkipped).toBe(1);

    const db = testDb();
    const row = await db.query.videos.findFirst({
      where: eq(videos.providerVideoId, key(1)),
    });
    expect(row?.status).toBe("pending_review");
    expect(row?.providerId).toBe(providerId);
  }, 30000);

  it("is idempotent — reruns update instead of duplicating", async () => {
    const lines = [
      dumpRow({ viewkey: key(1), title: "Test alpha one (updated)" }),
      dumpRow({ viewkey: key(2), title: "Test alpha two" }),
      dumpRow({ viewkey: key(2), title: "Test alpha two dup" }), // in-batch dup
    ];
    const s = await runImport({
      ...base,
      mode: "incremental",
      lineSource: () => source(lines),
    });
    expect(s.status).toBe("completed");
    expect(s.recordsInserted).toBe(0);
    expect(s.recordsUpdated).toBe(2);
    expect(s.recordsSkipped).toBe(1);

    const db = testDb();
    const rows = await db
      .select()
      .from(videos)
      .where(eq(videos.providerVideoId, key(1)));
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Test alpha one (updated)");
  }, 30000);

  it("deactivates provider-reported deletions without touching others", async () => {
    const s = await runImport({
      ...base,
      mode: "deletions",
      lineSource: () => source([deletedRow(key(2))]),
    });
    expect(s.status).toBe("completed");
    expect(s.recordsDeactivated).toBe(1);

    const db = testDb();
    const removed = await db.query.videos.findFirst({
      where: eq(videos.providerVideoId, key(2)),
    });
    expect(removed?.status).toBe("removed");
    const alive = await db.query.videos.findFirst({
      where: eq(videos.providerVideoId, key(1)),
    });
    expect(alive?.status).toBe("pending_review");
  }, 30000);

  it("records failed runs and preserves existing data on feed errors", async () => {
    async function* boom(): AsyncGenerator<string> {
      throw new Error("simulated feed outage");
      yield "";
    }
    const s = await runImport({
      ...base,
      mode: "incremental",
      lineSource: () => boom(),
    });
    expect(s.status).toBe("failed");
    expect(s.error).toContain("feed outage");

    const db = testDb();
    const run = await db.query.importRuns.findFirst({
      where: eq(importRuns.id, s.runId!),
    });
    expect(run?.status).toBe("failed");
    const row = await db.query.videos.findFirst({
      where: eq(videos.providerVideoId, key(1)),
    });
    expect(row).toBeDefined();
  }, 30000);

  it("respects dry-run (no writes)", async () => {
    const s = await runImport({
      ...base,
      mode: "incremental",
      dryRun: true,
      lineSource: () => source([dumpRow({ viewkey: key(9), title: "dry run row" })]),
    });
    expect(s.status).toBe("completed");
    expect(s.recordsInserted).toBe(1);
    const db = testDb();
    const row = await db.query.videos.findFirst({
      where: eq(videos.providerVideoId, key(9)),
    });
    expect(row).toBeUndefined();
  }, 30000);

  it("refuses overlapping imports via run lock", async () => {
    const db = testDb();
    const [lockRun] = await db
      .insert(importRuns)
      .values({ providerId, mode: "incremental" })
      .returning();
    try {
      const s = await runImport({
        ...base,
        mode: "incremental",
        lineSource: () => source([dumpRow({ viewkey: key(10) })]),
      });
      expect(s.status).toBe("skipped");
      expect(s.error).toContain("already running");
    } finally {
      await db
        .update(importRuns)
        .set({ status: "failed", finishedAt: new Date() })
        .where(eq(importRuns.id, lockRun.id));
    }
  }, 30000);

  it("public catalogue only exposes approved videos", async () => {
    const db = testDb();
    await db
      .update(videos)
      .set({ status: "approved" })
      .where(eq(videos.providerVideoId, key(1)));

    const page = await listVideos({ page: 1, query: "Test alpha" });
    const titles = page.items.map((v) => v.title);
    expect(titles.some((t) => t.includes("alpha one"))).toBe(true);
    // removed video must not appear
    expect(titles.some((t) => t.includes("alpha two"))).toBe(false);
  }, 30000);

  it("FTS search matches title terms and misses junk terms", async () => {
    const hit = await listVideos({ page: 1, query: "alpha" });
    expect(hit.total).toBeGreaterThan(0);
    const miss = await listVideos({ page: 1, query: "zzqxxnonexistent" });
    expect(miss.total).toBe(0);
  }, 30000);

  it("rejects disabled providers", async () => {
    const db = testDb();
    await db
      .update(providers)
      .set({ enabled: false })
      .where(eq(providers.slug, PROVIDER));
    const s = await runImport({
      ...base,
      mode: "incremental",
      lineSource: () => source([]),
    });
    expect(s.status).toBe("skipped");
    await db
      .update(providers)
      .set({ enabled: true })
      .where(eq(providers.slug, PROVIDER));
  }, 30000);
});

describe("importer helpers (no DB)", () => {
  it("unknown provider fails cleanly", async () => {
    const s = await runImport({ providerSlug: "nope", mode: "initial" });
    expect(s.status).toBe("failed");
    expect(s.error).toContain("unknown provider");
  });
});
