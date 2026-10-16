import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { videos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isUuid } from "@/lib/queries";
import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  if (!isUuid(videoId)) notFound();
  const db = getDb();
  const video = await db.query.videos.findFirst({
    where: eq(videos.id, videoId),
    columns: { id: true, title: true },
  });
  if (!video) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold">Report content</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Reporting: <span className="text-neutral-200">{video.title}</span>
      </p>
      <p className="mt-4 text-sm text-neutral-400">
        Reports of suspected minors, non-consensual content or trafficking are
        prioritised and the item is suppressed immediately on review. You may
        also contact the hosting provider directly.
      </p>
      <ReportForm videoId={video.id} />
    </div>
  );
}
