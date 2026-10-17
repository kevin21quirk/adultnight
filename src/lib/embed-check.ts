import { getAdapter } from "@/lib/providers/registry";

/**
 * Reports whether a provider gates its embed behind age verification for an
 * anonymous (cookieless) request. The probe runs server-side — it is not
 * subject to CORS or the user's browser settings — but it sees the server's
 * egress region, not the user's provider session, so "gated" means
 * "anonymous viewers are gated", not "this user is unverified".
 */
export type EmbedGateState = "gated" | "playable" | "unknown";

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { state: EmbedGateState; expiresAt: number }>();

/** Returns null when the provider/id is unknown or malformed. */
export async function checkEmbedGate(
  providerSlug: string,
  videoId: string
): Promise<EmbedGateState | null> {
  const adapter = getAdapter(providerSlug);
  if (!adapter || !adapter.validateVideoId(videoId)) return null;

  const key = `${providerSlug}:${videoId}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.state;

  const state: EmbedGateState = adapter.probeEmbedGate
    ? await adapter.probeEmbedGate(videoId)
    : "unknown";
  cache.set(key, { state, expiresAt: Date.now() + CACHE_TTL_MS });
  return state;
}

/** Test hook. */
export function _resetEmbedCheckCache(): void {
  cache.clear();
}
