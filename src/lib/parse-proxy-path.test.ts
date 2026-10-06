import { describe, expect, test } from "bun:test";
import { normalizeProxyPath, parseProxyPath, ProxyPathError } from "./parse-proxy-path";
import { isApprovedVideoSource } from "./video";

describe("parseProxyPath — image", () => {
  test("parses bare image URL with no options", () => {
    const result = parseProxyPath("/image/https://example.com/photo.jpg");
    expect(result.mediaType).toBe("image");
    expect(result.options).toEqual({});
    expect(result.sourceUrl).toBe("https://example.com/photo.jpg");
  });

  test("parses image with all options", () => {
    const result = parseProxyPath(
      "/image/w=800,h=600,q=low,f=avif/https://example.com/photo.jpg",
    );
    expect(result.mediaType).toBe("image");
    expect(result.options).toEqual({ w: 800, h: 600, q: "low", f: "avif" });
    expect(result.sourceUrl).toBe("https://example.com/photo.jpg");
  });

  test("parses image with width only", () => {
    const result = parseProxyPath(
      "/image/w=800/https://example.com/photo.jpg",
    );
    expect(result.options).toEqual({ w: 800 });
  });

  test("parses image with shortest-side s only", () => {
    const result = parseProxyPath(
      "/image/s=720,q=low/https://example.com/photo.jpg",
    );
    expect(result.options).toEqual({ s: 720, q: "low" });
  });

  test("rejects invalid s", () => {
    expect(() =>
      parseProxyPath("/image/s=0/https://example.com/photo.jpg"),
    ).toThrow(ProxyPathError);
    expect(() =>
      parseProxyPath("/image/s=99999/https://example.com/photo.jpg"),
    ).toThrow(ProxyPathError);
  });

  test("handles options in any order", () => {
    const result = parseProxyPath(
      "/image/q=high,f=webp,w=1080/https://example.com/photo.jpg",
    );
    expect(result.options).toEqual({ w: 1080, q: "high", f: "webp" });
  });

  test("preserves source URL with query string", () => {
    const result = parseProxyPath(
      "/image/w=800/https://example.com/photo.jpg?v=2&size=large",
    );
    expect(result.sourceUrl).toBe(
      "https://example.com/photo.jpg?v=2&size=large",
    );
  });

  test("reattaches search portion when source URL has query string", () => {
    // When the browser receives /image/w=800/https://cdn.com/img.jpg?w=2000,
    // the URL parser splits pathname (/image/w=800/https://cdn.com/img.jpg)
    // from search (?w=2000). The proxy parser must reattach the search to the
    // source URL, not lose it.
    const result = parseProxyPath(
      "/image/w=800/https://cdn.com/img.jpg",
      "?w=2000",
    );
    expect(result.sourceUrl).toBe("https://cdn.com/img.jpg?w=2000");
  });

  test("preserves source URL with path segments", () => {
    const result = parseProxyPath(
      "/image/w=800/https://example.com/path/to/image.jpg",
    );
    expect(result.sourceUrl).toBe("https://example.com/path/to/image.jpg");
  });

  test("rejects invalid w value", () => {
    expect(() =>
      parseProxyPath("/image/w=99999/https://example.com/a.jpg"),
    ).toThrow(ProxyPathError);
    expect(() =>
      parseProxyPath("/image/w=-1/https://example.com/a.jpg"),
    ).toThrow(ProxyPathError);
    expect(() =>
      parseProxyPath("/image/w=abc/https://example.com/a.jpg"),
    ).toThrow(ProxyPathError);
  });

  test("rejects invalid q value", () => {
    expect(() =>
      parseProxyPath("/image/q=ultra/https://example.com/a.jpg"),
    ).toThrow(ProxyPathError);
  });

  test("rejects invalid f value", () => {
    expect(() =>
      parseProxyPath("/image/f=png/https://example.com/a.jpg"),
    ).toThrow(ProxyPathError);
  });
});

describe("parseProxyPath — audio", () => {
  test("parses bare audio URL with no options", () => {
    const result = parseProxyPath("/audio/https://example.com/sound.mp3");
    expect(result.mediaType).toBe("audio");
    expect(result.options).toEqual({});
  });

  test("parses audio with preset and q", () => {
    const result = parseProxyPath(
      "/audio/preset=voice,q=medium/https://example.com/sound.mp3",
    );
    expect(result.options).toEqual({ preset: "voice", q: "medium" });
  });
});

describe("parseProxyPath — errors", () => {
  test("rejects missing media_type", () => {
    expect(() => parseProxyPath("/")).toThrow(ProxyPathError);
  });

  test("rejects unknown media_type", () => {
    expect(() => parseProxyPath("/unknown/https://example.com/v.mp4")).toThrow(
      ProxyPathError,
    );
  });

  test("rejects path with no source URL", () => {
    expect(() => parseProxyPath("/image/w=800")).toThrow(ProxyPathError);
  });
});

// A relay that merges "//" turns .../https://host/... into .../https:/host/... .
// canon/planning/2026-10-06-proxy-path-normalization.md
describe("parseProxyPath — collapsed scheme slash (relay-merged //)", () => {
  const A13 = "https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4";
  const collapse = (path: string) => path.replace(/\/\//g, "/");
  const CANONICAL = [
    "/image/https://example.com/photo.jpg",
    "/image/s=320,q=low,f=webp/https://cdn.example/photo.jpg",
    "/image/w=800,h=600,q=high,f=avif/http://example.com/a/b/photo.jpg",
    "/audio/https://example.com/sound.mp3",
    "/audio/preset=voice,q=low,f=opus/https://cdn.example/clip.mp3",
    `/video/preset=fia,q=medium,f=mp4/${A13}`,
    `/video/preset=fia,q=medium,f=mp4,size=small/${A13}`,
    `/video/size=xsmall,preset=fia,q=medium,f=mp4/${A13}`,
    "/video/https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/other.mp4",
  ];

  test("collapsed form parses to exactly the canonical result (audio, video, image)", () => {
    for (const path of CANONICAL) {
      const collapsed = collapse(path);
      expect(collapsed).not.toBe(path);
      expect(normalizeProxyPath(collapsed)).toBe(path);
      for (const search of ["", "?w=2000&v=2"]) {
        expect(parseProxyPath(collapsed, search)).toEqual(parseProxyPath(path, search));
      }
    }
  });

  test("canonical paths are returned byte-identical and normalization is idempotent", () => {
    for (const path of CANONICAL) {
      expect(normalizeProxyPath(path)).toBe(path);
      expect(normalizeProxyPath(normalizeProxyPath(collapse(path)))).toBe(path);
    }
    // Any path that already holds a canonical scheme is untouched, even with a
    // single-slash scheme elsewhere in it.
    const mixed = "/image/w=800/https://cdn.example/redirect/https:/other.example/x.jpg";
    expect(normalizeProxyPath(mixed)).toBe(mixed);
    expect(parseProxyPath(mixed).sourceUrl).toBe("https://cdn.example/redirect/https:/other.example/x.jpg");
  });

  test("only the first segment-initial scheme is restored", () => {
    expect(normalizeProxyPath("/image/https:/cdn.example/a/https:/b.example/c.jpg")).toBe(
      "/image/https://cdn.example/a/https:/b.example/c.jpg",
    );
    // Not at a segment start: left alone, so the path stays unparseable.
    expect(normalizeProxyPath("/image/x=https:/cdn.example/a.jpg")).toBe("/image/x=https:/cdn.example/a.jpg");
    expect(() => parseProxyPath("/image/x=https:/cdn.example/a.jpg")).toThrow(ProxyPathError);
  });

  test("shapes that are not a single collapsed slash are not rewritten", () => {
    for (const path of [
      "/image/https:/",
      "/video/preset=fia,q=medium,f=mp4/https:%2F%2Fs3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
      "/video/preset=fia,q=medium,f=mp4/https:%2Fs3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
      "/video/preset=fia,q=medium,f=mp4/HTTPS:/s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
      "/video/preset=fia,q=medium,f=mp4/ftp:/s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
    ]) {
      expect(normalizeProxyPath(path)).toBe(path);
      expect(() => parseProxyPath(path)).toThrow(ProxyPathError);
    }
    // Triple slash already holds "https://": untouched, parsed as before.
    expect(normalizeProxyPath("/video/https:///x")).toBe("/video/https:///x");
    expect(parseProxyPath("/video/https:///x").sourceUrl).toBe("https:///x");
  });

  test("restored source URLs still face the same video host allowlist", () => {
    expect(isApprovedVideoSource(parseProxyPath(collapse(`/video/preset=fia,q=medium,f=mp4/${A13}`)).sourceUrl)).toBe(true);
    for (const tail of [
      "https:/evil.example/v.mp4",
      "https:/s3.amazonaws.com/cbbt-er.public/../x",
      "https:/s3.amazonaws.com/cbbt-er.public/%2e%2e/other/v.mp4",
      "https:///x",
      "https:///s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
      "https:/%2Fs3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
      "https:/s3.amazonaws.com%2Fcbbt-er.public/media/videos/a13/720p.mp4",
      "https:/s3.amazonaws.com/cbbt-er.public%2F..%2Fother/v.mp4",
      "https:/s3.amazonaws.com@evil.example/cbbt-er.public/v.mp4",
      "https:/user@s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
      "https:/s3.amazonaws.com.evil.example/cbbt-er.public/v.mp4",
      "http:/s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4",
      "https:/pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev.evil.test/v.mp4",
    ]) {
      const { sourceUrl } = parseProxyPath(`/video/preset=fia,q=medium,f=mp4/${tail}`);
      expect(isApprovedVideoSource(sourceUrl)).toBe(false);
    }
  });
});
