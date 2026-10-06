import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import worker from "./worker";

// Savings-headers + CORS slice. Spec: canon/planning/2026-06-22-response-savings-headers.md.
// These tests assert the response contract under known inputs with no network:
// globalThis.fetch, globalThis.caches, and env.IMAGES are all mocked. The one
// claim a unit test cannot make in Bun is the literal Content-Length equality
// (Bun does not synthesize Content-Length for a fixed ArrayBuffer body), so the
// MISS test asserts the runtime-agnostic substance — X-Transcode-Encoded-Bytes
// equals the ACTUAL delivered body length — and the live `curl -I` smoke proves
// the literal Content-Length equality against the real Cloudflare runtime.

const PROXY_ORIGIN = "https://proxy.example";
const SOURCE = "https://cdn.example/photo.jpg";
const AUDIO_SOURCE = "https://cdn.example/clip.mp3";

let realFetch: typeof globalThis.fetch;
let realCaches: any;

// In-memory Cache API stand-in keyed by request URL.
function installCaches(): Map<string, Response> {
  const store = new Map<string, Response>();
  (globalThis as any).caches = {
    default: {
      async match(req: Request) {
        const hit = store.get(req.url);
        return hit ? hit.clone() : undefined;
      },
      async put(req: Request, resp: Response) {
        store.set(req.url, resp.clone());
      },
    },
  };
  return store;
}

// Mock upstream source fetch.
function installFetch(opts: {
  status?: number;
  body?: ArrayBuffer | null;
  headers?: Record<string, string>;
}) {
  (globalThis as any).fetch = async (): Promise<Response> => {
    const status = opts.status ?? 200;
    const body = status === 200 ? opts.body ?? new Uint8Array([0, 1, 2, 3]).buffer : null;
    return new Response(body, { status, headers: opts.headers ?? {} });
  };
}

function installFetchThrows() {
  (globalThis as any).fetch = async (): Promise<Response> => {
    throw new Error("fetch must not be called on a cache HIT");
  };
}

// Minimal env.IMAGES binding. info() reports a fixed fileSize; output() returns
// a fixed encoded buffer. The tee'd source streams are cancelled, not read.
function makeImages(opts: { fileSize: number; encoded: ArrayBuffer; contentType?: string }) {
  return {
    async info(_stream: ReadableStream) {
      return { width: 1000, height: 800, format: "image/jpeg", fileSize: opts.fileSize };
    },
    input(_stream: ReadableStream) {
      const transformer: any = {
        transform() { return transformer; },
        async output() {
          return {
            response() { return new Response(opts.encoded); },
            contentType() { return opts.contentType ?? "image/webp"; },
            image() { return new Response(opts.encoded).body!; },
          };
        },
      };
      return transformer;
    },
  };
}

function makeCtx(): ExecutionContext {
  return {
    waitUntil(_p: Promise<unknown>) { /* fire-and-forget in tests */ },
    passThroughOnException() { /* noop */ },
  } as unknown as ExecutionContext;
}

const EXPOSE_MUST_CONTAIN = [
  "Content-Length",
  "X-Transcode-Source-Bytes",
  "X-Transcode-Encoded-Bytes",
];

beforeEach(() => {
  realFetch = globalThis.fetch;
  realCaches = (globalThis as any).caches;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  (globalThis as any).caches = realCaches;
});

describe("transcode MISS — byte headers + CORS (criteria 1 & 2)", () => {
  const SOURCE_BYTES = 50_000;
  const ENCODED_BYTES = 8_000;

  test("emits integer source/encoded byte headers with encoded < source, encoded == delivered body length", async () => {
    installCaches();
    installFetch({
      headers: { "Content-Length": String(SOURCE_BYTES), "Content-Type": "image/jpeg" },
      body: new Uint8Array(SOURCE_BYTES).buffer,
    });
    const env = { IMAGES: makeImages({ fileSize: SOURCE_BYTES, encoded: new Uint8Array(ENCODED_BYTES).buffer }) };
    const url = `${PROXY_ORIGIN}/image/s=320,q=low,f=webp/${SOURCE}`;

    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.status).toBe(200);
    expect(resp.headers.get("X-Transcode-Cache")).toBe("MISS");

    const src = resp.headers.get("X-Transcode-Source-Bytes");
    const enc = resp.headers.get("X-Transcode-Encoded-Bytes");
    expect(src).toBe(String(SOURCE_BYTES));
    expect(enc).toBe(String(ENCODED_BYTES));
    expect(Number.isInteger(Number(src))).toBe(true);
    expect(Number.isInteger(Number(enc))).toBe(true);
    expect(Number(enc)).toBeLessThan(Number(src));

    // The disconfirmer, unit-layer: the reported encoded bytes is the size of
    // the buffer actually delivered as the body — not an internal buffer that
    // diverges from the wire. (Literal Content-Length equality is proven live.)
    const delivered = await resp.clone().arrayBuffer();
    expect(delivered.byteLength).toBe(Number(enc));
  });

  test("carries Access-Control-Allow-Origin:* and an expose list with both byte headers + Content-Length", async () => {
    installCaches();
    installFetch({
      headers: { "Content-Length": String(SOURCE_BYTES), "Content-Type": "image/jpeg" },
      body: new Uint8Array(SOURCE_BYTES).buffer,
    });
    const env = { IMAGES: makeImages({ fileSize: SOURCE_BYTES, encoded: new Uint8Array(ENCODED_BYTES).buffer }) };
    const url = `${PROXY_ORIGIN}/image/s=320,q=low,f=webp/${SOURCE}`;

    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const expose = resp.headers.get("Access-Control-Expose-Headers") || "";
    for (const h of EXPOSE_MUST_CONTAIN) expect(expose).toContain(h);
  });
});

describe("cache HIT — byte headers survive the stored entry (criterion 3)", () => {
  test("HIT replays stored byte headers and CORS without re-fetching", async () => {
    const store = installCaches();
    installFetchThrows(); // a HIT must not hit the network

    const url = `${PROXY_ORIGIN}/image/s=320,q=low,f=webp/${SOURCE}`;
    const cacheKeyUrl = new Request(url, { method: "GET" }).url;
    const stored = new Response(new Uint8Array(8_000).buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "X-Transcode-Cache": "MISS",
        "X-Transcode-Source-Bytes": "50000",
        "X-Transcode-Encoded-Bytes": "8000",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Length, X-Transcode-Source-Bytes, X-Transcode-Encoded-Bytes",
      },
    });
    store.set(cacheKeyUrl, stored);

    const env = { IMAGES: makeImages({ fileSize: 50_000, encoded: new Uint8Array(8_000).buffer }) };
    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.headers.get("X-Transcode-Cache")).toBe("HIT");
    expect(resp.headers.get("X-Transcode-Source-Bytes")).toBe("50000");
    expect(resp.headers.get("X-Transcode-Encoded-Bytes")).toBe("8000");
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("non-transcode paths — CORS + best-effort source bytes (criterion 4)", () => {
  const SOURCE_BYTES = 42_000;

  test("passthrough (no options) carries CORS and source bytes from upstream Content-Length", async () => {
    installCaches();
    installFetch({
      headers: { "Content-Length": String(SOURCE_BYTES), "Content-Type": "image/png" },
      body: new Uint8Array(SOURCE_BYTES).buffer,
    });
    const env = { IMAGES: makeImages({ fileSize: SOURCE_BYTES, encoded: new Uint8Array(1).buffer }) };
    const url = `${PROXY_ORIGIN}/image/${SOURCE}`;

    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.headers.get("X-Transcode-Cache")).toBe("PASS");
    expect(resp.headers.get("X-Transcode-Source-Bytes")).toBe(String(SOURCE_BYTES));
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(resp.headers.get("Access-Control-Expose-Headers") || "").toContain("X-Transcode-Source-Bytes");
  });

  test("no-binding (options present, env.IMAGES absent) carries CORS and source bytes", async () => {
    installCaches();
    installFetch({
      headers: { "Content-Length": String(SOURCE_BYTES), "Content-Type": "image/jpeg" },
      body: new Uint8Array(SOURCE_BYTES).buffer,
    });
    const env = {}; // no IMAGES binding
    const url = `${PROXY_ORIGIN}/image/s=320/${SOURCE}`;

    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.headers.get("X-Transcode-Cache")).toBe("MISS");
    expect(resp.headers.get("X-Transcode-Encode")).toBe("no-binding");
    expect(resp.headers.get("X-Transcode-Source-Bytes")).toBe(String(SOURCE_BYTES));
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("audio passthrough carries CORS and source bytes from upstream Content-Length", async () => {
    installCaches();
    installFetch({
      headers: { "Content-Length": String(SOURCE_BYTES), "Content-Type": "audio/mpeg" },
      body: new Uint8Array(SOURCE_BYTES).buffer,
    });
    const env = {};
    const url = `${PROXY_ORIGIN}/audio/${AUDIO_SOURCE}`;

    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.headers.get("X-Transcode-Cache")).toBe("PASS");
    expect(resp.headers.get("X-Transcode-Source-Bytes")).toBe(String(SOURCE_BYTES));
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("source bytes header is omitted when upstream sends no Content-Length", async () => {
    installCaches();
    installFetch({
      headers: { "Content-Type": "image/png" }, // no Content-Length
      body: new Uint8Array(100).buffer,
    });
    const env = {};
    const url = `${PROXY_ORIGIN}/image/${SOURCE}`;

    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.headers.get("X-Transcode-Cache")).toBe("PASS");
    expect(resp.headers.get("X-Transcode-Source-Bytes")).toBeNull();
    // CORS still present even with no source-bytes to report.
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("error responses carry CORS", () => {
  test("upstream 5xx source-fetch failure still carries CORS", async () => {
    installCaches();
    installFetch({ status: 404 });
    const env = { IMAGES: makeImages({ fileSize: 1, encoded: new Uint8Array(1).buffer }) };
    const url = `${PROXY_ORIGIN}/image/s=320/${SOURCE}`;

    const resp = await worker.fetch(new Request(url), env as any, makeCtx());

    expect(resp.status).toBe(502);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// Every Worker response carries CORS, so a browser reads the status and body of
// an error instead of "Failed to fetch". canon/planning/2026-10-06-proxy-path-normalization.md
describe("every response carries CORS (errors, 404s, 503s, preflight)", () => {
  const A13 = "https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4";
  const VIDEO = `${PROXY_ORIGIN}/video/preset=fia,q=medium,f=mp4`;
  const emptyR2 = { head: async () => null, get: async () => null } as unknown;
  const container = (fetch: (r: Request) => Promise<Response>) => ({ idFromName: (n: string) => n, get: () => ({ fetch }) });
  const immutable = (r: Response) => { Object.defineProperty(r.headers, "set", { value: () => { throw new TypeError("immutable headers"); } }); return r; };

  // Readable cross-origin: wildcard origin, never credentials, and every
  // X-Transcode-* header on the response is in its expose list.
  function expectReadable(resp: Response) {
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    const expose = (resp.headers.get("Access-Control-Expose-Headers") || "").toLowerCase().split(/\s*,\s*/);
    for (const [name] of resp.headers) if (name.toLowerCase().startsWith("x-transcode-")) expect(expose).toContain(name.toLowerCase());
  }

  const CASES: [string, () => Request, () => unknown, number, string?][] = [
    ["unknown route 404", () => new Request(`${PROXY_ORIGIN}/nope`), () => ({}), 404, "Not found"],
    ["unknown route HEAD 404", () => new Request(`${PROXY_ORIGIN}/nope`, { method: "HEAD" }), () => ({}), 404],
    ["unknown media type 404", () => new Request(`${PROXY_ORIGIN}/unknown/https://cdn.example/x`), () => ({}), 404],
    ["demo page", () => new Request(`${PROXY_ORIGIN}/`), () => ({}), 200],
    ["video bad options 400", () => new Request(`${PROXY_ORIGIN}/video/preset=fia,q=high,f=mp4/${A13}`), () => ({}), 400, "Invalid video request"],
    ["video no source 400 (encoded slashes)", () => new Request(`${VIDEO}/https:%2F%2Fs3.amazonaws.com/cbbt-er.public/x.mp4`), () => ({}), 400, "Invalid video request"],
    ["video rejected source 403", () => new Request(`${VIDEO}/https:/evil.example/v.mp4`), () => ({}), 403],
    ["video service unavailable 503", () => new Request(`${VIDEO},size=small/${A13}`), () => ({}), 503, "Video service unavailable"],
    ["pinned release bytes unavailable 503", () => new Request(`${VIDEO}/${A13}`), () => ({ AUDIO_BUCKET: emptyR2, AUDIO_CONTAINER: container(async () => new Response(new Uint8Array(10))) }), 503, "Pinned release bytes unavailable"],
    ["video container error without CORS 502", () => new Request(`${VIDEO},size=small/${A13}`), () => ({ AUDIO_CONTAINER: container(async () => new Response("upstream broke", { status: 502 })) }), 502, "upstream broke"],
    ["video container error with immutable headers 500", () => new Request(`${VIDEO},size=small/${A13}`), () => ({ AUDIO_CONTAINER: container(async () => immutable(new Response("sealed", { status: 500, headers: { "X-Transcode-Error": "true" } }))) }), 500, "sealed"],
    // The Durable Object call rejecting escapes the route; the envelope answers.
    ["video container rejects 500", () => new Request(`${VIDEO},size=small/${A13}`), () => ({ AUDIO_CONTAINER: container(async () => { throw Error("down"); }) }), 500, "Internal error"],
    ["image invalid option 400", () => new Request(`${PROXY_ORIGIN}/image/w=99999/${SOURCE}`), () => ({}), 400],
    ["reference unknown 404", () => new Request(`${PROXY_ORIGIN}/reference/video/nope`), () => ({}), 404],
  ];

  for (const [label, request, env, status, body] of CASES) {
    test(label, async () => {
      installCaches();
      installFetch({ status: 404 });
      const err = console.error; console.error = () => {};
      try {
        const resp = await worker.fetch(request(), env() as any, makeCtx());
        expect(resp.status).toBe(status);
        expectReadable(resp);
        if (body !== undefined) expect(await resp.text()).toBe(body);
      } finally { console.error = err; }
    });
  }

  test("an uncaught throw becomes a 500 that still carries CORS", async () => {
    (globalThis as any).caches = { default: { match: async () => { throw new Error("cache down"); } } };
    const err = console.error; console.error = () => {};
    try {
      const resp = await worker.fetch(new Request(`${PROXY_ORIGIN}/image/s=320/${SOURCE}`), {} as any, makeCtx());
      expect(resp.status).toBe(500);
      expectReadable(resp);
      expect(await resp.text()).toBe("Internal error");
    } finally { console.error = err; }
  });

  test("routes that own their CORS keep it unchanged", async () => {
    installCaches();
    const err = console.error; console.error = () => {};
    try {
      const pinned = await worker.fetch(new Request(`${VIDEO}/${A13}`), { AUDIO_BUCKET: emptyR2, AUDIO_CONTAINER: container(async () => new Response(new Uint8Array(10))) } as any, makeCtx());
      expect(pinned.headers.get("Access-Control-Expose-Headers")).toBe("Content-Length, Content-Range, Accept-Ranges, ETag, X-Transcode-Cache, X-Transcode-Encode, X-Transcode-Video-Width, X-Transcode-Video-Height, X-Transcode-Pinned");
      const ref = await worker.fetch(new Request(`${PROXY_ORIGIN}/reference/video/nope`), {} as any, makeCtx());
      expect(ref.headers.get("Access-Control-Expose-Headers")).toBe("Content-Length, Content-Range, Accept-Ranges, ETag, X-Reference-Expected-SHA256");
    } finally { console.error = err; }
  });

  test("OPTIONS preflight succeeds on every proxy route without touching the container", async () => {
    let touched = 0;
    const env = { AUDIO_BUCKET: { head: async () => { touched++; return null; } }, AUDIO_CONTAINER: { idFromName: () => { touched++; return ""; }, get: () => { touched++; throw Error("no"); } } };
    (globalThis as any).fetch = async () => { touched++; throw Error("no source fetch on preflight"); };
    const paths = [
      `/video/preset=fia,q=medium,f=mp4/${A13}`,
      `/video/preset=fia,q=medium,f=mp4,size=small/https:/s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4`,
      `/video/preset=fia,q=medium,f=mp4/https://evil.example/v.mp4`,
      `/image/s=320/${SOURCE}`,
      `/audio/preset=voice/${AUDIO_SOURCE}`,
      `/nope`,
    ];
    for (const path of paths) {
      const resp = await worker.fetch(new Request(PROXY_ORIGIN + path, { method: "OPTIONS", headers: { Origin: "https://app.example", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "range, x-persona" } }), env as any, makeCtx());
      expect(resp.status).toBe(204);
      expectReadable(resp);
      expect(resp.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD, OPTIONS");
      expect(resp.headers.get("Access-Control-Allow-Headers")).toBe("range, x-persona");
      expect(resp.body).toBeNull();
    }
    expect(touched).toBe(0);
    // Without (or with a malformed) request-headers list the preflight allows Range.
    for (const headers of [{}, { "Access-Control-Request-Headers": "range;evil" }] as Record<string, string>[]) {
      const resp = await worker.fetch(new Request(`${PROXY_ORIGIN}/image/${SOURCE}`, { method: "OPTIONS", headers }), {} as any, makeCtx());
      expect(resp.headers.get("Access-Control-Allow-Headers")).toBe("Range");
    }
  });
});
