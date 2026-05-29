// Audio option resolution + dispatch routing data. Pure functions, kept out of
// worker.ts so they unit-test without the MCP SDK, the Container helper, or a
// Request — same convention as mcp-tool.ts.
//
// The WORKER owns: the URL vocabulary, the option defaults, and which
// (codec, preset) combinations THIS deployment can dispatch. It does NOT own
// ffmpeg flags or what a preset *contains* — that is the Container's recipe
// table (container/recipes.mjs). See
// canon/planning/2026-05-26-worker-container-boundary.md.

import type { ParsedAudioRequest } from "./parse-proxy-path";

export type Quality = "low" | "medium" | "high";
export type AudioPreset = "voice" | "music";
export type AudioCodec = "opus" | "aac" | "mp3";

export interface ResolvedAudioOptions {
  preset: AudioPreset;
  q: Quality;
  codec: AudioCodec;
}

// Defaults per canon/planning/2026-05-29-audio-worker-path.md: preset=voice,
// q=medium, codec(f)=opus.
export const AUDIO_DEFAULTS: ResolvedAudioOptions = {
  preset: "voice",
  q: "medium",
  codec: "opus",
};

// Did the request carry ANY audio option? No options => passthrough, mirroring
// the image path's "no transform options given" branch.
export function hasAudioOptions(options: ParsedAudioRequest["options"]): boolean {
  return (
    options.preset !== undefined ||
    options.q !== undefined ||
    options.f !== undefined
  );
}

// Resolve a parsed audio request's options to a fully-specified triple. The
// resolved triple is what feeds the content-addressed cache key, so defaulting
// happens here, once, before the key is computed.
export function resolveAudioOptions(
  options: ParsedAudioRequest["options"],
): ResolvedAudioOptions {
  return {
    preset: options.preset ?? AUDIO_DEFAULTS.preset,
    q: options.q ?? AUDIO_DEFAULTS.q,
    codec: options.f ?? AUDIO_DEFAULTS.codec,
  };
}

// Dispatch routing DATA: which (codec -> presets) this deployment can actually
// transcode. Slice 1 wires voice + opus only; every other combination passes
// through (never errors) until a later slice adds its recipe to the Container.
// This is dispatch info, not recipe content: it tells the Worker whether to
// wake a container, so an unimplemented combo never pays cold-start just to be
// refused. Editing this table (data) is how a slice turns a passthrough into a
// transcode.
const TRANSCODABLE: Record<AudioCodec, readonly AudioPreset[]> = {
  opus: ["voice"], // slice 1
  aac: [], // slice 2
  mp3: [],
};

export function isTranscodable(r: ResolvedAudioOptions): boolean {
  return TRANSCODABLE[r.codec]?.includes(r.preset) ?? false;
}

// Delivery vocabulary (NOT ffmpeg flags): codec -> output container content
// type and file extension. Used for the response Content-Type and the R2
// object name. opus ships in an Ogg container; aac in MP4; mp3 in MPEG.
export const CODEC_DELIVERY: Record<
  AudioCodec,
  { contentType: string; ext: string }
> = {
  opus: { contentType: "audio/ogg", ext: "opus" },
  aac: { contentType: "audio/mp4", ext: "m4a" },
  mp3: { contentType: "audio/mpeg", ext: "mp3" },
};
