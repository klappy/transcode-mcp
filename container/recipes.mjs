// Audio transcode recipes — DATA, not code branches. Adding or tuning a preset
// is editing this table, not changing server.mjs. Mirrors
// canon/planning/2026-05-27-audio-container-recipes.md.
//
// Slice 1 ships voice + opus only (three quality levels). aac/mp3 and the music
// presets are added in later slices by extending this table — the server logic
// stays codec-agnostic.
//
// Each recipe is the ffmpeg ARGUMENT LIST (no shell, so a source URL can never
// be interpreted as a flag), plus the output container extension and the
// response Content-Type. The args are verbatim from the canon recipe doc; the
// server fills only the -i <source> and the <output> path around them.

export const RECIPES = {
  opus: {
    // voice+low — 8k telephone-quality, opus voip application
    "voice:low": {
      args: [
        "-ac", "1",
        "-ar", "8000",
        "-c:a", "libopus",
        "-b:a", "8k",
        "-vbr", "on",
        "-application", "voip",
      ],
      ext: "opus",
      contentType: "audio/ogg",
    },
    // voice+medium — 16k clear speech, the default for voice on cheap phones
    "voice:medium": {
      args: [
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "libopus",
        "-b:a", "16k",
        "-vbr", "on",
        "-application", "audio",
      ],
      ext: "opus",
      contentType: "audio/ogg",
    },
    // voice+high — 32k high-quality voice, review/editing
    "voice:high": {
      args: [
        "-ac", "1",
        "-ar", "24000",
        "-c:a", "libopus",
        "-b:a", "32k",
        "-vbr", "on",
        "-application", "audio",
      ],
      ext: "opus",
      contentType: "audio/ogg",
    },
  },
};

// Resolve (codec, preset, q) to a recipe, or null if this deployment has no
// recipe for it (the Worker then passes the source through).
export function resolveRecipe(codec, preset, q) {
  const byCodec = RECIPES[codec];
  if (!byCodec) return null;
  return byCodec[`${preset}:${q}`] ?? null;
}
