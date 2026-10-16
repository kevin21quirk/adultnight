import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EmbedPlayer } from "@/components/embed-player";
import { VideoCard } from "@/components/video-card";
import { getPublicVideo, getRelatedVideos, isUuid } from "@/lib/queries";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return {};
  const video = await getPublicVideo(id);
  return video ? { title: video.title } : {};
}

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const video = await getPublicVideo(id);
  if (!video) notFound();
  const related = await getRelatedVideos(video);
  const duration = formatDuration(video.durationSeconds);

  return (
    <div>
      <div className="mx-auto max-w-5xl">
        <EmbedPlayer
          providerSlug={video.providerSlug}
          embedUrl={video.embedUrl}
          providerVideoId={video.providerVideoId}
          title={video.title}
          sourceUrl={video.sourceUrl}
          providerName={video.providerName}
          thumbnailUrl={video.thumbnailUrl}
        />
        <h1 className="mt-4 text-lg font-semibold leading-snug">{video.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
          <span>
            Source: <span className="text-neutral-200">{video.providerName}</span>
          </span>
          {duration && <span>{duration}</span>}
          {video.views != null && (
            <span>{video.views.toLocaleString()} views on provider</span>
          )}
        </div>

        {video.categoryNames.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {video.categoryNames.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="rounded-full bg-night-800 border border-night-600 px-3 py-1 text-xs text-neutral-300 hover:border-accent-500 hover:text-white"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
        {video.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {video.tags.slice(0, 20).map((t) => (
              <Link
                key={t}
                href={`/tag/${encodeURIComponent(t)}`}
                className="rounded-full bg-night-900 border border-night-700 px-2.5 py-0.5 text-xs text-neutral-500 hover:text-white"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}

        {video.description && (
          <p className="mt-4 text-sm text-neutral-300 whitespace-pre-line">{video.description}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {video.sourceUrl && (
            <a
              href={video.sourceUrl}
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="rounded-md bg-night-800 border border-night-600 px-4 py-2 hover:border-accent-500"
            >
              Watch on {video.providerName} ↗
            </a>
          )}
          <Link
            href={`/report/${video.id}`}
            className="rounded-md border border-night-600 px-4 py-2 text-neutral-400 hover:text-white hover:border-red-800"
          >
            Report this video
          </Link>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">More like this</h2>
        {related.length === 0 ? (
          <p className="text-sm text-neutral-600">No related videos yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {related.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
