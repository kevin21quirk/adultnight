export interface NormalizedVideoRecord {
  providerVideoId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  embedUrl: string;
  sourceUrl: string | null;
  durationSeconds: number | null;
  views: number | null;
  tags: string[];
  categories: string[];
  publishedAt: Date | null;
}

export interface DeletedRecord {
  providerVideoId: string;
}

export interface FeedDescriptor {
  kind: "zip_csv" | "csv" | "json_pages";
  /** For json_pages, may contain a `{page}` placeholder. */
  url: string;
  role: "catalogue" | "deletions";
}

export interface ProviderAdapter {
  slug: string;
  displayName: string;
  /** Hostnames permitted for embed iframes. */
  embedHosts: string[];
  /** Hostnames permitted for thumbnail images. */
  thumbnailHosts: string[];
  /** Hostnames permitted for outbound "view on source" links. */
  sourceHosts: string[];
  feeds: FeedDescriptor[];
  validateVideoId(id: string): boolean;
  embedUrlFor(videoId: string): string;
  sourceUrlFor(videoId: string): string;
  validateEmbedUrl(url: string): boolean;
  /** Extract a provider video id from a user-supplied source or embed URL. */
  videoIdFromUrl(url: string): string | null;
  /** Parse one catalogue-dump line into a normalized record, or null if invalid. */
  parseDumpRow(line: string): NormalizedVideoRecord | null;
  /** Parse one deletions-feed line, or null if invalid. */
  parseDeletedRow(line: string): DeletedRecord | null;
  /**
   * Probe whether a video still plays at the provider. Returns 'unknown'
   * on network errors — never treat a failed check as removal.
   */
  checkAvailable(
    videoId: string,
    fetchImpl?: typeof fetch
  ): Promise<"available" | "unavailable" | "unknown">;
  /**
   * Probe whether the provider serves a playable embed to a request with NO
   * user session — i.e. whether anonymous viewers hit an age-verification
   * gate instead of the player. This reflects the server's egress region,
   * not the end user's verification state. Optional: providers without
   * embed gating may omit it and callers should treat that as 'unknown'.
   */
  probeEmbedGate?(
    videoId: string,
    fetchImpl?: typeof fetch
  ): Promise<"gated" | "playable" | "unknown">;
}
