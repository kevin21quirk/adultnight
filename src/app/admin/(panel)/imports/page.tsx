import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { importRuns, providers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const db = getDb();
  const rows = await db
    .select({ run: importRuns, providerName: providers.name })
    .from(importRuns)
    .innerJoin(providers, eq(importRuns.providerId, providers.id))
    .orderBy(desc(importRuns.startedAt))
    .limit(100);

  return (
    <div>
      <h1 className="text-xl font-semibold">Import history</h1>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-2 pr-4">Started</th>
              <th className="py-2 pr-4">Provider</th>
              <th className="py-2 pr-4">Mode</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Seen</th>
              <th className="py-2 pr-4">Ins</th>
              <th className="py-2 pr-4">Upd</th>
              <th className="py-2 pr-4">Skip</th>
              <th className="py-2 pr-4">Deact</th>
              <th className="py-2 pr-4">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ run, providerName }) => (
              <tr key={run.id} className="border-t border-night-800 align-top">
                <td className="py-2 pr-4 whitespace-nowrap text-neutral-400">
                  {run.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                  {run.dryRun && <div className="text-xs text-neutral-600">dry run</div>}
                </td>
                <td className="py-2 pr-4">{providerName}</td>
                <td className="py-2 pr-4">{run.mode}</td>
                <td
                  className={`py-2 pr-4 ${
                    run.status === "failed"
                      ? "text-red-400"
                      : run.status === "completed"
                        ? "text-green-400"
                        : "text-neutral-300"
                  }`}
                >
                  {run.status}
                </td>
                <td className="py-2 pr-4">{run.recordsSeen}</td>
                <td className="py-2 pr-4">{run.recordsInserted}</td>
                <td className="py-2 pr-4">{run.recordsUpdated}</td>
                <td className="py-2 pr-4">{run.recordsSkipped}</td>
                <td className="py-2 pr-4">{run.recordsDeactivated}</td>
                <td className="py-2 pr-4 max-w-xs truncate text-red-400/80" title={run.errorSummary ?? ""}>
                  {run.errorSummary ?? ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-neutral-500">
                  No import runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
