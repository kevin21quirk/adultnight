import Link from "next/link";
import type { VideoCard as VideoCardT } from "@/lib/queries";

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoCard({ video }: { video: VideoCardT }) {
  const duration = formatDuration(video.durationSeconds);
  return (
    <Link
      href={`/video/${video.id}`}
      className="group block rounded-lg overflow-hidden bg-night-800 border border-night-700 hover:border-accent-600 transition-colors"
    >
      <div className="relative aspect-video bg-night-700">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-neutral-600 text-xs">
            No preview
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-accent-400">
          {video.title}
        </h3>
        {video.views != null && (
          <p className="mt-1 text-xs text-neutral-500">
            {video.views.toLocaleString()} views on provider
          </p>
        )}
      </div>
    </Link>
  );
}
