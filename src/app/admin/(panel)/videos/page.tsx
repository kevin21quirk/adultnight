import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { providers, videos } from "@/lib/db/schema";
import {
  addManualVideoAction,
  moderateVideoAction,
  revalidateVideoAction,
} from "../../actions";
import { z } from "zod";

export const dynamic = "force-dynamic";

const STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "unavailable",
  "removed",
] as const;

const statusColor: Record<string, string> = {
  pending_review: "text-yellow-400",
  approved: "text-green-400",
  rejected: "text-red-400",
  unavailable: "text-neutral-400",
  removed: "text-neutral-500",
};

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const size = 25;
  const statusFilter = z.enum(STATUSES).safeParse(status).success
    ? (status as (typeof STATUSES)[number])
    : "pending_review";

  const conditions: SQL[] = [eq(videos.status, statusFilter)];
  if (q) conditions.push(ilike(videos.title, `%${q.slice(0, 100)}%`));

  const db = getDb();
  const rows = await db
    .select({ video: videos, providerName: providers.name })
    .from(videos)
    .innerJoin(providers, eq(videos.providerId, providers.id))
    .where(and(...conditions))
    .orderBy(desc(videos.importedAt))
    .limit(size)
    .offset((pageNum - 1) * size);

  return (
    <div>
      <h1 className="text-xl font-semibold">Videos</h1>

      <form className="mt-5 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title…"
          className="rounded-md bg-night-800 border border-night-600 px-3 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-md bg-night-800 border border-night-600 px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-night-800 border border-night-600 px-4 py-1.5 text-sm hover:border-accent-500">
          Filter
        </button>
      </form>

      <div className="mt-8 rounded-lg border border-night-700 bg-night-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Add video manually
        </h2>
        <form action={addManualVideoAction} className="mt-3 flex flex-wrap gap-2">
          <input
            name="url"
            required
            placeholder="https://www.pornhub.com/view_video.php?viewkey=…"
            className="min-w-0 flex-1 rounded-md bg-night-800 border border-night-600 px-3 py-1.5 text-sm"
          />
          <input
            name="title"
            required
            maxLength={300}
            placeholder="Title"
            className="min-w-0 flex-1 rounded-md bg-night-800 border border-night-600 px-3 py-1.5 text-sm"
          />
          <button className="rounded-md bg-accent-600 px-4 py-1.5 text-sm font-medium hover:bg-accent-500">
            Add (pending review)
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-3">
        {rows.map(({ video, providerName }) => (
          <div
            key={video.id}
            className="rounded-lg border border-night-700 bg-night-900 p-4 text-sm"
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{video.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {providerName} · {video.providerVideoId} ·{" "}
                  <span className={statusColor[video.status]}>{video.status}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {video.status !== "approved" && (
                  <ActionForm videoId={video.id} action="approve" label="Approve" primary />
                )}
                {video.status !== "rejected" && video.status !== "removed" && (
                  <ActionForm videoId={video.id} action="reject" label="Reject" />
                )}
                {video.status === "approved" && (
                  <ActionForm videoId={video.id} action="unavailable" label="Suppress" />
                )}
                {video.status !== "removed" && (
                  <ActionForm videoId={video.id} action="deactivate" label="Remove" />
                )}
                <form action={revalidateVideoAction}>
                  <input type="hidden" name="videoId" value={video.id} />
                  <button className="rounded border border-night-600 px-2.5 py-1 text-xs hover:border-accent-500">
                    Revalidate
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">
            No videos matching this filter.
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-2 text-sm">
        {pageNum > 1 && (
          <a
            href={`/admin/videos?status=${statusFilter}&page=${pageNum - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className="rounded bg-night-800 px-3 py-1.5"
          >
            ‹ Prev
          </a>
        )}
        {rows.length === size && (
          <a
            href={`/admin/videos?status=${statusFilter}&page=${pageNum + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className="rounded bg-night-800 px-3 py-1.5"
          >
            Next ›
          </a>
        )}
      </div>
    </div>
  );
}

function ActionForm({
  videoId,
  action,
  label,
  primary,
}: {
  videoId: string;
  action: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={moderateVideoAction}>
      <input type="hidden" name="videoId" value={videoId} />
      <input type="hidden" name="action" value={action} />
      <button
        className={`rounded px-2.5 py-1 text-xs ${
          primary
            ? "bg-accent-600 font-medium hover:bg-accent-500"
            : "border border-night-600 hover:border-accent-500"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
