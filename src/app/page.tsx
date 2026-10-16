import Link from "next/link";
import { VideoCard } from "@/components/video-card";
import { listCategoriesWithCounts, listVideos } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ items, total }, cats, vr] = await Promise.all([
    listVideos({ page: 1 }),
    listCategoriesWithCounts(),
    listVideos({ page: 1, categorySlug: "virtual-reality", sort: "views" }),
  ]);
  const vrItems = vr.items.slice(0, 8);

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

      {vrItems.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              VR videos{" "}
              <span className="text-sm font-normal text-neutral-500">
                {vr.total.toLocaleString()}
              </span>
            </h2>
            <Link
              href="/category/virtual-reality"
              className="text-sm text-accent-400 hover:text-accent-300"
            >
              See all VR →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {vrItems.map((v) => (
              <VideoCard key={v.id} video={v} badge="VR" />
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
