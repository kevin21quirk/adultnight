import { afterEach, describe, expect, it, vi } from "vitest";
import { pornhubAdapter } from "@/lib/providers/pornhub";
import { GET } from "@/app/api/embed-check/route";
import { _resetEmbedCheckCache } from "@/lib/embed-check";
import { _resetRateLimits } from "@/lib/security/rate-limit";

const VID = "a1b2c3d4e5f6a7b8c9d0";

function fakeFetch(body: string, status = 200): typeof fetch {
  return (() =>
    Promise.resolve(new Response(body, { status }))) as unknown as typeof fetch;
}

describe("pornhub probeEmbedGate", () => {
  it("flags the age-verification stub page as gated", async () => {
    const stub = "<html><body>This video is unavailable.</body></html>";
    expect(await pornhubAdapter.probeEmbedGate!(VID, fakeFetch(stub))).toBe(
      "gated"
    );
  });
  it("treats a small body without markers as gated", async () => {
    expect(await pornhubAdapter.probeEmbedGate!(VID, fakeFetch("<p>x</p>"))).toBe(
      "gated"
    );
  });
  it("treats a full player document as playable", async () => {
    const body = `<html>${"x".repeat(25000)}</html>`;
    expect(await pornhubAdapter.probeEmbedGate!(VID, fakeFetch(body))).toBe(
      "playable"
    );
  });
  it("returns unknown on http errors, network errors and bad ids", async () => {
    expect(
      await pornhubAdapter.probeEmbedGate!(VID, fakeFetch("nope", 500))
    ).toBe("unknown");
    const throwing = (() =>
      Promise.reject(new Error("net"))) as unknown as typeof fetch;
    expect(await pornhubAdapter.probeEmbedGate!(VID, throwing)).toBe("unknown");
    expect(
      await pornhubAdapter.probeEmbedGate!("not a key!", fakeFetch("x"))
    ).toBe("unknown");
  });
});

describe("GET /api/embed-check", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    _resetEmbedCheckCache();
    _resetRateLimits();
  });

  it("rejects unknown providers and malformed ids", async () => {
    const badProvider = await GET(
      new Request("http://t/api/embed-check?provider=nope&id=" + VID)
    );
    expect(badProvider.status).toBe(400);
    const badId = await GET(
      new Request("http://t/api/embed-check?provider=pornhub&id=<x>")
    );
    expect(badId.status).toBe(400);
    expect((await badId.json()).state).toBe("unknown");
  });

  it("probes the provider and caches the result", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("This video is unavailable", { status: 200 }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = () =>
      new Request(
        `http://t/api/embed-check?provider=pornhub&id=${VID}`
      );
    const first = await GET(req());
    expect(first.status).toBe(200);
    expect((await first.json()).state).toBe("gated");

    const second = await GET(req());
    expect((await second.json()).state).toBe("gated");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
