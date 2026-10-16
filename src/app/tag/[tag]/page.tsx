import { notFound } from "next/navigation";
import { VideoCard } from "@/components/video-card";
import { Pagination } from "@/components/pagination";
import { listVideos } from "@/lib/queries";

export const revalidate = 300;

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tag } = await params;
  const { page } = await searchParams;
  const decoded = decodeURIComponent(tag).slice(0, 60);
  if (!decoded || decoded.length > 60) notFound();
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const result = await listVideos({ page: pageNum, tag: decoded });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">
        Tag: {decoded}
        <span className="ml-3 text-sm font-normal text-neutral-500">
          {result.total.toLocaleString()} videos
        </span>
      </h1>
      {result.items.length === 0 ? (
        <div className="rounded-lg border border-night-700 bg-night-900 p-10 text-center text-neutral-400">
          No approved videos with this tag.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath={`/tag/${encodeURIComponent(decoded)}`} />
    </div>
  );
}
