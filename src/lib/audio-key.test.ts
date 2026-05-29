import { describe, expect, test } from "bun:test";
import { computeAudioKey } from "./audio-key";
import type { ResolvedAudioOptions } from "./audio-options";

const SRC = "https://cdn.example.com/gen-1-1-reading.mp3";
const BASE: ResolvedAudioOptions = { preset: "voice", q: "medium", codec: "opus" };

describe("computeAudioKey — determinism", () => {
  test("same inputs => same key (cache hits)", async () => {
    const a = await computeAudioKey(SRC, BASE);
    const b = await computeAudioKey(SRC, BASE);
    expect(a).toBe(b);
  });

  test("key is a 64-char lowercase hex sha256", async () => {
    const k = await computeAudioKey(SRC, BASE);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("computeAudioKey — every axis changes the key (cache misses)", () => {
  test("different source url", async () => {
    const a = await computeAudioKey(SRC, BASE);
    const b = await computeAudioKey(SRC + "?v=2", BASE);
    expect(a).not.toBe(b);
  });
  test("different preset", async () => {
    const a = await computeAudioKey(SRC, BASE);
    const b = await computeAudioKey(SRC, { ...BASE, preset: "music" });
    expect(a).not.toBe(b);
  });
  test("different quality", async () => {
    const a = await computeAudioKey(SRC, BASE);
    const b = await computeAudioKey(SRC, { ...BASE, q: "high" });
    expect(a).not.toBe(b);
  });
  test("different codec", async () => {
    const a = await computeAudioKey(SRC, BASE);
    const b = await computeAudioKey(SRC, { ...BASE, codec: "aac" });
    expect(a).not.toBe(b);
  });
});
