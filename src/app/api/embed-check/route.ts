import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/providers/registry";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Reports whether a provider gates its embed behind age verification for an
 * anonymous (cookieless) request. The probe runs server-side — it is not
 * subject to CORS or the user's browser settings — but it sees the server's
 * egress region, not the user's provider session, so "gated" means
 * "anonymous viewers are gated", not "this user is unverified".
 *
 * GET /api/embed-check?provider=<slug>&id=<providerVideoId>
 * → { "state": "gated" | "playable" | "unknown" }
 *
 * Only provider+id are accepted (validated against the adapter) so this can
 * never proxy arbitrary URLs.
 */
export type EmbedGateState = "gated" | "playable" | "unknown";

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { state: EmbedGateState; expiresAt: number }>();

export async function GET(req: Request) {
  const rl = rateLimit(clientKey(req, "embed-check"), 60, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const adapter = getAdapter(provider);
  if (!adapter || !adapter.validateVideoId(id)) {
    return NextResponse.json({ state: "unknown" }, { status: 400 });
  }

  const key = `${provider}:${id}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ state: hit.state });
  }

  const state: EmbedGateState = adapter.probeEmbedGate
    ? await adapter.probeEmbedGate(id)
    : "unknown";
  cache.set(key, { state, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json({ state });
}

/** Test hook. */
export function _resetEmbedCheckCache(): void {
  cache.clear();
}
