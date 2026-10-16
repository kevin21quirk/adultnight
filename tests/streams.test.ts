import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { streamFeedLines } from "@/lib/importer/streams";
import { slugify } from "@/lib/importer/run";

function makeZip(csv: string): Uint8Array {
  const data = deflateRawSync(Buffer.from(csv, "utf8"));
  const name = Buffer.from("dump.csv");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(8, 8); // method: deflate
  header.writeUInt16LE(name.length, 26);
  return Buffer.concat([header, name, data]);
}

function fakeFetch(body: Uint8Array): typeof fetch {
  return (() =>
    Promise.resolve(
      new Response(new ReadableStream({
        start(c) {
          // drip-feed small chunks to exercise streaming
          const step = 100;
          for (let i = 0; i < body.length; i += step) {
            c.enqueue(body.subarray(i, i + step));
          }
          c.close();
        },
      }))
    )) as unknown as typeof fetch;
}

describe("feed streaming", () => {
  it("streams lines from a zipped csv", async () => {
    const csv = "line one|x\nline two|y\nline three|z\n";
    const lines: string[] = [];
    for await (const l of streamFeedLines(
      { kind: "zip_csv", url: "https://x/db.zip", role: "catalogue" },
      fakeFetch(makeZip(csv))
    )) {
      lines.push(l);
    }
    expect(lines).toEqual(["line one|x", "line two|y", "line three|z"]);
  });

  it("streams lines from a plain csv", async () => {
    const lines: string[] = [];
    for await (const l of streamFeedLines(
      { kind: "csv", url: "https://x/d.csv", role: "deletions" },
      fakeFetch(new TextEncoder().encode("1,a,b\n2,c,d"))
    )) {
      lines.push(l);
    }
    expect(lines).toEqual(["1,a,b", "2,c,d"]);
  });

  it("errors on non-2xx responses", async () => {
    const bad = (() =>
      Promise.resolve(new Response(null, { status: 503 }))) as unknown as typeof fetch;
    await expect(async () => {
      for await (const _ of streamFeedLines(
        { kind: "csv", url: "https://x", role: "deletions" },
        bad
      )) void _;
    }).rejects.toThrow("503");
  });
});

describe("slugify", () => {
  it("normalizes category names", () => {
    expect(slugify("Big Tits")).toBe("big-tits");
    expect(slugify("18-25")).toBe("18-25");
    expect(slugify("  Solo Female  ")).toBe("solo-female");
    expect(slugify("it's a test")).toBe("its-a-test");
  });
});
