import { afterEach, describe, expect, it, vi } from "vitest";
import { inferVrMode, isVrVideo } from "@/lib/vr";

vi.mock("@/lib/db/client", () => ({ getDb: vi.fn() }));
import { getDb } from "@/lib/db/client";
import { GET } from "@/app/api/vr-stream/route";
import { _resetRateLimits } from "@/lib/security/rate-limit";

const VID = "11111111-1111-1111-1111-111111111111";

describe("isVrVideo", () => {
  it("detects vr categories and tags", () => {
    expect(isVrVideo(["virtual-reality"], [])).toBe(true);
    expect(isVrVideo([], ["vr", "amateur"])).toBe(true);
    expect(isVrVideo([], ["VR Porn"])).toBe(true);
    expect(isVrVideo(["amateur"], ["milf"])).toBe(false);
    expect(isVrVideo([], [])).toBe(false);
  });
});

describe("inferVrMode", () => {
  it("honours an explicit mode", () => {
    expect(inferVrMode("mono360", "anything", [])).toBe("mono360");
    expect(inferVrMode("sbs180", "360 video", [])).toBe("sbs180");
  });
  it("infers mono360 from 360 mentions, else sbs180", () => {
    expect(inferVrMode(null, "Great 360 scene", [])).toBe("mono360");
    expect(inferVrMode(null, "x", ["vr", "360"])).toBe("mono360");
    expect(inferVrMode(null, "180 LR scene", ["vr180"])).toBe("sbs180");
  });
  it("rejects unknown explicit values", () => {
    expect(inferVrMode("weird", "t", [])).toBe("sbs180");
  });
});

describe("GET /api/vr-stream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    _resetRateLimits();
  });

  function mockDb(mediaUrl: string | null, status = "approved") {
    vi.mocked(getDb).mockReturnValue({
      query: {
        videos: {
          findFirst: async () =>
            mediaUrl === undefined ? null : { status, mediaUrl },
        },
      },
    } as never);
  }

  it("rejects malformed ids", async () => {
    const res = await GET(new Request("http://t/api/vr-stream?v=zzz"));
    expect(res.status).toBe(400);
  });

  it("404s when the video has no media url or isn't approved", async () => {
    mockDb(null);
    const res = await GET(new Request(`http://t/api/vr-stream?v=${VID}`));
    expect(res.status).toBe(404);
    mockDb("https://cdn.example.com/v.mp4", "pending_review");
    const res2 = await GET(new Request(`http://t/api/vr-stream?v=${VID}`));
    expect(res2.status).toBe(404);
  });

  it("streams the stored url and forwards Range", async () => {
    mockDb("https://cdn.example.com/v.mp4");
    const fetchMock = vi.fn(
      () =>
        new Response("bytes", {
          status: 206,
          headers: {
            "content-type": "video/mp4",
            "content-range": "bytes 0-4/10",
            "accept-ranges": "bytes",
          },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      new Request(`http://t/api/vr-stream?v=${VID}`, {
        headers: { range: "bytes=0-4" },
      })
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-4/10");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ href: "https://cdn.example.com/v.mp4" }),
      expect.objectContaining({
        headers: expect.objectContaining({ range: "bytes=0-4" }),
      })
    );
  });
});
