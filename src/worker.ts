// src/worker.ts
// Proxy-first + lazy transcoding MCP server.
//
// URL vocabulary: canon/planning/2026-05-26-url-vocabulary-and-presets.md
// Boundary: canon/planning/2026-05-26-worker-container-boundary.md
// Encode arithmetic: canon/planning/2026-05-27-encode-resolution-arithmetic.md
//
// The Worker owns: URL parsing, half-class arithmetic, env.IMAGES binding
// calls, Cache API lookups, R2 dispatch for audio (deferred), demo page.
// The Worker does NOT own: ffmpeg flags, codec internals, perceptual judgments.

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseProxyPath, ProxyPathError } from "./lib/parse-proxy-path";
import { encodeDimension, QUALITY_MAP, type Quality } from "./lib/encode-dimension";
import { generateTranscodeUrl, shortestSideToWidth } from "./lib/generate-transcode-url";
import { DEMO_PAGE_HTML } from "./demo-page";

interface Env {
  IMAGES?: ImagesBinding;
}

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
      const mediaType = args.media_type ?? "image";
      const origin = new URL(request.url).origin;
      let proxyPath: string;
      let guidance: string;

      if (mediaType === "audio") {
        const options: Record<string, string> = {};
        if (args.preset !== undefined) options.preset = args.preset;
        if (args.q !== undefined) options.q = args.q;
        proxyPath = generateTranscodeUrl({
          mediaType: "audio",
          sourceUrl: args.source_url,
          options: options as any,
        });
        guidance =
          "Use this URL directly as an <audio> src. Audio is currently passthrough " +
          "(container transcoding is not yet deployed), so preset/q are recorded but " +
          "not yet applied.";
      } else {
        // Pure URL construction — no fetching, no client-side math. viewport is
        // emitted as s= (shortest side); the WORKER resolves it to the right
        // width from the source orientation at request time and applies the
        // half-class overshoot. w (if given) overrides viewport.
        const options: Record<string, string | number> = {};
        if (args.w !== undefined) {
          options.w = args.w;
        } else if (args.viewport !== undefined) {
          options.s = args.viewport;
        }
        if (args.h !== undefined) options.h = args.h;
        if (args.q !== undefined) options.q = args.q;
        if (args.f !== undefined) options.f = args.f;
        proxyPath = generateTranscodeUrl({
          mediaType: "image",
          sourceUrl: args.source_url,
          options: options as any,
        });
        guidance =
          "Drop this URL straight into an <img> src, or use it as the ?source= base " +
          "for your own integration (e.g. an Aquifer-style image window). The proxy " +
          "is stateless and cacheable: the same URL always returns the same bytes. " +
          "s= is the shortest side you intend to display at (stable across phone " +
          "rotation); the worker maps it to the correct width from the source's " +
          "orientation and encodes at ~1.5x (half-class overshoot) so the browser " +
          "downscale stays crisp. Change q=low|medium|high for the size/quality " +
          "tradeoff. You do not specify the encode resolution — the proxy computes it.";
      }

      const fullUrl = origin + proxyPath;
      const embed =
        mediaType === "audio"
          ? '<audio src="' + fullUrl + '" controls></audio>'
          : '<img src="' + fullUrl + '" alt="" loading="lazy">';

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                proxy_path: proxyPath,
                full_url: fullUrl,
                embed,
                request: {
                  media_type: mediaType,
                  source_url: args.source_url,
                  viewport: args.viewport ?? null,
                  q: args.q ?? "default",
                  f: args.f ?? "auto",
                },
                guidance,
              },
              null,
              2,
            ),
          },
        ],
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

    // Demo page (root + /demo)
    if (url.pathname === "/" || url.pathname === "/demo" || url.pathname === "/demo/") {
      return new Response(DEMO_PAGE_HTML, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Image proxy
    if (url.pathname.startsWith("/image/")) {
      return handleImageProxy(request, env, ctx);
    }

    // Audio proxy (still passthrough; container path is deferred)
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
  if (!options.w && !options.h && !options.q && !options.f) {
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

// Audio proxy — passthrough until Container is wired up.
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

  const sourceResponse = await fetch(parsed.sourceUrl);
  if (!sourceResponse.ok) {
    return new Response(`Source fetch failed: ${sourceResponse.status}`, {
      status: 502,
    });
  }

  return new Response(sourceResponse.body, {
    status: sourceResponse.status,
    headers: {
      "Content-Type":
        sourceResponse.headers.get("Content-Type") || "audio/mpeg",
      "X-Transcode-Cache": "PASS",
      "X-Transcode-Encode": "passthrough-pending-container",
    },
  });
}
