import { getAdapter } from "@/lib/providers/registry";

/**
 * Renders a provider-authorised embed. The stored embed_url is re-validated
 * against the provider's hostname allowlist at render time — database content
 * is never trusted as an iframe source.
 */
export function EmbedPlayer({
  providerSlug,
  embedUrl,
  providerVideoId,
  title,
}: {
  providerSlug: string;
  embedUrl: string | null;
  providerVideoId: string;
  title: string;
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
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={valid}
        title={title}
        className="absolute inset-0 h-full w-full"
        frameBorder={0}
        allowFullScreen
        referrerPolicy="origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    </div>
  );
}
