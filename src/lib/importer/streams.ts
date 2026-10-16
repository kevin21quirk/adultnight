import { Readable, Transform } from "node:stream";
import { createInflateRaw } from "node:zlib";
import type { FeedDescriptor } from "../providers/types";

/** Yield complete UTF-8 lines ("\n"-separated) from a byte chunk iterable. */
async function* bytesToLines(
  chunks: AsyncIterable<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of chunks) {
    buf += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      yield buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
    }
  }
  buf += decoder.decode();
  if (buf.trim().length > 0) yield buf;
}

/** Drop the ZIP local file header so downstream inflate sees raw entry data. */
class StripLocalHeader extends Transform {
  private buf = Buffer.alloc(0);
  private done = false;

  _transform(
    chunk: Buffer,
    _enc: BufferEncoding,
    cb: (err?: Error | null, data?: Buffer) => void
  ): void {
    if (this.done) return cb(null, chunk);
    this.buf = Buffer.concat([this.buf, chunk]);
    if (this.buf.length < 30) return cb();
    const nameLen = this.buf.readUInt16LE(26);
    const extraLen = this.buf.readUInt16LE(28);
    const method = this.buf.readUInt16LE(8);
    const offset = 30 + nameLen + extraLen;
    if (this.buf.length < offset) return cb();
    if (method !== 8) {
      return cb(new Error(`unsupported zip compression method ${method}`));
    }
    const rest = this.buf.subarray(offset);
    this.done = true;
    this.buf = Buffer.alloc(0);
    cb(null, rest);
  }
}

/**
 * Stream lines from a remote .zip containing a single deflated CSV.
 * Decompresses on the fly — the multi-GB archive is never held in memory.
 */
async function* zipEntryLines(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const inflated = Readable.fromWeb(
    stream as unknown as import("stream/web").ReadableStream
  ).pipe(
    new StripLocalHeader()
  ).pipe(createInflateRaw());
  yield* bytesToLines(inflated);
}

export async function* streamFeedLines(
  feed: FeedDescriptor,
  fetchImpl: typeof fetch = fetch
): AsyncGenerator<string> {
  const res = await fetchImpl(feed.url);
  if (!res.ok || !res.body) {
    throw new Error(`feed fetch failed: HTTP ${res.status} for ${feed.url}`);
  }
  const body = res.body as ReadableStream<Uint8Array>;
  if (feed.kind === "zip_csv") {
    yield* zipEntryLines(body);
  } else {
    yield* bytesToLines(
      Readable.fromWeb(body as unknown as import("stream/web").ReadableStream)
    );
  }
}
