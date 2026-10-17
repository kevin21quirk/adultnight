import type {
  DeletedRecord,
  NormalizedVideoRecord,
  ProviderAdapter,
} from "./types";

/**
 * VRBone provider adapter (VR-only tube).
 *
 * Verified against vrbone.com on 2026-10-17:
 * - Catalogue: sitemap index at https://vrbone.com/sitemap.xml lists child
 *   sitemaps /sitemaps/videos-1.xml, videos-trans.xml, videos-gay.xml —
 *   ~6k video pages total, each with a thumbnail <image:loc>.
 * - No iframe embeds: video pages send X-Frame-Options: SAMEORIGIN.
 * - Each video page is SSR HTML carrying a JSON-LD VideoObject (name,
 *   thumbnailUrl, duration, uploadDate, genre, productionCompany) and a
 *   player <video src="https://vrbone.com/t/<numeric id>/">. That endpoint
 *   302s to the underlying CDN mp4 — it is the site's own public player
 *   source; we use it as media_url for the interactive VR player.
 * - All content is VR (180° SBS is the dominant format).
 */

const HOSTS = ["vrbone.com", "www.vrbone.com"];
const THUMB_HOST = "vrbone.b-cdn.net";
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,140}$/;
const SITEMAP_URL = "https://vrbone.com/sitemap.xml";

const LD_BLOCK_RE = /<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
const MEDIA_SRC_RE = /https:\/\/vrbone\.com\/t\/(\d+)\/?/i;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function hostAllowed(hostname: string, hosts: string[]): boolean {
  return hosts.includes(hostname.toLowerCase());
}

function isoDurationSeconds(s: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(s.trim());
  if (!m) return null;
  const sec = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return sec > 0 ? sec : null;
}

interface VideoObjectLd {
  "@type"?: string;
  name?: string;
  url?: string;
  thumbnailUrl?: unknown;
  uploadDate?: string;
  duration?: string;
  genre?: unknown;
  productionCompany?: { name?: string };
}

function videoObjectFromHtml(html: string): VideoObjectLd | null {
  for (const m of html.matchAll(LD_BLOCK_RE)) {
    try {
      const data = JSON.parse(m[1]) as VideoObjectLd | VideoObjectLd[];
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item && item["@type"] === "VideoObject") return item;
      }
    } catch {
      // not JSON — keep looking
    }
  }
  return null;
}

function firstThumb(raw: unknown): string | null {
  const cand = Array.isArray(raw) ? raw[0] : raw;
  if (typeof cand !== "string") return null;
  const u = safeUrl(cand);
  return u && u.hostname.toLowerCase() === THUMB_HOST ? cand : null;
}

export const vrboneAdapter: ProviderAdapter = {
  slug: "vrbone",
  displayName: "VRBone",
  embedHosts: HOSTS,
  thumbnailHosts: [THUMB_HOST],
  sourceHosts: HOSTS,
  feeds: [{ kind: "sitemap_html", url: SITEMAP_URL, role: "catalogue" }],

  validateVideoId(id: string): boolean {
    return SLUG_RE.test(id);
  },

  // VRBone sends X-Frame-Options: SAMEORIGIN — it has no embeddable URL.
  embedUrlFor(): string {
    return "";
  },

  sourceUrlFor(videoId: string): string {
    return `https://vrbone.com/${videoId}/`;
  },

  validateEmbedUrl(): boolean {
    return false;
  },

  videoIdFromUrl(raw: string): string | null {
    const u = safeUrl(raw);
    if (!u || !hostAllowed(u.hostname, HOSTS)) return null;
    const m = /^\/([a-z0-9][a-z0-9-]{2,140})\/?$/i.exec(u.pathname);
    return m && SLUG_RE.test(m[1]) ? m[1].toLowerCase() : null;
  },

  parseDumpRow(html: string): NormalizedVideoRecord | null {
    const ld = videoObjectFromHtml(html);
    if (!ld) return null;

    const pageUrl = safeUrl(ld.url ?? "");
    const slug = pageUrl ? vrboneAdapter.videoIdFromUrl(pageUrl.href) : null;
    if (!slug) return null;

    const title = typeof ld.name === "string" ? ld.name.trim() : "";
    if (!title || title.length > 300) return null;

    const mediaMatch = MEDIA_SRC_RE.exec(html);
    const mediaUrl = mediaMatch
      ? `https://vrbone.com/t/${mediaMatch[1]}/`
      : null;

    const genre = Array.isArray(ld.genre)
      ? ld.genre.filter((g): g is string => typeof g === "string")
      : [];
    const studio = ld.productionCompany?.name?.trim();
    const tags = [
      ...new Set(
        [...genre, studio ?? "", "vr"]
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0 && t.length <= 60)
      ),
    ].slice(0, 50);

    const durationSeconds = ld.duration ? isoDurationSeconds(ld.duration) : null;
    const publishedAt =
      typeof ld.uploadDate === "string" && !Number.isNaN(Date.parse(ld.uploadDate))
        ? new Date(ld.uploadDate)
        : null;

    return {
      providerVideoId: slug,
      title,
      description: null,
      thumbnailUrl: firstThumb(ld.thumbnailUrl),
      embedUrl: null,
      sourceUrl: vrboneAdapter.sourceUrlFor(slug),
      durationSeconds,
      views: null,
      tags,
      categories: ["Virtual Reality"],
      publishedAt,
      mediaUrl,
      vrMode: "sbs180",
    };
  },

  parseDeletedRow(_line: string): DeletedRecord | null {
    return null;
  },

  async checkAvailable(
    videoId: string,
    fetchImpl: typeof fetch = fetch
  ): Promise<"available" | "unavailable" | "unknown"> {
    if (!SLUG_RE.test(videoId)) return "unavailable";
    try {
      const res = await fetchImpl(vrboneAdapter.sourceUrlFor(videoId), {
        headers: { "user-agent": "av-discovery/0.1 (+availability-check)" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 404) return "unavailable";
      if (!res.ok) return "unknown";
      const body = await res.text();
      return /"VideoObject"|vrbone\.com\/t\/\d+/i.test(body)
        ? "available"
        : "unknown";
    } catch {
      return "unknown";
    }
  },
};
