import { describe, expect, it } from "vitest";
import { rateLimit, _resetRateLimits } from "@/lib/security/rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    _resetRateLimits();
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("k", 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
  it("tracks keys independently", () => {
    _resetRateLimits();
    rateLimit("a", 1, 60_000);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
  });
  it("resets after the window", async () => {
    _resetRateLimits();
    rateLimit("k2", 1, 20);
    await new Promise((r) => setTimeout(r, 30));
    expect(rateLimit("k2", 1, 20).ok).toBe(true);
  });
});
