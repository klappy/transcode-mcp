import { describe, expect, test } from "bun:test";
import {
  encodeDimension,
  ceilToMod16,
  QUALITY_MAP,
} from "./encode-dimension";

describe("ceilToMod16", () => {
  test("aligns to mod-16 boundary, rounding up", () => {
    expect(ceilToMod16(1200)).toBe(1200);
    expect(ceilToMod16(1281)).toBe(1296);
    expect(ceilToMod16(900)).toBe(912);
    expect(ceilToMod16(13.5)).toBe(16);
    expect(ceilToMod16(16)).toBe(16);
    expect(ceilToMod16(17)).toBe(32);
  });
});

describe("encodeDimension — canon worked examples", () => {
  // From canon/planning/2026-05-27-encode-resolution-arithmetic.md

  test("Example 1: large source, small target (dominant case)", () => {
    const result = encodeDimension({
      sourceW: 4000,
      sourceH: 3000,
      targetW: 800,
      targetH: 600,
    });
    expect(result.encodeW).toBe(1200);
    expect(result.encodeH).toBe(912); // 1200 * 0.75 = 900, ceil_to_mod16 = 912
    expect(result.binding).toBe("target");
  });

  test("Example 2: source near target (modest downsample)", () => {
    const result = encodeDimension({
      sourceW: 850,
      sourceH: 640,
      targetW: 800,
      targetH: 600,
    });
    // Critical: source-as-ceiling framing would cap this at 850, defeating
    // the overshoot. Correct formula: target × 1.5 binds at 1200.
    expect(result.encodeW).toBe(1200);
    expect(result.binding).toBe("target");
  });

  test("Example 3: small source, large target", () => {
    const result = encodeDimension({
      sourceW: 400,
      sourceH: 300,
      targetW: 800,
      targetH: 600,
    });
    // source × 1.5 = 600, ceil_to_mod16 = 608
    expect(result.encodeW).toBe(608);
    expect(result.encodeH).toBe(464); // 608 * 0.75 = 456, ceil_to_mod16 = 464
    expect(result.binding).toBe("source");
  });

  test("Example 4: tiny source, large target (the cap's actual job)", () => {
    const result = encodeDimension({
      sourceW: 9,
      sourceH: 9,
      targetW: 1080,
      targetH: 1080,
    });
    // source × 1.5 = 13.5, ceil_to_mod16 = 16
    // Without the source × 1.5 cap, this would be 1620 — manufacturing
    // content from 81 pixels of signal.
    expect(result.encodeW).toBe(16);
    expect(result.encodeH).toBe(16);
    expect(result.binding).toBe("source");
  });
});

describe("encodeDimension — boundary behavior", () => {
  test("source equals target short-circuits", () => {
    const result = encodeDimension({
      sourceW: 800,
      sourceH: 600,
      targetW: 800,
      targetH: 600,
    });
    expect(result.encodeW).toBe(800);
    expect(result.encodeH).toBe(600);
    expect(result.binding).toBe("equal");
  });

  test("never produces encode smaller than would defeat the overshoot mechanism", () => {
    // For source > target, encode must be >= target (downscaled at display
    // produces the artifact filter only if there are pixels to downscale)
    const result = encodeDimension({
      sourceW: 4000,
      sourceH: 3000,
      targetW: 800,
      targetH: 600,
    });
    expect(result.encodeW).toBeGreaterThan(800);
  });

  test("non-mod-16 raw values get aligned up, not down", () => {
    // 854 × 1.5 = 1281, an odd number that breaks block alignment
    const result = encodeDimension({
      sourceW: 1920,
      sourceH: 1080,
      targetW: 854,
      targetH: 480,
    });
    // 854 × 1.5 = 1281, ceil_to_mod16 = 1296
    expect(result.encodeW).toBe(1296);
  });
});

describe("QUALITY_MAP", () => {
  test("maps canon presets to numeric quality values", () => {
    expect(QUALITY_MAP.low).toBe(20);
    expect(QUALITY_MAP.medium).toBe(50);
    expect(QUALITY_MAP.high).toBe(80);
  });
});
