import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { importRuns, providers, takedownRequests, videos } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const db = getDb();
  const [statusCounts, providerRows, lastRuns, openReports] = await Promise.all([
    db
      .select({ status: videos.status, count: sql<number>`count(*)::int` })
      .from(videos)
      .groupBy(videos.status),
    db.select().from(providers),
    db.select().from(importRuns).orderBy(desc(importRuns.startedAt)).limit(5),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(takedownRequests)
      .where(eq(takedownRequests.status, "open")),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {statusCounts.map((s) => (
          <div key={s.status} className="rounded-lg border border-night-700 bg-night-900 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{s.status}</p>
            <p className="mt-1 text-2xl font-semibold">{s.count.toLocaleString()}</p>
          </div>
        ))}
        <div className="rounded-lg border border-night-700 bg-night-900 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Open reports</p>
          <p className="mt-1 text-2xl font-semibold">{openReports[0]?.count ?? 0}</p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Providers
      </h2>
      <div className="mt-3 space-y-2">
        {providerRows.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-lg border border-night-700 bg-night-900 px-4 py-3 text-sm"
          >
            <span className="font-medium">{p.name}</span>
            <span className={p.enabled ? "text-green-400" : "text-neutral-500"}>
              {p.enabled ? "enabled" : "disabled"}
            </span>
            <span className="text-neutral-500">{p.operationalStatus}</span>
            <span className="ml-auto text-neutral-500">
              Last import:{" "}
              {p.lastSuccessfulImportAt
                ? p.lastSuccessfulImportAt.toISOString().slice(0, 16).replace("T", " ")
                : "never"}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Recent import runs
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-2 pr-4">Started</th>
              <th className="py-2 pr-4">Mode</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Seen</th>
              <th className="py-2 pr-4">Ins</th>
              <th className="py-2 pr-4">Upd</th>
              <th className="py-2 pr-4">Deact</th>
            </tr>
          </thead>
          <tbody>
            {lastRuns.map((r) => (
              <tr key={r.id} className="border-t border-night-800">
                <td className="py-2 pr-4 text-neutral-400">
                  {r.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                  {r.dryRun && <span className="ml-1 text-neutral-600">(dry)</span>}
                </td>
                <td className="py-2 pr-4">{r.mode}</td>
                <td className="py-2 pr-4">{r.status}</td>
                <td className="py-2 pr-4">{r.recordsSeen}</td>
                <td className="py-2 pr-4">{r.recordsInserted}</td>
                <td className="py-2 pr-4">{r.recordsUpdated}</td>
                <td className="py-2 pr-4">{r.recordsDeactivated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
