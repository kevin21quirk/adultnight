import Link from "next/link";
import { VideoCard } from "@/components/video-card";
import { listCategoriesWithCounts, listVideos } from "@/lib/queries";

export const revalidate = 300;

export default async function HomePage() {
  const [{ items, total }, cats] = await Promise.all([
    listVideos({ page: 1 }),
    listCategoriesWithCounts(),
  ]);

  return (
    <div>
      <h1 className="sr-only">Recently added videos</h1>
      {cats.length > 0 && (
        <section className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {cats.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="shrink-0 rounded-full border border-night-600 bg-night-800 px-3 py-1 text-xs text-neutral-300 hover:border-accent-500 hover:text-white"
              >
                {c.name} <span className="text-neutral-500">{c.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-night-700 bg-night-900 p-10 text-center text-neutral-400">
          <p className="text-lg font-medium text-neutral-300">Nothing here yet</p>
          <p className="mt-2 text-sm">
            The catalogue is empty. Videos appear here after an import has run and
            content has been approved.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-neutral-500">
            {total.toLocaleString()} videos indexed
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
