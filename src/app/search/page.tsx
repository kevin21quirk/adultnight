import { VideoCard } from "@/components/video-card";
import { Pagination } from "@/components/pagination";
import { listVideos } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const { q, page, sort } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const sortMode = sort === "views" ? "views" : "newest";
  const result = await listVideos({ page: pageNum, query: q, sort: sortMode });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold">
          {q ? <>Results for “{q}”</> : "Browse videos"}
        </h1>
        <span className="text-sm text-neutral-500">
          {result.total.toLocaleString()} found
        </span>
        <div className="ml-auto flex gap-2 text-sm">
          <SortLink label="Newest" active={sortMode === "newest"} q={q} sort="newest" />
          <SortLink label="Most viewed" active={sortMode === "views"} q={q} sort="views" />
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-night-700 bg-night-900 p-10 text-center text-neutral-400">
          <p className="text-lg font-medium text-neutral-300">No matches</p>
          <p className="mt-2 text-sm">Try different search terms or browse by category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/search"
        params={{ ...(q ? { q } : {}), sort: sortMode }}
      />
    </div>
  );
}

function SortLink({
  label,
  active,
  q,
  sort,
}: {
  label: string;
  active: boolean;
  q?: string;
  sort: string;
}) {
  const sp = new URLSearchParams({ ...(q ? { q } : {}), sort });
  return (
    <a
      href={`/search?${sp.toString()}`}
      className={active ? "text-accent-400 font-medium" : "text-neutral-400 hover:text-white"}
    >
      {label}
    </a>
  );
}
