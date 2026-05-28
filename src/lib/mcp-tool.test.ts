import { describe, expect, test } from "bun:test";
import { buildToolResponse } from "./mcp-tool";

const ORIGIN = "https://transcode-mcp.klappy.workers.dev";
const SRC = "https://cdn.example.com/photo.jpg";

describe("buildToolResponse — image, viewport-primary", () => {
  test("viewport maps to s= (NOT w=)", () => {
    const r = buildToolResponse({ source_url: SRC, viewport: 720 }, ORIGIN);
    expect(r.proxy_path).toContain("s=720");
    expect(r.proxy_path).not.toContain("w=");
    expect(r.full_url).toBe(ORIGIN + r.proxy_path);
  });

  test("q and f flow through unchanged", () => {
    const r = buildToolResponse(
      { source_url: SRC, viewport: 320, q: "low", f: "webp" },
      ORIGIN,
    );
    expect(r.proxy_path).toContain("s=320");
    expect(r.proxy_path).toContain("q=low");
    expect(r.proxy_path).toContain("f=webp");
  });

  test("explicit w overrides viewport (escape hatch)", () => {
    const r = buildToolResponse(
      { source_url: SRC, viewport: 320, w: 1500 },
      ORIGIN,
    );
    expect(r.proxy_path).toContain("w=1500");
    expect(r.proxy_path).not.toContain("s=");
  });

  test("raw w with no viewport works (advanced caller)", () => {
    const r = buildToolResponse({ source_url: SRC, w: 1080 }, ORIGIN);
    expect(r.proxy_path).toContain("w=1080");
    expect(r.proxy_path).not.toContain("s=");
  });

  test("no sizing args → bare image path", () => {
    const r = buildToolResponse({ source_url: SRC }, ORIGIN);
    expect(r.proxy_path.startsWith("/image/")).toBe(true);
    expect(r.proxy_path).not.toContain("s=");
    expect(r.proxy_path).not.toContain("w=");
  });

  test("media_type defaults to image", () => {
    const r = buildToolResponse({ source_url: SRC, viewport: 720 }, ORIGIN);
    expect(r.request.media_type).toBe("image");
    expect(r.proxy_path.startsWith("/image/")).toBe(true);
  });
});

describe("buildToolResponse — response shape", () => {
  test("returns proxy_path, full_url, embed, request echo, guidance", () => {
    const r = buildToolResponse(
      { source_url: SRC, viewport: 720, q: "medium" },
      ORIGIN,
    );
    expect(typeof r.proxy_path).toBe("string");
    expect(r.full_url).toBe(ORIGIN + r.proxy_path);
    expect(r.embed).toContain("<img ");
    expect(r.embed).toContain('src="' + r.full_url + '"');
    expect(r.request.source_url).toBe(SRC);
    expect(r.request.viewport).toBe(720);
    expect(r.request.q).toBe("medium");
    expect(r.guidance.length).toBeGreaterThan(50);
    expect(r.guidance).toContain("s=");
  });

  test("audio embed wraps in <audio>", () => {
    const r = buildToolResponse(
      { source_url: SRC, media_type: "audio", preset: "voice" },
      ORIGIN,
    );
    expect(r.embed).toContain("<audio");
    expect(r.proxy_path.startsWith("/audio/")).toBe(true);
    expect(r.guidance).toContain("passthrough");
  });

  test("request echoes defaults when unset", () => {
    const r = buildToolResponse({ source_url: SRC, viewport: 320 }, ORIGIN);
    expect(r.request.q).toBe("default");
    expect(r.request.f).toBe("auto");
  });

  test("origin trailing slash is normalized", () => {
    const r = buildToolResponse(
      { source_url: SRC, viewport: 720 },
      ORIGIN + "/",
    );
    expect(r.full_url).toBe(ORIGIN + r.proxy_path);
    expect(r.full_url).not.toContain("//image");
  });

  test("guidance mentions overshoot and shortest-side semantics", () => {
    const r = buildToolResponse({ source_url: SRC, viewport: 720 }, ORIGIN);
    expect(r.guidance).toContain("overshoot");
    expect(r.guidance).toContain("shortest side");
  });
});

describe("buildToolResponse — audio passthrough", () => {
  test("preset and q both emitted", () => {
    const r = buildToolResponse(
      { source_url: SRC, media_type: "audio", preset: "music", q: "high" },
      ORIGIN,
    );
    expect(r.proxy_path).toContain("preset=music");
    expect(r.proxy_path).toContain("q=high");
    expect(r.request.media_type).toBe("audio");
  });
});
