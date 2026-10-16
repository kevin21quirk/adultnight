import type {
  DeletedRecord,
  NormalizedVideoRecord,
  ProviderAdapter,
} from "./types";

/**
 * Pornhub provider adapter.
 *
 * Verified against https://www.pornhub.com/webmasters on 2026-10-16:
 * - Catalogue dump: https://www.pornhub.com/files/pornhub.com-db.zip
 *   ZIP containing `pornhub.com-db.csv` — pipe-delimited, 13 fields, no header:
 *     0  embed iframe HTML (src="https://www.pornhub.com/embed/{viewkey}")
 *     1  primary thumbnail URL (*.phncdn.com)
 *     2  alternate thumbnails, ';'-separated
 *     3  title
 *     4  tags, ';'-separated
 *     5  categories, ';'-separated
 *     6  performer names, ';'-separated
 *     7  duration in seconds (integer)
 *     8  view count (integer)
 *     9  provider metric (integer; meaning unverified — not stored)
 *     10 provider metric (integer; meaning unverified — not stored)
 *     11 secondary thumbnail URL
 *     12 further thumbnails, ';'-separated
 * - Deletions feed: https://www.pornhub.com/files/deleted.csv
 *   Plain CSV rows `{numericId},{viewkey},{view_video URL}` — no header.
 * - Added-videos RSS at /video/webmasterss currently redirects (302) to the
 *   homepage — not usable. Incremental sync relies on re-scanning the daily-
 *   refreshed dump plus the deletions feed.
 * - Embed player: https://www.pornhub.com/embed/{viewkey} (HTTP 200 verified).
 * - View keys observed are 20-hex-char; legacy keys use a "ph" prefix.
 */

const VIDEO_ID_RE = /^(?:ph)?[0-9a-f]{10,24}$/i;
const EMBED_HOSTS = ["www.pornhub.com", "pornhub.com"];
const THUMB_HOST_SUFFIX = ".phncdn.com";
const DUMP_URL = "https://www.pornhub.com/files/pornhub.com-db.zip";
const DELETED_URL = "https://www.pornhub.com/files/deleted.csv";

function hostAllowed(hostname: string, hosts: string[]): boolean {
  return hosts.includes(hostname.toLowerCase());
}

function thumbnailHostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "phncdn.com" || h.endsWith(THUMB_HOST_SUFFIX);
}

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function isAllowedThumb(raw: string): boolean {
  const u = safeUrl(raw);
  return !!u && thumbnailHostAllowed(u.hostname);
}

function isAllowedPageUrl(raw: string): boolean {
  const u = safeUrl(raw);
  return !!u && hostAllowed(u.hostname, EMBED_HOSTS);
}

export const pornhubAdapter: ProviderAdapter = {
  slug: "pornhub",
  displayName: "Pornhub",
  embedHosts: EMBED_HOSTS,
  thumbnailHosts: ["phncdn.com", "*.phncdn.com"],
  sourceHosts: EMBED_HOSTS,
  feeds: [
    { kind: "zip_csv", url: DUMP_URL, role: "catalogue" },
    { kind: "csv", url: DELETED_URL, role: "deletions" },
  ],

  validateVideoId(id: string): boolean {
    return VIDEO_ID_RE.test(id);
  },

  embedUrlFor(videoId: string): string {
    return `https://www.pornhub.com/embed/${videoId}`;
  },

  sourceUrlFor(videoId: string): string {
    return `https://www.pornhub.com/view_video.php?viewkey=${videoId}`;
  },

  validateEmbedUrl(raw: string): boolean {
    const u = safeUrl(raw);
    if (!u || !hostAllowed(u.hostname, EMBED_HOSTS)) return false;
    const m = /^\/embed\/((?:ph)?[0-9a-f]{10,24})\/?$/i.exec(u.pathname);
    return !!m;
  },

  videoIdFromUrl(raw: string): string | null {
    const u = safeUrl(raw);
    if (!u || !hostAllowed(u.hostname, EMBED_HOSTS)) return null;
    const embed = /^\/embed\/((?:ph)?[0-9a-f]{10,24})\/?$/i.exec(u.pathname);
    if (embed) return embed[1];
    if (u.pathname === "/view_video.php") {
      const key = u.searchParams.get("viewkey");
      if (key && VIDEO_ID_RE.test(key)) return key;
    }
    return null;
  },

  parseDumpRow(line: string): NormalizedVideoRecord | null {
    const fields = line.split("|");
    if (fields.length < 11) return null;

    const embedSrc = /src="(https:\/\/[^"]+)"/i.exec(fields[0]);
    if (!embedSrc) return null;
    const embedUrl = embedSrc[1];
    if (!pornhubAdapter.validateEmbedUrl(embedUrl)) return null;

    const videoId = pornhubAdapter.videoIdFromUrl(embedUrl);
    if (!videoId) return null;

    const title = fields[3]?.trim();
    if (!title || title.length > 300) return null;

    const thumbnailUrl = isAllowedThumb(fields[1]) ? fields[1] : null;

    const tags = (fields[4] ?? "")
      .split(";")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 60)
      .slice(0, 50);
    const categories = (fields[5] ?? "")
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && c.length <= 100)
      .slice(0, 20);

    const duration = parseInt(fields[7] ?? "", 10);
    const durationSeconds =
      Number.isFinite(duration) && duration > 0 && duration < 24 * 3600
        ? duration
        : null;

    const viewsNum = parseInt(fields[8] ?? "", 10);
    const views = Number.isFinite(viewsNum) && viewsNum >= 0 ? viewsNum : null;

    return {
      providerVideoId: videoId,
      title,
      description: null,
      thumbnailUrl,
      embedUrl,
      sourceUrl: pornhubAdapter.sourceUrlFor(videoId),
      durationSeconds,
      views,
      tags,
      categories,
      publishedAt: null,
    };
  },

  parseDeletedRow(line: string): DeletedRecord | null {
    const fields = line.split(",");
    const viewkey = fields[1]?.trim();
    if (!viewkey || !VIDEO_ID_RE.test(viewkey)) return null;
    const url = fields[2]?.trim();
    if (url && !isAllowedPageUrl(url)) return null;
    return { providerVideoId: viewkey };
  },

  async checkAvailable(
    videoId: string,
    fetchImpl: typeof fetch = fetch
  ): Promise<"available" | "unavailable" | "unknown"> {
    if (!VIDEO_ID_RE.test(videoId)) return "unavailable";
    try {
      // Caution: the embed endpoint serves a "This video is unavailable"
      // page to age-unverified visitors in restricted jurisdictions (e.g.
      // UK under the OSA) even for live videos. That response is therefore
      // NOT proof of removal — only the deletions feed is authoritative.
      const res = await fetchImpl(pornhubAdapter.embedUrlFor(videoId), {
        headers: { "user-agent": "av-discovery/0.1 (+embed-check)" },
      });
      if (!res.ok) return res.status === 404 ? "unavailable" : "unknown";
      const body = await res.text();
      if (/this video is unavailable|video has been (removed|disabled|flagged)/i.test(body)) {
        return "unknown"; // could be regional/verification gating
      }
      return body.length > 20000 ? "available" : "unknown";
    } catch {
      return "unknown";
    }
  },
};
