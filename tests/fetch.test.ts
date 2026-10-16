import { describe, expect, it } from "vitest";
import { fetchWithRetry, FetchError } from "@/lib/importer/fetch";

const ok = () => new Response("hi", { status: 200 });
const status = (s: number, headers?: Record<string, string>) =>
  new Response(null, { status: s, headers });

function seq(...fns: (() => Promise<Response> | Response)[]): typeof fetch {
  let i = 0;
  return (() => fns[Math.min(i++, fns.length - 1)]()) as unknown as typeof fetch;
}

describe("fetchWithRetry", () => {
  it("returns ok responses immediately", async () => {
    const res = await fetchWithRetry("https://x", {}, 4, seq(ok));
    expect(res.status).toBe(200);
  });

  it("retries on 429 and succeeds", async () => {
    const res = await fetchWithRetry(
      "https://x",
      {},
      3,
      seq(() => Promise.resolve(status(429, { "retry-after": "0" })), ok)
    );
    expect(res.status).toBe(200);
  });

  it("retries on 5xx then gives up with FetchError", async () => {
    await expect(
      fetchWithRetry("https://x", {}, 2, seq(() => Promise.resolve(status(503))))
    ).rejects.toThrow(FetchError);
  });

  it("does not retry 4xx (other than 429)", async () => {
    let calls = 0;
    const f = (() => {
      calls++;
      return Promise.resolve(status(404));
    }) as unknown as typeof fetch;
    await expect(fetchWithRetry("https://x", {}, 4, f)).rejects.toThrow("404");
    expect(calls).toBe(1);
  });

  it("retries network errors", async () => {
    const f = seq(
      () => Promise.reject(new Error("socket hangup")),
      () => Promise.resolve(ok())
    );
    const res = await fetchWithRetry("https://x", {}, 3, f);
    expect(res.status).toBe(200);
  });
});
