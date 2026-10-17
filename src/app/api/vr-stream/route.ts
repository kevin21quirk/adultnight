import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { videos } from "@/lib/db/schema";
import { isUuid } from "@/lib/queries";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Same-origin streaming proxy for a video's stored media_url.
 *
 * GET /api/vr-stream?v=<video uuid>
 *
 * Two jobs:
 *  - WebGL VideoTexture requires CORS-clean bytes; proxying through our own
 *    origin satisfies that for any upstream that lacks CORS headers.
 *  - It is a CLOSED proxy: it only ever fetches the exact media_url stored
 *    on an approved video row — no arbitrary URL parameter exists.
 *
 * Range headers are forwarded so the browser can seek without buffering the
 * whole file.
 */
const PASS_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
] as const;

export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "vr-stream"), 120, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const id = new URL(req.url).searchParams.get("v") ?? "";
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid video id." }, { status: 400 });
  }

  const db = getDb();
  const video = await db.query.videos.findFirst({
    where: eq(videos.id, id),
    columns: { status: true, mediaUrl: true },
  });
  if (!video || video.status !== "approved" || !video.mediaUrl) {
    return NextResponse.json({ error: "No media stream." }, { status: 404 });
  }

  let target: URL;
  try {
    target = new URL(video.mediaUrl);
  } catch {
    return NextResponse.json({ error: "No media stream." }, { status: 404 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "No media stream." }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "user-agent": "av-discovery/0.1 (+vr-stream)",
  };
  const range = req.headers.get("range");
  if (range) headers.range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return NextResponse.json({ error: "Upstream unreachable." }, { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: "Upstream error." },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const resHeaders = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }
  if (!resHeaders.has("content-type")) {
    resHeaders.set("content-type", "video/mp4");
  }
  resHeaders.set("cache-control", "private, max-age=3600");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}
