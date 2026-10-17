import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { vrboneAdapter } from "@/lib/providers/vrbone";
import { streamFeedLines } from "@/lib/importer/streams";

const pageHtml = readFileSync(
  path.resolve(__dirname, "fixtures/vrbone-page.html"),
  "utf8"
);

describe("vrbone adapter — id/url handling", () => {
  it("accepts page slugs, rejects junk", () => {
    expect(
      vrboneAdapter.validateVideoId("ara-mix-splits-her-pussy-open")
    ).toBe(true);
    expect(vrboneAdapter.validateVideoId("")).toBe(false);
    expect(vrboneAdapter.validateVideoId("<script>")).toBe(false);
  });
  it("extracts slug from page urls, rejects foreign/deep paths", () => {
    expect(
      vrboneAdapter.videoIdFromUrl(
        "https://vrbone.com/ara-mix-splits-her-pussy-open/"
      )
    ).toBe("ara-mix-splits-her-pussy-open");
    expect(vrboneAdapter.videoIdFromUrl("https://evil.com/abc-def/")).toBeNull();
    expect(
      vrboneAdapter.videoIdFromUrl("https://vrbone.com/category/anal/")
    ).toBeNull();
  });
  it("has no embeddable url", () => {
    expect(vrboneAdapter.embedUrlFor("x")).toBe("");
    expect(vrboneAdapter.validateEmbedUrl("https://vrbone.com/x/")).toBe(false);
  });
});

describe("vrbone adapter — video page parsing", () => {
  const rec = vrboneAdapter.parseDumpRow(pageHtml);

  it("parses a real video page", () => {
    expect(rec).not.toBeNull();
    expect(rec!.providerVideoId).toBe(
      "ara-mix-splits-her-pussy-open-with-a-large-dildo"
    );
    expect(rec!.title).toBe("Ara Mix Splits Her Pussy Open With A Large Dildo");
    expect(rec!.mediaUrl).toBe("https://vrbone.com/t/32878/");
    expect(rec!.vrMode).toBe("sbs180");
    expect(rec!.durationSeconds).toBe(1237);
    expect(rec!.publishedAt?.toISOString()).toBe("2026-10-10T04:00:00.000Z");
    expect(rec!.categories).toEqual(["Virtual Reality"]);
    expect(rec!.tags).toContain("vr");
    expect(rec!.tags).toContain("suck me vr");
    expect(rec!.sourceUrl).toBe(
      "https://vrbone.com/ara-mix-splits-her-pussy-open-with-a-large-dildo/"
    );
    expect(rec!.thumbnailUrl).toMatch(/^https:\/\/vrbone\.b-cdn\.net\//);
    expect(rec!.embedUrl).toBeNull();
  });

  it("rejects pages without a VideoObject", () => {
    expect(vrboneAdapter.parseDumpRow("<html><body>404</body></html>")).toBeNull();
    expect(vrboneAdapter.parseDumpRow("")).toBeNull();
  });
});

describe("sitemap_html feed", () => {
  const index = `<?xml version="1.0"?><sitemapindex>
    <sitemap><loc>https://vrbone.com/sitemaps/pages.xml</loc></sitemap>
    <sitemap><loc>https://vrbone.com/sitemaps/videos-1.xml</loc></sitemap>
  </sitemapindex>`;
  const child = `<?xml version="1.0"?><urlset>
    <url><loc>https://vrbone.com/video-a/</loc></url>
    <url><loc>https://vrbone.com/video-b/</loc></url>
    <url><loc>https://vrbone.com/video-a/</loc></url>
  </urlset>`;

  function fakeFetch(pages: Record<string, string>): typeof fetch {
    return ((url: unknown) => {
      const u = String(url);
      const body =
        u === "https://vrbone.com/sitemap.xml"
          ? index
          : u === "https://vrbone.com/sitemaps/videos-1.xml"
            ? child
            : pages[u];
      return Promise.resolve(
        body === undefined
          ? new Response("nf", { status: 404 })
          : new Response(body, { status: 200 })
      );
    }) as unknown as typeof fetch;
  }

  it("walks index → child sitemaps → page html, deduped", async () => {
    const pages = {
      "https://vrbone.com/video-a/": "<html>A</html>",
      "https://vrbone.com/video-b/": "<html>B</html>",
    };
    const got: string[] = [];
    for await (const line of streamFeedLines(
      { kind: "sitemap_html", url: "https://vrbone.com/sitemap.xml", role: "catalogue" },
      fakeFetch(pages)
    )) {
      got.push(line);
    }
    expect(got).toEqual(["<html>A</html>", "<html>B</html>"]);
  });
});
