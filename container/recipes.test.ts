import { describe, expect, test } from "bun:test";
import { RECIPES, resolveRecipe } from "./recipes.mjs";

// Recipe resolution is DATA-driven; these tests pin the slice-1 voice/opus
// recipes to the numbers in
// canon/planning/2026-05-27-audio-container-recipes.md. The ffprobe evidence
// that the flags actually produce these characteristics lives in the PR
// (recipe Definition of Done); this test guards the table from drift.

describe("resolveRecipe — voice / opus (slice 1)", () => {
  test("voice:medium is the canon default: mono, 16kHz, 16k, opus audio app", () => {
    const r = resolveRecipe("opus", "voice", "medium");
    expect(r).not.toBeNull();
    expect(r.args).toEqual([
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libopus",
      "-b:a", "16k",
      "-vbr", "on",
      "-application", "audio",
    ]);
    expect(r.ext).toBe("opus");
    expect(r.contentType).toBe("audio/ogg");
  });

  test("voice:low uses the voip application at 8k / 8kHz", () => {
    const r = resolveRecipe("opus", "voice", "low");
    expect(r.args).toContain("voip");
    expect(r.args).toContain("8000");
    expect(r.args).toContain("8k");
  });

  test("voice:high is 32k at 24kHz", () => {
    const r = resolveRecipe("opus", "voice", "high");
    expect(r.args).toContain("24000");
    expect(r.args).toContain("32k");
  });

  test("all three voice recipes are mono libopus VBR", () => {
    for (const q of ["low", "medium", "high"]) {
      const r = resolveRecipe("opus", "voice", q);
      expect(r.args[r.args.indexOf("-ac") + 1]).toBe("1");
      expect(r.args).toContain("libopus");
      expect(r.args[r.args.indexOf("-vbr") + 1]).toBe("on");
    }
  });
});

describe("resolveRecipe — unimplemented combinations resolve to null", () => {
  test("aac/mp3 have no recipe in slice 1 (worker passes through)", () => {
    expect(resolveRecipe("aac", "voice", "medium")).toBeNull();
    expect(resolveRecipe("mp3", "voice", "medium")).toBeNull();
  });
  test("music has no recipe in slice 1", () => {
    expect(resolveRecipe("opus", "music", "low")).toBeNull();
  });
  test("opus codec table exists and holds exactly the three voice presets", () => {
    expect(Object.keys(RECIPES.opus).sort()).toEqual([
      "voice:high",
      "voice:low",
      "voice:medium",
    ]);
  });
});
