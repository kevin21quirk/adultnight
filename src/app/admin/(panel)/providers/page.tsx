import { getDb } from "@/lib/db/client";
import { providers } from "@/lib/db/schema";
import {
  markTermsReviewedAction,
  toggleProviderAction,
  triggerImportAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const db = getDb();
  const rows = await db.select().from(providers);

  return (
    <div>
      <h1 className="text-xl font-semibold">Providers</h1>
      <div className="mt-6 space-y-4">
        {rows.map((p) => (
          <div key={p.id} className="rounded-lg border border-night-700 bg-night-900 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-medium">{p.name}</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.enabled
                    ? "bg-green-950 text-green-300"
                    : "bg-night-800 text-neutral-400"
                }`}
              >
                {p.enabled ? "enabled" : "disabled"}
              </span>
              <span className="text-xs text-neutral-500">
                {p.integrationType} · {p.operationalStatus}
              </span>
            </div>
            <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm text-neutral-400 sm:grid-cols-2">
              <div>Allowed hosts: {p.allowedHosts.join(", ") || "—"}</div>
              <div>Interval: every {p.importIntervalMinutes} min</div>
              <div>
                Terms reviewed:{" "}
                {p.termsReviewedAt
                  ? p.termsReviewedAt.toISOString().slice(0, 10)
                  : "never"}
              </div>
              <div>
                Last successful import:{" "}
                {p.lastSuccessfulImportAt
                  ? p.lastSuccessfulImportAt.toISOString().slice(0, 16).replace("T", " ")
                  : "never"}
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <form action={toggleProviderAction}>
                <input type="hidden" name="providerId" value={p.id} />
                <input type="hidden" name="enabled" value={String(!p.enabled)} />
                <button className="rounded border border-night-600 px-3 py-1.5 hover:border-accent-500">
                  {p.enabled ? "Disable" : "Enable"}
                </button>
              </form>
              <form action={markTermsReviewedAction}>
                <input type="hidden" name="providerId" value={p.id} />
                <button className="rounded border border-night-600 px-3 py-1.5 hover:border-accent-500">
                  Mark terms reviewed
                </button>
              </form>
              <form action={triggerImportAction} className="flex gap-2">
                <input type="hidden" name="providerSlug" value={p.slug} />
                <input type="hidden" name="maxRows" value="500" />
                <select name="mode" className="rounded bg-night-800 border border-night-600 px-2 py-1.5">
                  <option value="incremental">incremental</option>
                  <option value="deletions">deletions</option>
                </select>
                <button
                  name="dryRun"
                  value="true"
                  className="rounded border border-night-600 px-3 py-1.5 hover:border-accent-500"
                >
                  Dry run (500)
                </button>
                <button
                  name="dryRun"
                  value="false"
                  className="rounded bg-accent-600 px-3 py-1.5 font-medium hover:bg-accent-500"
                >
                  Run (500 rows)
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
