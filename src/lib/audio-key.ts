// Content-addressed R2 key for a transcoded audio output.
//
//   key = sha256(source-identity + preset + q + codec)
//
// per canon/planning/2026-05-29-audio-worker-path.md. The source IDENTITY is
// the source URL — the stable name of the input. Content-addressing makes
// identical requests collapse to one stored artifact and non-identical
// requests miss and re-transcode, which is the storage-cost constraint in
// canon/values/project-goal.md (no predictive variants; pay once per distinct
// output). Pure function: crypto.subtle is available both in the Worker
// runtime and under bun, so this unit-tests without a Worker.

import type { ResolvedAudioOptions } from "./audio-options";

export async function computeAudioKey(
  sourceUrl: string,
  opts: ResolvedAudioOptions,
): Promise<string> {
  // Newline-joined so the fields can't run together ("voice" + "low" must not
  // collide with "voicelo" + "w", etc.).
  const identity = [sourceUrl, opts.preset, opts.q, opts.codec].join("\n");
  const bytes = new TextEncoder().encode(identity);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
