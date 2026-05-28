import { describe, expect, test } from "bun:test";
import { parseProxyPath, ProxyPathError } from "./parse-proxy-path";

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
    expect(() => parseProxyPath("/video/https://example.com/v.mp4")).toThrow(
      ProxyPathError,
    );
  });

  test("rejects path with no source URL", () => {
    expect(() => parseProxyPath("/image/w=800")).toThrow(ProxyPathError);
  });
});
