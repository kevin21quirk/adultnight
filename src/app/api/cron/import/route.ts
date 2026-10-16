import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { providers } from "@/lib/db/schema";
import { runImport, type ImportSummary } from "@/lib/importer/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const all = await db.select().from(providers).where(eq(providers.enabled, true));
  const results: (ImportSummary & { provider: string })[] = [];
  const now = Date.now();

  for (const p of all) {
    const due =
      !p.lastSuccessfulImportAt ||
      now - p.lastSuccessfulImportAt.getTime() >= p.importIntervalMinutes * 60_000;
    if (!due) continue;

    const inc = await runImport({
      providerSlug: p.slug,
      mode: "incremental",
      maxRows: 100_000,
    });
    results.push({ provider: p.slug, ...inc });

    const del = await runImport({ providerSlug: p.slug, mode: "deletions" });
    results.push({ provider: p.slug, ...del });
  }

  return NextResponse.json({
    ok: true,
    providersChecked: all.length,
    results: results.map((r) => ({
      provider: r.provider,
      mode: r.status,
      seen: r.recordsSeen,
      inserted: r.recordsInserted,
      updated: r.recordsUpdated,
      deactivated: r.recordsDeactivated,
      error: r.error,
    })),
  });
}
