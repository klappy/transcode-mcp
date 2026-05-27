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
import { generateTranscodeUrl } from "./lib/generate-transcode-url";
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

function createServer() {
  const server = new McpServer({ name: "transcode-mcp", version: "0.2.0" });

  server.tool(
    "generate_transcode_url",
    {
      media_type: z.enum(["image", "audio"]),
      source_url: z.string().url(),
      w: z.number().int().positive().optional(),
      h: z.number().int().positive().optional(),
      q: z.enum(["low", "medium", "high"]).optional(),
      f: z.enum(["auto", "avif", "webp", "jpeg"]).optional(),
      preset: z.enum(["voice", "music"]).optional(),
    },
    async (args) => {
      const { media_type, source_url, ...rest } = args;
      let proxyPath: string;
      if (media_type === "image") {
        const options: Record<string, string | number> = {};
        if (rest.w !== undefined) options.w = rest.w;
        if (rest.h !== undefined) options.h = rest.h;
        if (rest.q !== undefined) options.q = rest.q;
        if (rest.f !== undefined) options.f = rest.f;
        proxyPath = generateTranscodeUrl({
          mediaType: "image",
          sourceUrl: source_url,
          options: options as any,
        });
      } else {
        const options: Record<string, string> = {};
        if (rest.preset !== undefined) options.preset = rest.preset;
        if (rest.q !== undefined) options.q = rest.q;
        proxyPath = generateTranscodeUrl({
          mediaType: "audio",
          sourceUrl: source_url,
          options: options as any,
        });
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ proxy_path: proxyPath }),
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
      const server = createServer();
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
    parsed = parseProxyPath(new URL(request.url).pathname);
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

    // Target width comes from options.w; if missing but h is given, derive
    // from source aspect ratio. If neither, just apply quality/format.
    let encodeW: number | undefined;
    let encodeH: number | undefined;
    let bindingResult = "none";

    if (options.w) {
      const targetW = options.w;
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
    parsed = parseProxyPath(new URL(request.url).pathname);
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
