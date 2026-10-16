import { getAdapter } from "@/lib/providers/registry";
import { PlayerGate } from "./player-gate";

/**
 * Renders a provider-authorised embed behind a provider-verification gate.
 * The stored embed_url is re-validated against the provider's hostname
 * allowlist at render time — database content is never trusted as an
 * iframe source.
 */
export function EmbedPlayer({
  providerSlug,
  embedUrl,
  providerVideoId,
  title,
  sourceUrl,
  providerName,
  thumbnailUrl,
  isVr,
}: {
  providerSlug: string;
  embedUrl: string | null;
  providerVideoId: string;
  title: string;
  sourceUrl: string | null;
  providerName: string;
  thumbnailUrl: string | null;
  isVr?: boolean;
}) {
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
      thumbnailUrl={thumbnailUrl}
      title={title}
      isVr={isVr}
    />
  );
}
