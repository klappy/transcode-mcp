import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import worker from "./worker";
import { normalizeProxyPath, parseProxyPath } from "./lib/parse-proxy-path";
import { handleVideoProxy, selectCatalogVideoContract, selectVideoContract, videoContracts, videoKey, videoSlot, VIDEO_SOURCE_REJECTION } from "./lib/video";
import { LEGACY_PINS, legacyPinFor, clearLegacyPinVerification } from "./lib/video-published-pins";
import { computeAudioKey } from "./lib/audio-key";
import { resolveAudioOptions } from "./lib/audio-options";

// Relay-collapsed proxy paths (.../https:/host/...) must behave exactly like the
// canonical path: same parse, same allowlist, same legacy pin, same cache keys,
// same bytes. canon/planning/2026-10-06-proxy-path-normalization.md

const ORIGIN = "https://proxy.example";
const VIDEO = "/video/preset=fia,q=medium,f=mp4";
const A13 = "https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4";
const A11 = "https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4";
const JORDAN = "https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4";
const collapse = (path: string) => path.replace(/\/\//g, "/");
const videoPath = (url: string, size?: string) => `${VIDEO}${size ? ",size=" + size : ""}/${url}`;
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const ctx = (pending: Promise<unknown>[] = []) => ({ waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} }) as unknown as ExecutionContext;

let realFetch: typeof globalThis.fetch;
let realCaches: unknown;
let realError: typeof console.error;
let realWarn: typeof console.warn;
beforeEach(() => {
  realFetch = globalThis.fetch;
  realCaches = (globalThis as any).caches;
  realError = console.error;
  realWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  clearLegacyPinVerification();
  // No source is ever fetched by the Worker on these paths unless a test says so.
  (globalThis as any).fetch = async () => { throw Error("unexpected source fetch"); };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  (globalThis as any).caches = realCaches;
  console.error = realError;
  console.warn = realWarn;
});

// Recorded from origin/main c6f3b02 (before this change) with videoKey('a'*64)
// and the production pool size (5): [url, size, sha256(contract JSON), videoKey, videoSlot].
const MAIN_ROWS: [string, string, string, string, string][] = [
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", "xsmall", "481669c64e3b79e4443c7578a324eebf0b9d69bb33e1f1447258e2a6af68512a", "video-v1/67d8fae805367eca98eac14afc0070b4d0ee936a9c5b6746106b2cce2366626b.mp4", "instance-2"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", "small", "fdabca9e0b58a54fc897a19aa82576d7c8c60ca71a842df1ea6b4a6381d14d4a", "video-v1/8f320c587e2fe7b15a5e6126a517bdd618196869f1ca746c1fc41e9e1f5d210e.mp4", "instance-4"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", "medium", "1d8d544906dd32db6539f872ae1dac53d249eec477f931610c4e72b3c4fef2b2", "video-v1/5062d269a868a33a641d0b4543f31f6f07aae2c26e5a13574e4c4aaf9b29c01b.mp4", "instance-2"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", "large", "e76e4392aac2cd93ec860f1e2336b65d2924e9db761c5cc73bf7169cc286e1f9", "video-v1/c0e2de33e0b8529b0fbcb058009eac6fb77044594b7d5f1267ae1df8196a700c.mp4", "instance-4"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4", "xsmall", "dfced35f0373396cc0512dcd1ad7c5fbc07645b9064e155a22bbd4709737fb1c", "video-v1/56f27f70134b1d7c85b1716f810d2820282ebb6754b6f95e96393b90b1b76f69.mp4", "instance-0"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4", "small", "3641902ee7dc2536a61dde459b40a5bffe8d4d2b62735c44336d8cf769f5ec24", "video-v1/55d4b422ed06ba12cc6fd60bbfbe063796a854506655cfbc0ab64e29a91c4a0f.mp4", "instance-4"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4", "medium", "22853c0aa1c440da1cb399f73aaf5d734f110dcc39e980cc38717b6e66276a6a", "video-v1/06ec1309d1b3aeb7a83d51e44a166d83853889a575aa39a0b94e41126df6173d.mp4", "instance-2"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4", "large", "d97b4ff1959ccb50fc7f1c972ce46b0693b2f56fc61de79e2e58b892820579a7", "video-v1/35572b0820fa7d3bec6368d4a54e17e9ce324626b7dc646c97ea690afaf46e4f.mp4", "instance-0"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4", "xsmall", "11aba08bab20322cf093afc18ce164950293a4188062365f6349e19ce76823e4", "video-v1/e14909cd9907e7a5c199180fd2c493be3d9c3df8041392220df94e1afbf571b2.mp4", "instance-2"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4", "small", "98f1ab4364bc74830db00a31cacda94cfb1f0e8869c106d539fc37fe166cef35", "video-v1/8bb3e7df38b4c68760a64bf0a47377d2821ae0bd2fdb7a92787c889855afbe58.mp4", "instance-1"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4", "medium", "f0e2146a938a6e1453c76a80cd1e10effb9d495d59731c3f1878847a1a229140", "video-v1/61d931f93872e029220c3c1c0854a3639bad5543da41d5a4732a4c1ac459ba8c.mp4", "instance-2"],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4", "large", "8c428806479ae7a527db4b0716c8b63c63a725866a16b812ed52b0e74d194718", "video-v1/73bddb372280df023d305053126781461bb78ca2bd414bf021f67045403b11db.mp4", "instance-3"],
  ["https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4", "small", "778a1bb9668f03724a1c1c1a70d10ce3ca70e49ad6077aa845f4d2c868d2f73d", "video-v1/3d1572fa4d066c5964ba2beba3108ceff914f6ee7d81191cf560efed349c6a49.mp4", "instance-4"],
  ["https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4", "xlarge", "4d3acce7841eda98daccca59bfb63ca6ffed51ade1ff05a730ebf2983755cf81", "video-v1/b9400e3d196b66dd8f669f3aaec8378c9655c49b0cd1bcf80994d85dd5fcf2f3.mp4", "instance-0"],
];
// Recorded from origin/main c6f3b02: the three alpha.13 released identities.
const MAIN_PINS: [string, number, string, string[]][] = [
  [A13, 5508450, "7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15", ["video-reference-v1/7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15.mp4", "video-v1/31e8d813e2e6cc956e1b63403c9e10e455c87457252ff126d6e0e8a9c7b70745.mp4"]],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4", 3958360, "bb1e991a78c8bdf146599efc4170caee51b284e7bf48bc23e4a59754f8789d99", ["video-reference-v1/bb1e991a78c8bdf146599efc4170caee51b284e7bf48bc23e4a59754f8789d99.mp4", "video-v1/696209695af2e9509125149a57eafc45007f054300fa3aee0d071a2de9dd56dd.mp4"]],
  ["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4", 3814200, "077bef593feb976f8b18eaa01feb0e5fba7b0c805cff767d25732c06309daa92", ["video-reference-v1/077bef593feb976f8b18eaa01feb0e5fba7b0c805cff767d25732c06309daa92.mp4", "video-v1/8b9596bd18f58afad390947286a2724611ba032d81bb9e954e7a5856a173de60.mp4"]],
];

describe("identity vs origin/main — canonical and collapsed", () => {
  test("all 14 catalog rows keep their origin/main contract, videoKey and videoSlot through either path form", async () => {
    expect(MAIN_ROWS.length).toBe(14);
    expect(new Set(MAIN_ROWS.map(r => r[3])).size).toBe(14);
    for (const [url, size, contractSha, key, slot] of MAIN_ROWS) {
      const canonical = videoPath(url, size === "large" ? undefined : size);
      for (const path of [canonical, collapse(canonical)]) {
        const parsed = parseProxyPath(path, "");
        if (parsed.mediaType !== "video") throw Error("expected a video route");
        expect(parsed.sourceUrl).toBe(url);
        const contract = selectCatalogVideoContract(parsed.sourceUrl, parsed.options.size ?? "large");
        expect(contract).toBeDefined();
        expect(selectVideoContract(parsed.sourceUrl, parsed.options.size)).toBe(contract!);
        expect(sha256(JSON.stringify(contract))).toBe(contractSha);
        expect(await videoKey("a".repeat(64), contract!)).toBe(key);
        expect(await videoSlot(parsed.sourceUrl, 5, parsed.options.size)).toBe(slot);
      }
    }
  });

  test("the 3 alpha.13 legacy pins match identically for the collapsed released URL", () => {
    expect(Object.keys(LEGACY_PINS)).toEqual(MAIN_PINS.map(p => p[0]));
    for (const [url, bytes, sha, keys] of MAIN_PINS) {
      const canonical = videoPath(url);
      const pin = legacyPinFor(normalizeProxyPath(collapse(canonical)), "");
      expect(pin).toBe(LEGACY_PINS[url]);
      expect(legacyPinFor(canonical, "")).toBe(pin);
      expect([pin!.bytes, pin!.sha256, [...pin!.keys]]).toEqual([bytes, sha, keys]);
      // Only the released omitted-size form is pinned, collapsed or not.
      expect(legacyPinFor(normalizeProxyPath(collapse(videoPath(url, "large"))), "")).toBeUndefined();
    }
  });
});

// Worker -> container stub that runs the real delivery handler against an R2
// stand-in already holding every requested contract under its cache key.
async function videoHarness(entries: [string, string][]) {
  const REV = "c".repeat(64);
  const objects = new Map<string, { data: Uint8Array; customMetadata: Record<string, string> }>();
  for (const [url, size] of entries) {
    const contract = selectVideoContract(url, size)!;
    const data = new TextEncoder().encode(`bytes for ${url} at ${size}`);
    objects.set(await videoKey(REV, contract), {
      data,
      customMetadata: {
        sourceSha256: (contract.source as { sha256?: string }).sha256 ?? "d".repeat(64),
        sourceUrl: url, encoderRevision: REV, recipe: contract.recipe,
        bytes: String(data.length), sha256: sha256(data), width: "1280", height: "720",
      },
    });
  }
  const bucket = {
    head: async (k: string) => { const o = objects.get(k); return o ? { size: o.data.length, customMetadata: o.customMetadata } : null; },
    get: async (k: string) => { const o = objects.get(k); return o ? { body: new Response(o.data).body } : null; },
    put: async () => { throw Error("a HIT must not write"); },
  } as unknown as R2Bucket;
  const slots: string[] = [];
  const targets: string[] = [];
  const encodes: string[] = [];
  const instance = async () => ({
    fetch: async (r: Request) => {
      const u = new URL(r.url);
      if (u.pathname === "/video-info" || u.pathname === "/video-lazy-info") return Response.json({ revision: REV });
      encodes.push(u.pathname);
      return new Response("no encode on a HIT", { status: 500 });
    },
  });
  const AUDIO_CONTAINER = {
    idFromName: (name: string) => { slots.push(name); return name; },
    get: () => ({
      fetch: async (r: Request) => {
        targets.push(r.url);
        const u = new URL(r.url);
        return handleVideoProxy(r, bucket, instance, u.searchParams.get("source") || "", { size: u.searchParams.get("size") || "large" });
      },
    }),
  };
  return { env: { AUDIO_CONTAINER } as any, slots, targets, encodes };
}

describe("worker — collapsed URL serves the canonical identity", () => {
  test("video: every catalog row and lazy sources HIT the same key with byte-identical output", async () => {
    // Explicit sizes so no request takes the legacy-pin path (covered below).
    const entries: [string, string][] = [...MAIN_ROWS.map(([url, size]) => [url, size] as [string, string]), [A11, "medium"], [A11, "large"], [JORDAN, "large"]];
    const h = await videoHarness(entries);
    for (const [url, size] of entries) {
      const canonical = `${ORIGIN}${videoPath(url, size)}`;
      const collapsedUrl = `${ORIGIN}${collapse(videoPath(url, size))}`;
      expect(collapsedUrl).toContain("/https:/");
      const before = h.slots.length;
      const a = await worker.fetch(new Request(canonical), h.env, ctx());
      const b = await worker.fetch(new Request(collapsedUrl), h.env, ctx());
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(b.headers.get("X-Transcode-Cache")).toBe("HIT");
      expect([...b.headers]).toEqual([...a.headers]);
      expect(new Uint8Array(await b.arrayBuffer())).toEqual(new Uint8Array(await a.arrayBuffer()));
      // Same container slot and the same canonical source handed to it.
      expect(h.slots.slice(before)).toEqual([h.slots[before], h.slots[before]]);
      expect(h.slots[before]).toBe(await videoSlot(url, 5, size));
      expect(h.targets.at(-1)).toBe(h.targets.at(-2)!);
      expect(new URL(h.targets.at(-1)!).searchParams.get("source")).toBe(url);
    }
    expect(h.encodes).toEqual([]);
  });

  test("video: collapsed alpha.13 released URLs take the same pinned path as the canonical ones", async () => {
    for (const [url, , , keys] of MAIN_PINS) {
      const results = [];
      for (const path of [videoPath(url), collapse(videoPath(url))]) {
        const calls: string[] = [];
        const bucket = { head: async (k: string) => { calls.push("head " + k); return null; }, get: async (k: string) => { calls.push("get " + k); return null; } } as unknown as R2Bucket;
        const seen: string[] = [];
        const env = { AUDIO_BUCKET: bucket, AUDIO_CONTAINER: { idFromName: (n: string) => n, get: () => ({ fetch: async (r: Request) => { seen.push(r.url); return new Response(new Uint8Array(10)); } }) } };
        const r = await worker.fetch(new Request(ORIGIN + path, { headers: { Range: "bytes=0-1" } }), env as any, ctx());
        results.push({ status: r.status, headers: [...r.headers], body: await r.text(), calls, seen });
      }
      expect(results[0].headers.find(([k]) => k === "x-transcode-pinned")?.[1]).toBe("legacy-alpha13");
      expect(results[0].calls).toEqual(keys.map(k => "head " + k));
      expect(new URL(results[0].seen[0]).searchParams.get("source")).toBe(url);
      expect(results[1]).toEqual(results[0]);
    }
  });

  test("image: a collapsed request reads and writes the canonical cache entry", async () => {
    const store = new Map<string, Response>();
    (globalThis as any).caches = { default: {
      match: async (req: Request) => store.get(req.url)?.clone(),
      put: async (req: Request, resp: Response) => { store.set(req.url, resp.clone()); },
    } };
    const canonical = `${ORIGIN}/image/s=320,q=low,f=webp/https://cdn.example/photo.jpg?v=2`;
    const collapsedUrl = `${ORIGIN}/image/s=320,q=low,f=webp/https:/cdn.example/photo.jpg?v=2`;
    const sources: string[] = [];
    (globalThis as any).fetch = async (u: string) => { sources.push(u); return new Response(new Uint8Array(500), { headers: { "Content-Length": "500" } }); };
    const encoded = new Uint8Array([7, 7, 7]);
    const env = { IMAGES: {
      info: async () => ({ width: 1000, height: 800, format: "image/jpeg", fileSize: 500 }),
      input: () => { const t: any = { transform: () => t, output: async () => ({ response: () => new Response(encoded), contentType: () => "image/webp", image: () => new Response(encoded).body }) }; return t; },
    } };
    // MISS through the collapsed form stores under the canonical key...
    const pending: Promise<unknown>[] = [];
    const miss = await worker.fetch(new Request(collapsedUrl), env as any, ctx(pending));
    await Promise.all(pending);
    expect(miss.headers.get("X-Transcode-Cache")).toBe("MISS");
    expect(sources).toEqual(["https://cdn.example/photo.jpg?v=2"]);
    expect([...store.keys()]).toEqual([canonical]);
    // ...and both forms then HIT it with identical bytes, without a source fetch.
    (globalThis as any).fetch = async () => { throw Error("a HIT must not fetch"); };
    const hitA = await worker.fetch(new Request(canonical), env as any, ctx());
    const hitB = await worker.fetch(new Request(collapsedUrl), env as any, ctx());
    expect([hitA.headers.get("X-Transcode-Cache"), hitB.headers.get("X-Transcode-Cache")]).toEqual(["HIT", "HIT"]);
    expect([...hitB.headers]).toEqual([...hitA.headers]);
    expect(new Uint8Array(await hitB.arrayBuffer())).toEqual(encoded);
    expect(new Uint8Array(await hitA.arrayBuffer())).toEqual(encoded);
  });

  test("audio: a collapsed request HITs the canonical R2 key", async () => {
    const source = "https://cdn.example/clip.mp3";
    const options = { preset: "voice", q: "low", f: "opus" } as const;
    const objectKey = `${await computeAudioKey(source, resolveAudioOptions(options))}.opus`;
    const data = new Uint8Array([1, 2, 3, 4]);
    const gets: string[] = [];
    const env = {
      AUDIO_BUCKET: { get: async (k: string) => { gets.push(k); return k === objectKey ? { size: data.length, body: new Response(data).body, customMetadata: { contentType: "audio/ogg", sourceBytes: "99" } } : null; } },
      AUDIO_CONTAINER: { get() { throw Error("a HIT must not reach the container"); } },
    };
    const path = `/audio/preset=voice,q=low,f=opus/${source}`;
    const a = await worker.fetch(new Request(ORIGIN + path), env as any, ctx());
    const b = await worker.fetch(new Request(ORIGIN + collapse(path)), env as any, ctx());
    expect(gets).toEqual([objectKey, objectKey]);
    expect([a.headers.get("X-Transcode-Cache"), b.headers.get("X-Transcode-Cache")]).toEqual(["HIT", "HIT"]);
    expect([...b.headers]).toEqual([...a.headers]);
    expect(new Uint8Array(await b.arrayBuffer())).toEqual(data);
  });
});

describe("worker — the host allowlist cannot be bypassed through normalization", () => {
  const BYPASS: [string, number][] = [
    ["https:/evil.example/v.mp4", 403],
    ["https:/s3.amazonaws.com/cbbt-er.public/../x", 403],
    ["https:/s3.amazonaws.com/cbbt-er.public/%2e%2e/other/v.mp4", 403],
    ["https:///x", 403],
    ["https:///s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 403],
    ["https:/%2Fs3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 403],
    ["https:%2F%2Fs3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 400],
    ["https:%2F/s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 400],
    ["https:%2Fs3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 400],
    ["https:/s3.amazonaws.com%2Fcbbt-er.public/media/videos/a13/720p.mp4", 403],
    ["https:/s3.amazonaws.com/cbbt-er.public%2F..%2Fother/v.mp4", 403],
    ["https:/s3.amazonaws.com@evil.example/cbbt-er.public/v.mp4", 403],
    ["https:/user@s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 403],
    ["https:/s3.amazonaws.com.evil.example/cbbt-er.public/v.mp4", 403],
    ["http:/s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 403],
    ["https:/pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev.evil.test/v.mp4", 403],
    ["HTTPS:/s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4", 400],
  ];
  test("each variant is rejected before any container or source is touched, and the rejection carries CORS", async () => {
    let touched = 0;
    const env = { AUDIO_BUCKET: { head: async () => { touched++; return null; } }, AUDIO_CONTAINER: { idFromName: () => { touched++; throw Error("no"); }, get: () => { touched++; throw Error("no"); } } };
    for (const [tail, status] of BYPASS) {
      for (const size of [undefined, "small"]) {
        const r = await worker.fetch(new Request(`${ORIGIN}${videoPath(tail, size)}`), env as any, ctx());
        expect([tail, r.status]).toEqual([tail, status]);
        expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
        if (status === 403) expect(await r.text()).toBe(VIDEO_SOURCE_REJECTION);
      }
    }
    expect(touched).toBe(0);
  });
});
