import { NextResponse } from "next/server";
import { allAdapters } from "@/lib/providers/registry";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const adapter of allAdapters()) {
    for (const pattern of adapter.thumbnailHosts) {
      if (pattern.startsWith("*.")) {
        const base = pattern.slice(2).toLowerCase();
        if (h === base || h.endsWith("." + base)) return true;
      } else if (h === pattern.toLowerCase()) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Thumbnail proxy: GET /api/thumb?u=<encoded https image url>
 * Streams provider-CDN thumbnails through our origin so client-side
 * blocks (ISP filters, ad-blockers flagging provider CDNs) don't blank
 * the catalogue. The target host is validated against every registered
 * adapter's thumbnail allowlist — this is not an open proxy.
 */
export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "thumb"), 600, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const raw = new URL(req.url).searchParams.get("u");
  if (!raw) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }
  if (target.protocol !== "https:" || !hostAllowed(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed." }, { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { "user-agent": "av-discovery/0.1 (+thumb-proxy)" },
    });
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed." }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !upstream.body || !type.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image." }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
