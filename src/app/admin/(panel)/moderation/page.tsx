import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  blocklist,
  moderationEvents,
  takedownRequests,
  videos,
} from "@/lib/db/schema";
import { addBlocklistAction, resolveTakedownAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const db = getDb();
  const [open, recentEvents, blocked] = await Promise.all([
    db
      .select({
        req: takedownRequests,
        videoTitle: videos.title,
      })
      .from(takedownRequests)
      .innerJoin(videos, eq(takedownRequests.videoId, videos.id))
      .where(eq(takedownRequests.status, "open"))
      .orderBy(takedownRequests.createdAt),
    db
      .select()
      .from(moderationEvents)
      .orderBy(desc(moderationEvents.createdAt))
      .limit(30),
    db.select().from(blocklist).orderBy(desc(blocklist.createdAt)).limit(50),
  ]);
  return (
    <div>
      <h1 className="text-xl font-semibold">Moderation</h1>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Open reports ({open.length})
      </h2>
      <div className="mt-3 space-y-3">
        {open.map(({ req, videoTitle }) => (
          <div key={req.id} className="rounded-lg border border-night-700 bg-night-900 p-4 text-sm">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{req.requestType.replace("_", " ")}</p>
                <p className="mt-1 text-neutral-300">
                  Video: <span className="text-neutral-400">{videoTitle}</span>
                </p>
                <p className="mt-1 text-neutral-400 whitespace-pre-wrap">{req.reason}</p>
                <p className="mt-1 text-xs text-neutral-600">
                  {req.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  {req.reporterContact && ` · contact: ${req.reporterContact}`}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={resolveTakedownAction}>
                  <input type="hidden" name="takedownId" value={req.id} />
                  <input type="hidden" name="outcome" value="actioned" />
                  <button className="rounded bg-red-900 px-3 py-1.5 text-xs font-medium hover:bg-red-800">
                    Remove video
                  </button>
                </form>
                <form action={resolveTakedownAction}>
                  <input type="hidden" name="takedownId" value={req.id} />
                  <input type="hidden" name="outcome" value="dismissed" />
                  <button className="rounded border border-night-600 px-3 py-1.5 text-xs hover:border-accent-500">
                    Dismiss
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {open.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-500">No open reports.</p>
        )}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Blocklist
      </h2>
      <form action={addBlocklistAction} className="mt-3 flex flex-wrap gap-2">
        <select name="entryType" className="rounded bg-night-800 border border-night-600 px-2 py-1.5 text-sm">
          <option value="domain">domain</option>
          <option value="provider_video">provider video (slug:id)</option>
        </select>
        <input
          name="value"
          required
          placeholder="e.g. pornhub:abc123… or evil.example"
          className="min-w-0 flex-1 rounded-md bg-night-800 border border-night-600 px-3 py-1.5 text-sm"
        />
        <input
          name="reason"
          placeholder="Reason"
          className="min-w-0 flex-1 rounded-md bg-night-800 border border-night-600 px-3 py-1.5 text-sm"
        />
        <button className="rounded-md bg-night-800 border border-night-600 px-4 py-1.5 text-sm hover:border-accent-500">
          Block
        </button>
      </form>
      <ul className="mt-3 space-y-1 text-sm text-neutral-400">
        {blocked.map((b) => (
          <li key={b.id} className="flex gap-3">
            <span className="text-neutral-500">{b.entryType}</span>
            <span>{b.value}</span>
            {b.reason && <span className="text-neutral-600">— {b.reason}</span>}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Recent moderation events
      </h2>
      <ul className="mt-3 space-y-1 text-sm text-neutral-400">
        {recentEvents.map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className="text-neutral-600 whitespace-nowrap">
              {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            </span>
            <span>{e.eventType}</span>
            {e.reason && <span className="truncate text-neutral-600">{e.reason}</span>}
            {e.actorId && <span className="text-neutral-600">by {e.actorId}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
