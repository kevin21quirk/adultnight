import { getAdapter } from "@/lib/providers/registry";
import type { VrMode } from "@/lib/vr";
import { PlayerGate } from "./player-gate";
import { VrSpherePlayer } from "./vr-sphere-player";

/**
 * Renders a provider-authorised embed behind a provider-verification gate.
 * The stored embed_url is re-validated against the provider's hostname
 * allowlist at render time — database content is never trusted as an
 * iframe source.
 *
 * When a VR-flagged video has an authorized direct media URL, the
 * interactive WebGL sphere player is used instead: the provider iframe
 * cannot be re-projected or look-controlled. Media is streamed through
 * /api/vr-stream so VideoTexture always sees a same-origin source.
 */
export function EmbedPlayer({
  videoId,
  providerSlug,
  embedUrl,
  providerVideoId,
  title,
  sourceUrl,
  providerName,
  thumbnailUrl,
  isVr,
  mediaUrl,
  vrMode,
}: {
  videoId: string;
  providerSlug: string;
  embedUrl: string | null;
  providerVideoId: string;
  title: string;
  sourceUrl: string | null;
  providerName: string;
  thumbnailUrl: string | null;
  isVr?: boolean;
  mediaUrl?: string | null;
  vrMode?: VrMode;
}) {
  if (isVr && mediaUrl) {
    return (
      <VrSpherePlayer
        src={`/api/vr-stream?v=${encodeURIComponent(videoId)}`}
        mode={vrMode ?? "sbs180"}
        title={title}
      />
    );
  }

  const adapter = getAdapter(providerSlug);
  const valid =
    adapter &&
    adapter.validateVideoId(providerVideoId) &&
    embedUrl &&
    adapter.validateEmbedUrl(embedUrl)
      ? adapter.embedUrlFor(providerVideoId)
      : null;

  if (!valid) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-night-800 border border-night-700 text-neutral-500 text-sm">
        This video is not available for embedding.
      </div>
    );
  }

  return (
    <PlayerGate
      embedUrl={valid}
      sourceUrl={sourceUrl}
      providerName={providerName}
      providerSlug={providerSlug}
      providerVideoId={providerVideoId}
      thumbnailUrl={thumbnailUrl}
      title={title}
      isVr={isVr}
    />
  );
}
