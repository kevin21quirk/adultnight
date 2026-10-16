import type {
  DeletedRecord,
  NormalizedVideoRecord,
  ProviderAdapter,
} from "./types";

/**
 * Eporner provider adapter.
 *
 * Verified against the official API (github.com/eporner/API) on 2026-10-17:
 * - Catalogue: GET https://www.eporner.com/api/v2/video/search/?query=all
 *   &per_page={1..1000}&page={n}&thumbsize=big&order=latest&format=json
 *   Paginated JSON; fields: id, title, keywords (csv), views, url, added,
 *   length_sec, embed, default_thumb.src, thumbs[].
 * - Availability: GET /api/v2/video/id/?id={id}&format=json returns the
 *   video object, or [] when the video is gone — a definitive signal.
 * - Embed: https://www.eporner.com/embed/{id}/ (supplied by the API).
 * - Thumbnails: static-*-cdn.eporner.com.
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const EMBED_HOSTS = ["www.eporner.com", "eporner.com"];
const THUMB_HOST_SUFFIX = ".eporner.com";
const SEARCH_URL =
  "https://www.eporner.com/api/v2/video/search/?query=all&per_page=1000&thumbsize=big&order=latest&format=json&page={page}";
const ID_URL = "https://www.eporner.com/api/v2/video/id/?format=json&id=";

const VR_RE = /virtual.?reality|^vr$|vr porn/i;

function safeUrl(raw: unknown): URL | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function hostAllowed(hostname: string): boolean {
  return EMBED_HOSTS.includes(hostname.toLowerCase());
}

function thumbAllowed(raw: unknown): raw is string {
  const u = safeUrl(raw);
  if (!u) return false;
  const h = u.hostname.toLowerCase();
  return h === "eporner.com" || h.endsWith(THUMB_HOST_SUFFIX);
}

export const epornerAdapter: ProviderAdapter = {
  slug: "eporner",
  displayName: "Eporner",
  embedHosts: EMBED_HOSTS,
  thumbnailHosts: ["eporner.com", "*.eporner.com"],
  sourceHosts: EMBED_HOSTS,
  feeds: [{ kind: "json_pages", url: SEARCH_URL, role: "catalogue" }],

  validateVideoId(id: string): boolean {
    return VIDEO_ID_RE.test(id);
  },

  embedUrlFor(videoId: string): string {
    return `https://www.eporner.com/embed/${videoId}/`;
  },

  sourceUrlFor(videoId: string): string {
    return `https://www.eporner.com/video-${videoId}/`;
  },

  validateEmbedUrl(raw: string): boolean {
    const u = safeUrl(raw);
    if (!u || !hostAllowed(u.hostname)) return false;
    return /^\/embed\/[A-Za-z0-9_-]{6,20}\/?$/i.test(u.pathname);
  },

  videoIdFromUrl(raw: string): string | null {
    const u = safeUrl(raw);
    if (!u || !hostAllowed(u.hostname)) return null;
    for (const re of [
      /^\/embed\/([A-Za-z0-9_-]{6,20})\/?$/i,
      /^\/(?:hd-porn|video)-([A-Za-z0-9_-]{6,20})(?:\/|$)/i,
    ]) {
      const m = re.exec(u.pathname);
      if (m && VIDEO_ID_RE.test(m[1])) return m[1];
    }
    return null;
  },

  parseDumpRow(line: string): NormalizedVideoRecord | null {
    let item: Record<string, unknown>;
    try {
      item = JSON.parse(line);
    } catch {
      return null;
    }

    const id = item.id;
    if (typeof id !== "string" || !VIDEO_ID_RE.test(id)) return null;

    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!title || title.length > 300) return null;

    const embedUrl = typeof item.embed === "string" ? item.embed : null;
    if (!embedUrl || !epornerAdapter.validateEmbedUrl(embedUrl)) return null;

    const thumb = (item.default_thumb as { src?: unknown } | undefined)?.src;
    const thumbnailUrl = thumbAllowed(thumb) ? thumb : null;

    const tags = (typeof item.keywords === "string" ? item.keywords : "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 60)
      .slice(0, 50);

    const lengthSec =
      typeof item.length_sec === "number" && item.length_sec > 0
        ? Math.floor(item.length_sec)
        : null;

    const views =
      typeof item.views === "number" && item.views >= 0
        ? Math.floor(item.views)
        : null;

    const sourceUrl =
      safeUrl(item.url) && hostAllowed(new URL(item.url as string).hostname)
        ? (item.url as string)
        : epornerAdapter.sourceUrlFor(id);

    const publishedAt =
      typeof item.added === "string" && !Number.isNaN(Date.parse(item.added))
        ? new Date(item.added.replace(" ", "T") + "Z")
        : null;

    const isVr = tags.some((t) => VR_RE.test(t));

    return {
      providerVideoId: id,
      title,
      description: null,
      thumbnailUrl,
      embedUrl,
      sourceUrl,
      durationSeconds: lengthSec,
      views,
      tags,
      categories: isVr ? ["Virtual Reality"] : [],
      publishedAt,
    };
  },

  parseDeletedRow(_line: string): DeletedRecord | null {
    // Eporner removal is detected via checkAvailable / the id endpoint,
    // which returns [] for dead videos — no separate deletions feed.
    return null;
  },

  async checkAvailable(
    videoId: string,
    fetchImpl: typeof fetch = fetch
  ): Promise<"available" | "unavailable" | "unknown"> {
    if (!VIDEO_ID_RE.test(videoId)) return "unavailable";
    try {
      const res = await fetchImpl(ID_URL + encodeURIComponent(videoId), {
        headers: { "user-agent": "av-discovery/0.1 (+availability-check)" },
      });
      if (!res.ok) return "unknown";
      const body = await res.text();
      // The id endpoint returns [] for removed videos — definitive.
      if (body.trim().startsWith("[]")) return "unavailable";
      return body.includes(`"${videoId}"`) ? "available" : "unknown";
    } catch {
      return "unknown";
    }
  },
};
