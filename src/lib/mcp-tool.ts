// Pure builders for the generate_transcode_url MCP tool's response.
// Kept out of worker.ts so they can be unit-tested without invoking the
// MCP SDK or constructing a Request. The worker calls these and wraps the
// result in the SDK's { content: [{ type, text }] } envelope.

import { generateTranscodeUrl } from "./generate-transcode-url";

export type Quality = "low" | "medium" | "high";
export type ImageFormat = "auto" | "webp" | "jpeg";
export type AudioPreset = "voice" | "music";
export type AudioCodec = "opus" | "aac" | "mp3";

export interface ToolArgs {
  source_url: string;
  media_type?: "image" | "audio";
  viewport?: number;
  q?: Quality;
  // f is image format when media_type=image, audio codec when media_type=audio.
  // The two vocabularies do not overlap so a single arg is unambiguous in
  // context. See canon/planning/2026-05-29-audio-worker-path.md.
  f?: ImageFormat | AudioCodec;
  w?: number;
  h?: number;
  preset?: AudioPreset;
}

export interface ToolResponse {
  proxy_path: string;
  full_url: string;
  embed: string;
  request: {
    media_type: "image" | "audio";
    source_url: string;
    viewport: number | null;
    q: Quality | "default";
    f: ImageFormat | AudioCodec;
  };
  guidance: string;
}

const IMAGE_GUIDANCE =
  "Drop this URL straight into an <img> src, or use it as the ?source= base " +
  "for your own integration (e.g. an Aquifer-style image window). The proxy " +
  "is stateless and cacheable: the same URL always returns the same bytes. " +
  "s= is the shortest side you intend to display at (stable across phone " +
  "rotation); the worker maps it to the correct width from the source's " +
  "orientation and encodes at ~1.5x (half-class overshoot) so the browser " +
  "downscale stays crisp. Change q=low|medium|high for the size/quality " +
  "tradeoff. You do not specify the encode resolution — the proxy computes it.";

const AUDIO_GUIDANCE =
  "Use this URL directly as an <audio> src. Voice + opus is transcoded via " +
  "the container; other preset/codec combinations currently passthrough " +
  "(safe degradation, never errors) until their recipes ship. Defaults are " +
  "preset=voice, q=medium, f=opus.";

// Builds the response payload for a generate_transcode_url tool call. Pure
// function: no network, no math beyond viewport->s mapping (which is the
// proxy's grammar, not new math). The worker passes its own origin in.
export function buildToolResponse(args: ToolArgs, origin: string): ToolResponse {
  const mediaType = args.media_type ?? "image";
  const cleanOrigin = origin.replace(/\/$/, "");

  let proxyPath: string;
  let guidance: string;

  if (mediaType === "audio") {
    const options: Record<string, string> = {};
    if (args.preset !== undefined) options.preset = args.preset;
    if (args.q !== undefined) options.q = args.q;
    if (args.f !== undefined) options.f = args.f;
    proxyPath = generateTranscodeUrl({
      mediaType: "audio",
      sourceUrl: args.source_url,
      // generateTranscodeUrl's AudioOptions type is narrow; cast is safe here
      // because we only forward the canonical keys.
      options: options as never,
    });
    guidance = AUDIO_GUIDANCE;
  } else {
    // Pure URL construction. viewport is emitted as s= (shortest side); the
    // WORKER resolves it to the right width from the source orientation at
    // request time and applies the half-class overshoot. w (if given) wins.
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
      options: options as never,
    });
    guidance = IMAGE_GUIDANCE;
  }

  const fullUrl = cleanOrigin + proxyPath;
  const embed =
    mediaType === "audio"
      ? '<audio src="' + fullUrl + '" controls></audio>'
      : '<img src="' + fullUrl + '" alt="" loading="lazy">';

  return {
    proxy_path: proxyPath,
    full_url: fullUrl,
    embed,
    request: {
      media_type: mediaType,
      source_url: args.source_url,
      viewport: args.viewport ?? null,
      q: args.q ?? "default",
      f: args.f ?? (mediaType === "audio" ? "opus" : "auto"),
    },
    guidance,
  };
}
