import { describe, expect, it } from "vitest";
import { pornhubAdapter } from "@/lib/providers/pornhub";
import { dumpRow, deletedRow } from "./fixtures";

describe("pornhub adapter — video id validation", () => {
  it("accepts 20-hex viewkeys", () => {
    expect(pornhubAdapter.validateVideoId("a1b2c3d4e5f6a7b8c9d0")).toBe(true);
  });
  it("accepts legacy ph-prefixed keys", () => {
    expect(pornhubAdapter.validateVideoId("ph5f8d2c1a9b3e")).toBe(true);
  });
  it("rejects malformed ids", () => {
    expect(pornhubAdapter.validateVideoId("")).toBe(false);
    expect(pornhubAdapter.validateVideoId("not a key!")).toBe(false);
    expect(pornhubAdapter.validateVideoId("<script>")).toBe(false);
    expect(pornhubAdapter.validateVideoId("xyz")).toBe(false);
  });
});

describe("pornhub adapter — embed urls", () => {
  it("builds official embed url", () => {
    expect(pornhubAdapter.embedUrlFor("a1b2c3d4e5f6a7b8c9d0")).toBe(
      "https://www.pornhub.com/embed/a1b2c3d4e5f6a7b8c9d0"
    );
  });
  it("validates official embed urls", () => {
    expect(
      pornhubAdapter.validateEmbedUrl("https://www.pornhub.com/embed/a1b2c3d4e5f6a7b8c9d0")
    ).toBe(true);
  });
  it("rejects non-https, wrong hosts, wrong paths", () => {
    expect(
      pornhubAdapter.validateEmbedUrl("http://www.pornhub.com/embed/a1b2c3d4e5f6a7b8c9d0")
    ).toBe(false);
    expect(
      pornhubAdapter.validateEmbedUrl("https://evil.com/embed/a1b2c3d4e5f6a7b8c9d0")
    ).toBe(false);
    expect(
      pornhubAdapter.validateEmbedUrl("https://www.pornhub.com.evil.com/embed/a1b2c3d4e5f6a7b8c9d0")
    ).toBe(false);
    expect(
      pornhubAdapter.validateEmbedUrl("https://www.pornhub.com/watch/a1b2c3d4e5f6a7b8c9d0")
    ).toBe(false);
    expect(pornhubAdapter.validateEmbedUrl("javascript:alert(1)")).toBe(false);
  });
  it("extracts ids from view_video and embed urls", () => {
    expect(
      pornhubAdapter.videoIdFromUrl(
        "https://www.pornhub.com/view_video.php?viewkey=a1b2c3d4e5f6a7b8c9d0"
      )
    ).toBe("a1b2c3d4e5f6a7b8c9d0");
    expect(
      pornhubAdapter.videoIdFromUrl("https://www.pornhub.com/embed/a1b2c3d4e5f6a7b8c9d0")
    ).toBe("a1b2c3d4e5f6a7b8c9d0");
    expect(pornhubAdapter.videoIdFromUrl("https://evil.com/embed/a1b2c3d4e5f6a7b8c9d0")).toBeNull();
  });
});

describe("pornhub adapter — dump row parsing", () => {
  it("parses a valid 13-field row", () => {
    const rec = pornhubAdapter.parseDumpRow(dumpRow({}));
    expect(rec).not.toBeNull();
    expect(rec!.providerVideoId).toBe("a1b2c3d4e5f6a7b8c9d0");
    expect(rec!.title).toBe("Synthetic demo video title");
    expect(rec!.tags).toEqual(["demo", "test", "synthetic"]);
    expect(rec!.categories).toEqual(["Amateur", "POV"]);
    expect(rec!.durationSeconds).toBe(754);
    expect(rec!.views).toBe(12345);
    expect(rec!.embedUrl).toBe(
      "https://www.pornhub.com/embed/a1b2c3d4e5f6a7b8c9d0"
    );
    expect(rec!.thumbnailUrl).toMatch(/^https:\/\/ei\.phncdn\.com\//);
  });
  it("rejects rows with bad embed iframe", () => {
    const bad = dumpRow({}).replace(
      "https://www.pornhub.com/embed/a1b2c3d4e5f6a7b8c9d0",
      "https://evil.example/x"
    );
    expect(pornhubAdapter.parseDumpRow(bad)).toBeNull();
  });
  it("rejects rows with too few fields", () => {
    expect(pornhubAdapter.parseDumpRow("a|b|c")).toBeNull();
    expect(pornhubAdapter.parseDumpRow("")).toBeNull();
  });
  it("drops thumbnails on disallowed hosts", () => {
    const row = dumpRow({}).replace(
      "https://ei.phncdn.com",
      "https://tracker.evil.example"
    );
    const rec = pornhubAdapter.parseDumpRow(row);
    expect(rec).not.toBeNull();
    expect(rec!.thumbnailUrl).toBeNull();
  });
  it("sanitizes absurd durations", () => {
    const rec = pornhubAdapter.parseDumpRow(dumpRow({ duration: "99999999" }));
    expect(rec!.durationSeconds).toBeNull();
  });
});

describe("pornhub adapter — deleted feed parsing", () => {
  it("parses a deleted row", () => {
    expect(pornhubAdapter.parseDeletedRow(deletedRow("6c95bd2b32ed45989c61"))).toEqual({
      providerVideoId: "6c95bd2b32ed45989c61",
    });
  });
  it("rejects malformed rows", () => {
    expect(pornhubAdapter.parseDeletedRow("")).toBeNull();
    expect(pornhubAdapter.parseDeletedRow("1,!!bad!!,url")).toBeNull();
    expect(
      pornhubAdapter.parseDeletedRow("1,a1b2c3d4e5f6a7b8c9d0,https://evil.com/x")
    ).toBeNull();
  });
});
