import { NextResponse } from "next/server";
import { checkEmbedGate } from "@/lib/embed-check";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/embed-check?provider=<slug>&id=<providerVideoId>
 * → { "state": "gated" | "playable" | "unknown" }
 *
 * Only provider+id are accepted (validated against the adapter) so this can
 * never proxy arbitrary URLs.
 */
export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "embed-check"), 60, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const url = new URL(req.url);
  const state = await checkEmbedGate(
    url.searchParams.get("provider") ?? "",
    url.searchParams.get("id") ?? ""
  );
  if (state === null) {
    return NextResponse.json({ state: "unknown" }, { status: 400 });
  }
  return NextResponse.json({ state });
}
