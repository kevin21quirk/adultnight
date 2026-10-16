import { notFound } from "next/navigation";
import { VideoCard } from "@/components/video-card";
import { Pagination } from "@/components/pagination";
import { listVideos } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page } = await searchParams;
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) notFound();
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const result = await listVideos({ page: pageNum, categorySlug: slug });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold capitalize">
        {slug.replace(/-/g, " ")}
        <span className="ml-3 text-sm font-normal text-neutral-500">
          {result.total.toLocaleString()} videos
        </span>
      </h1>
      {result.items.length === 0 ? (
        <div className="rounded-lg border border-night-700 bg-night-900 p-10 text-center text-neutral-400">
          No approved videos in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath={`/category/${slug}`} />
    </div>
  );
}
