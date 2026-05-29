// src/worker.ts
// Proxy-first + lazy transcoding MCP server.
//
// URL vocabulary: canon/planning/2026-05-26-url-vocabulary-and-presets.md
// Boundary: canon/planning/2026-05-26-worker-container-boundary.md
// Encode arithmetic: canon/planning/2026-05-27-encode-resolution-arithmetic.md
//
// The Worker owns: URL parsing, half-class arithmetic, env.IMAGES binding
// calls, Cache API lookups (images), R2 read/write + container dispatch for
// audio, demo page.
// The Worker does NOT own: ffmpeg flags, codec internals, perceptual judgments.

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Container, getRandom } from "@cloudflare/containers";
import { z } from "zod";
import { parseProxyPath, ProxyPathError } from "./lib/parse-proxy-path";
import { encodeDimension, QUALITY_MAP, type Quality } from "./lib/encode-dimension";
import { shortestSideToWidth } from "./lib/generate-transcode-url";
import {
  resolveAudioOptions,
  hasAudioOptions,
  isTranscodable,
  CODEC_DELIVERY,
} from "./lib/audio-options";
import { computeAudioKey } from "./lib/audio-key";
import { buildToolResponse } from "./lib/mcp-tool";
import { DEMO_PAGE_HTML } from "./demo-page";
import { DEMO_FILM_HTML } from "./demo-film";
import { DEMO_CASESTUDY_HTML } from "./demo-casestudy";
import { DEMO_AUDIOBENCH_HTML } from "./demo-audiobench";
import { ADMIN_PAGE_HTML } from "./admin-page";

interface Env {
  IMAGES?: ImagesBinding;
  // R2 cache for transcoded audio output (content-addressed, lazy writes).
  AUDIO_BUCKET?: R2Bucket;
  // Durable Object fronting the ffmpeg transcode Container.
  AUDIO_CONTAINER?: DurableObjectNamespace<AudioContainer>;
}

// Durable Object that fronts the audio transcode Container. It owns only
// lifecycle (port + idle sleep); ffmpeg, the recipe table, and source fetching
// all live INSIDE the container image (container/). The Worker never sees an
// ffmpeg flag — that is the worker/container boundary
// (canon/planning/2026-05-26-worker-container-boundary.md).
export class AudioContainer extends Container<Env> {
  defaultPort = 8080; // the container HTTP server listens here
  sleepAfter = "10m"; // stop the instance after 10m idle to bound cost
}

// Size of the AudioContainer pool getRandom selects across. MUST match
// `max_instances` for the [[containers]] block in wrangler.toml — if this
// exceeds the cap, getRandom can pick instances that fail to start (forcing
// the passthrough fallback); if it's smaller, provisioned capacity sits idle.
const AUDIO_CONTAINER_INSTANCES = 5;

// Cloudflare Images binding type (minimal shape we use)
interface ImagesBinding {
  info(stream: ReadableStream): Promise<{ width: number; height: number; format: string; fileSize: number }>;
  input(stream: ReadableStream): ImagesTransformer;
}

interface ImagesTransformer {
  transform(opts: { width?: number; height?: number; quality?: number; fit?: string }): ImagesTransformer;
  output(opts: { format: string; quality?: number }): Promise<ImagesResult>;
}

interface ImagesResult {
  response(): Response;
  contentType(): string;
  image(): ReadableStream;
}

function createServer(request: Request) {
  const server = new McpServer({ name: "transcode-mcp", version: "0.3.0" });

  server.tool(
    "generate_transcode_url",
    {
      source_url: z.string().url().describe("The image (or audio) URL to serve through the proxy."),
      media_type: z.enum(["image", "audio"]).optional().describe("Defaults to image."),
      // Primary image input: the shortest-side display size. Stable across
      // phone rotation, which is why it's preferred over a literal width.
      viewport: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "PRIMARY for images: the shortest-side display size in CSS px you intend to show the image at (e.g. 320 thumbnail, 1080 hero). Emitted as s= so the proxy binds the shortest side regardless of orientation — the stable 'resolution class' even when a phone rotates. Prefer this over w/h.",
        ),
      q: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Quality preset: low=20, medium=50, high=80. With the half-class overshoot, even low looks good. Defaults to the proxy default (medium)."),
      f: z
        .enum(["auto", "webp", "jpeg"])
        .optional()
        .describe("Output format. auto lets the proxy pick; webp is smallest; jpeg is universal."),
      // Advanced escape hatch — raw pixel control. w wins over viewport.
      w: z.number().int().positive().optional().describe("ADVANCED: raw output width in px. Overrides viewport. Most callers should use viewport."),
      h: z.number().int().positive().optional().describe("ADVANCED: raw output height in px. Rarely needed."),
      preset: z.enum(["voice", "music"]).optional().describe("Audio only: encoding preset."),
    },
    (args) => {
      const origin = new URL(request.url).origin;
      const response = buildToolResponse(args, origin);
      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    },
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // MCP endpoint
    if (url.pathname.startsWith("/mcp")) {
      const server = createServer(request);
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    // Demo pages. Three audience-specific pages, each its own HTML string:
    //   /         + /film   -> the scroll film (default landing)
    //   /bench              -> the measurement bench (formerly served at /)
    //   /casestudy          -> the storage case study
    // See canon/planning/2026-05-29-demo-spa-routing.md.
    const htmlResponse = (body: string) =>
      new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });

    if (url.pathname === "/" || url.pathname === "/film" || url.pathname === "/film/") {
      return htmlResponse(DEMO_FILM_HTML);
    }
    if (url.pathname === "/bench" || url.pathname === "/bench/") {
      return htmlResponse(DEMO_PAGE_HTML);
    }
    if (url.pathname === "/bench/audio" || url.pathname === "/bench/audio/") {
      return htmlResponse(DEMO_AUDIOBENCH_HTML);
    }
    if (url.pathname === "/casestudy" || url.pathname === "/casestudy/") {
      return htmlResponse(DEMO_CASESTUDY_HTML);
    }

    // Admin dashboard. Worker serves the HTML unconditionally; Cloudflare
    // Access policy at the edge gates who can reach this route. Pattern per
    // canon/planning/2026-05-29-media-pricing-model.md §Decision row
    // "Admin authentication is Cloudflare Access at the edge".
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return htmlResponse(ADMIN_PAGE_HTML);
    }

    // Image proxy
    if (url.pathname.startsWith("/image/")) {
      return handleImageProxy(request, env, ctx);
    }

    // Audio proxy (lazy transcode via Container + R2; passthrough fallback)
    if (url.pathname.startsWith("/audio/")) {
      return handleAudioProxy(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};

// Image proxy with half-class overshoot via env.IMAGES binding.
// On a binding miss (local dev or missing config), falls back to passthrough.
async function handleImageProxy(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let parsed;
  try {
    const requestUrl = new URL(request.url);
    parsed = parseProxyPath(requestUrl.pathname, requestUrl.search);
  } catch (err) {
    if (err instanceof ProxyPathError) {
      return new Response(err.message, { status: err.status });
    }
    return new Response("Bad request", { status: 400 });
  }

  if (parsed.mediaType !== "image") {
    return new Response("Not an image route", { status: 404 });
  }

  const { sourceUrl, options } = parsed;

  // Cache lookup: deterministic key from the full request URL (URL is the API)
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Transcode-Cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  // Fetch source
  const sourceResponse = await fetch(sourceUrl, {
    headers: { Accept: "image/avif,image/webp,image/*,*/*" },
  });
  if (!sourceResponse.ok) {
    return new Response(`Source fetch failed: ${sourceResponse.status}`, {
      status: 502,
    });
  }
  if (!sourceResponse.body) {
    return new Response("Source has no body", { status: 502 });
  }

  // If no transform options given, return passthrough
  if (!options.w && !options.h && !options.q && !options.f && !options.s) {
    return new Response(sourceResponse.body, {
      status: 200,
      headers: {
        "Content-Type": sourceResponse.headers.get("Content-Type") || "image/jpeg",
        "X-Transcode-Cache": "PASS",
        "X-Transcode-Encode": "passthrough",
      },
    });
  }

  // If no IMAGES binding (local dev or unconfigured), fall back to passthrough
  if (!env.IMAGES) {
    return new Response(sourceResponse.body, {
      status: 200,
      headers: {
        "Content-Type": sourceResponse.headers.get("Content-Type") || "image/jpeg",
        "X-Transcode-Cache": "MISS",
        "X-Transcode-Encode": "no-binding",
      },
    });
  }

  try {
    // Tee the body: one for info(), one for input()
    const [bodyForInfo, bodyForInput] = sourceResponse.body.tee();

    const info = await env.IMAGES.info(bodyForInfo);
    const sourceW = info.width;
    const sourceH = info.height;

    // Resolve the target width. Precedence: explicit w (advanced escape hatch)
    // wins; otherwise s (shortest side) maps to a width using the MEASURED
    // source orientation. s is the stable "resolution class" across phone
    // rotation — the worker does this mapping because only it knows the real
    // orientation at request time (the URL builder cannot without fetching):
    //   portrait/square (sourceW <= sourceH): shortest side IS the width  -> w = s
    //   landscape       (sourceW >  sourceH): shortest side is the height -> w = round(s * sourceW / sourceH)
    let targetW: number | undefined = options.w;
    if (targetW === undefined && options.s !== undefined) {
      targetW = shortestSideToWidth(options.s, sourceW, sourceH);
    }

    let encodeW: number | undefined;
    let encodeH: number | undefined;
    let bindingResult = "none";

    if (targetW) {
      const targetH = options.h;
      const result = encodeDimension({
        sourceW,
        sourceH,
        targetW,
        targetH,
      });
      encodeW = result.encodeW;
      encodeH = result.encodeH;
      bindingResult = result.binding;
    }

    const quality = options.q ? QUALITY_MAP[options.q as Quality] : 50;
    const format = pickFormat(options.f, request.headers.get("Accept"));

    let transformer = env.IMAGES.input(bodyForInput);
    if (encodeW) {
      transformer = transformer.transform({ width: encodeW, height: encodeH });
    }

    const out = await transformer.output({ format, quality });

    const responseHeaders = new Headers({
      "Content-Type": out.contentType(),
      "X-Transcode-Cache": "MISS",
      "X-Transcode-Source-W": String(sourceW),
      "X-Transcode-Source-H": String(sourceH),
      "X-Transcode-Encode-W": encodeW ? String(encodeW) : "auto",
      "X-Transcode-Encode-H": encodeH ? String(encodeH) : "auto",
      "X-Transcode-Binding": bindingResult,
      "X-Transcode-Quality": String(quality),
      "X-Transcode-Format": format,
      "Cache-Control": "public, max-age=31536000, immutable",
    });

    // Build the response and cache it
    const transformed = out.response();
    // We can't easily clone the binding's response, so re-read the body
    const buf = await transformed.arrayBuffer();
    const response = new Response(buf, { status: 200, headers: responseHeaders });

    // Cache asynchronously
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (err: any) {
    return new Response(`Transform failed: ${err?.message || "unknown"}`, {
      status: 500,
      headers: { "X-Transcode-Error": "true" },
    });
  }
}

function pickFormat(
  f: string | undefined,
  acceptHeader: string | null,
): string {
  if (f === "avif") return "image/avif";
  if (f === "webp") return "image/webp";
  if (f === "jpeg") return "image/jpeg";
  // auto
  const accept = acceptHeader || "";
  if (accept.includes("image/avif")) return "image/avif";
  if (accept.includes("image/webp")) return "image/webp";
  return "image/jpeg";
}

// Audio proxy — lazy transcode via Container + ffmpeg, cached in R2.
//
// Parity with the image path in COMPLETENESS and CALLER CONTRACT (lazy
// transcode, rich X-Transcode-* headers, passthrough fallbacks), NOT in
// mechanism: audio caches in R2 content-addressed because a container transcode
// is expensive enough to persist, where the image Cache API would re-run ffmpeg
// on eviction and pay the CPU twice. See
// canon/planning/2026-05-29-audio-worker-path.md.
//
// Boundary: the Worker owns the URL grammar, the cache key, and the R2
// read/write. The container takes (source_url, preset, q, codec), fetches the
// source itself, runs the recipe, and returns encoded bytes + ffprobe metadata.
// It stays cache- and credential-ignorant. The source is NOT pre-staged through
// the Worker/R2 (that would pay the source bytes twice).
async function handleAudioProxy(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let parsed;
  try {
    const requestUrl = new URL(request.url);
    parsed = parseProxyPath(requestUrl.pathname, requestUrl.search);
  } catch (err) {
    if (err instanceof ProxyPathError) {
      return new Response(err.message, { status: err.status });
    }
    return new Response("Bad request", { status: 400 });
  }

  if (parsed.mediaType !== "audio") {
    return new Response("Not an audio route", { status: 404 });
  }

  const { sourceUrl, options } = parsed;

  // No options at all -> passthrough, mirroring the image "no transform
  // options given" branch.
  if (!hasAudioOptions(options)) {
    return passthroughAudio(sourceUrl, { encode: "passthrough", cache: "PASS" });
  }

  const resolved = resolveAudioOptions(options);

  // No bindings (local dev / unconfigured) -> passthrough with no-binding,
  // exactly like the image path falls back without env.IMAGES. This keeps
  // `wrangler dev` usable without a container.
  if (!env.AUDIO_BUCKET || !env.AUDIO_CONTAINER) {
    return passthroughAudio(sourceUrl, { encode: "no-binding", cache: "MISS" });
  }

  // Codec/preset not wired in this deployment slice -> passthrough, never
  // error. Slice 1 ships voice + opus; everything else degrades gracefully.
  if (!isTranscodable(resolved)) {
    return passthroughAudio(sourceUrl, {
      encode: "passthrough",
      cache: "PASS",
      extra: {
        "X-Transcode-Reason": `not-implemented:${resolved.codec}+${resolved.preset}`,
        "X-Transcode-Preset": resolved.preset,
        "X-Transcode-Quality": resolved.q,
      },
    });
  }

  const delivery = CODEC_DELIVERY[resolved.codec];
  const key = await computeAudioKey(sourceUrl, resolved);
  const objectKey = `${key}.${delivery.ext}`;

  // R2 cache lookup (content-addressed). Hit -> stream stored bytes, rebuild
  // descriptive headers from the metadata captured at transcode time.
  const hit = await env.AUDIO_BUCKET.get(objectKey);
  if (hit) {
    const m = hit.customMetadata ?? {};
    return new Response(hit.body, {
      status: 200,
      headers: audioHeaders({
        cache: "HIT",
        encode: resolved.codec,
        preset: resolved.preset,
        q: resolved.q,
        contentType: m.contentType || delivery.contentType,
        bitrate: m.bitrate,
        sampleRate: m.sampleRate,
        channels: m.channels,
        sourceBytes: m.sourceBytes,
        outputBytes: String(hit.size),
      }),
    });
  }

  // Miss -> dispatch to the container. Transcoding is stateless (Worker owns
  // R2 read/write and the cache key), so route across the shared pool with
  // getRandom rather than pinning each unique output to its own instance —
  // otherwise a single concurrent burst of distinct keys would saturate
  // max_instances and force the catch-block passthrough fallback.
  let encoded: Response;
  try {
    const instance = await getRandom(env.AUDIO_CONTAINER, AUDIO_CONTAINER_INSTANCES);
    encoded = await instance.fetch(
      new Request("https://audio-container/transcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: sourceUrl,
          preset: resolved.preset,
          q: resolved.q,
          codec: resolved.codec,
        }),
      }),
    );
  } catch {
    // Container unreachable -> degrade to passthrough rather than erroring.
    return passthroughAudio(sourceUrl, {
      encode: "passthrough",
      cache: "MISS",
      extra: { "X-Transcode-Reason": "container-unreachable" },
    });
  }

  if (!encoded.ok || !encoded.body) {
    // Container refused (e.g. 422 no recipe) or errored -> passthrough.
    return passthroughAudio(sourceUrl, {
      encode: "passthrough",
      cache: "MISS",
      extra: { "X-Transcode-Reason": `container-status:${encoded.status}` },
    });
  }

  const buf = await encoded.arrayBuffer();
  const meta = {
    contentType: encoded.headers.get("Content-Type") || delivery.contentType,
    bitrate: encoded.headers.get("X-Audio-Bitrate") ?? "",
    sampleRate: encoded.headers.get("X-Audio-SampleRate") ?? "",
    channels: encoded.headers.get("X-Audio-Channels") ?? "",
    sourceBytes: encoded.headers.get("X-Source-Bytes") ?? "",
  };

  // Persist to R2 under ctx.waitUntil so the first caller isn't blocked on the
  // write. Metadata is stored so a later HIT can rebuild the same headers.
  ctx.waitUntil(
    env.AUDIO_BUCKET.put(objectKey, buf, {
      httpMetadata: {
        contentType: meta.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        contentType: meta.contentType,
        bitrate: meta.bitrate,
        sampleRate: meta.sampleRate,
        channels: meta.channels,
        sourceBytes: meta.sourceBytes,
        preset: resolved.preset,
        q: resolved.q,
        codec: resolved.codec,
      },
    }),
  );

  return new Response(buf, {
    status: 200,
    headers: audioHeaders({
      cache: "MISS",
      encode: resolved.codec,
      preset: resolved.preset,
      q: resolved.q,
      contentType: meta.contentType,
      bitrate: meta.bitrate,
      sampleRate: meta.sampleRate,
      channels: meta.channels,
      sourceBytes: meta.sourceBytes,
      outputBytes: String(buf.byteLength),
    }),
  });
}

// Passthrough fallback: fetch the source and hand it back unchanged. Used for
// the no-options, no-binding, not-implemented, and container-failure branches
// so audio NEVER errors on a path images would have degraded gracefully on.
async function passthroughAudio(
  sourceUrl: string,
  opts: {
    encode: "passthrough" | "no-binding";
    cache: "PASS" | "MISS";
    extra?: Record<string, string>;
  },
): Promise<Response> {
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    return new Response(`Source fetch failed: ${sourceResponse.status}`, {
      status: 502,
    });
  }
  const headers = new Headers({
    "Content-Type": sourceResponse.headers.get("Content-Type") || "audio/mpeg",
    "X-Transcode-Cache": opts.cache,
    "X-Transcode-Encode": opts.encode,
    ...(opts.extra ?? {}),
  });
  return new Response(sourceResponse.body, { status: 200, headers });
}

interface AudioHeaderParts {
  cache: "HIT" | "MISS";
  encode: string; // codec name on a real transcode
  preset: string;
  q: string;
  contentType: string;
  bitrate?: string;
  sampleRate?: string;
  channels?: string;
  sourceBytes?: string;
  outputBytes?: string;
}

// The descriptive header set for a transcoded (or cached) audio response. The
// ffprobe-derived fields (bitrate/sample-rate/channels) plus the byte counts
// are what let the demo and case study tell the byte-savings story, the audio
// analog of the image path's source/encode dimension headers.
function audioHeaders(p: AudioHeaderParts): Headers {
  const h = new Headers({
    "Content-Type": p.contentType,
    "X-Transcode-Cache": p.cache,
    "X-Transcode-Encode": p.encode,
    "X-Transcode-Preset": p.preset,
    "X-Transcode-Quality": p.q,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  if (p.bitrate) h.set("X-Transcode-Bitrate", p.bitrate);
  if (p.sampleRate) h.set("X-Transcode-SampleRate", p.sampleRate);
  if (p.channels) h.set("X-Transcode-Channels", p.channels);
  if (p.sourceBytes) h.set("X-Transcode-Source-Bytes", p.sourceBytes);
  if (p.outputBytes) h.set("X-Transcode-Output-Bytes", p.outputBytes);
  return h;
}
