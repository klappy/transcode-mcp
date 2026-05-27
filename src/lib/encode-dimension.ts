// Canon encode-dimension arithmetic.
// Spec: canon/planning/2026-05-27-encode-resolution-arithmetic.md
//
// Rule: encode_w = ceil_to_mod16(min(target_w * 1.5, source_w * 1.5))
//
// The encode dimension is governed by the display target. Half-class
// overshoot (target × 1.5) applies regardless of source size. The
// `source × 1.5` term in the min() prevents tiny-source runaway —
// it is NOT a "source-as-ceiling" invariant. Canon explicitly endorses
// encoding above source dimensions for the overshoot mechanism.

export const HALF_CLASS_MULTIPLIER = 1.5;
export const CODEC_BLOCK_ALIGNMENT = 16;

export function ceilToMod16(n: number): number {
  return Math.ceil(n / CODEC_BLOCK_ALIGNMENT) * CODEC_BLOCK_ALIGNMENT;
}

export interface EncodeDimensionInput {
  sourceW: number;
  sourceH: number;
  targetW: number;
  targetH?: number;
}

export interface EncodeDimensionResult {
  encodeW: number;
  encodeH: number;
  binding: "target" | "source" | "equal";
  rawHalfClass: number;
}

export function encodeDimension({
  sourceW,
  sourceH,
  targetW,
  targetH,
}: EncodeDimensionInput): EncodeDimensionResult {
  // Short-circuit: source equals target dimensions
  if (sourceW === targetW && (targetH === undefined || sourceH === targetH)) {
    return {
      encodeW: sourceW,
      encodeH: sourceH,
      binding: "equal",
      rawHalfClass: sourceW,
    };
  }

  // Unified rule: half-class overshoot, guarded against tiny-source runaway
  const targetHalfClass = targetW * HALF_CLASS_MULTIPLIER;
  const sourceHalfClass = sourceW * HALF_CLASS_MULTIPLIER;
  const rawHalfClass = Math.min(targetHalfClass, sourceHalfClass);
  const binding: "target" | "source" =
    targetHalfClass <= sourceHalfClass ? "target" : "source";

  const encodeW = ceilToMod16(rawHalfClass);
  // Preserve source aspect ratio, then align height
  const aspectRatio = sourceH / sourceW;
  const encodeH = ceilToMod16(encodeW * aspectRatio);

  return { encodeW, encodeH, binding, rawHalfClass };
}

// Quality preset → quality parameter (canon: low=20, medium=50, high=80)
export type Quality = "low" | "medium" | "high";

export const QUALITY_MAP: Record<Quality, number> = {
  low: 20,
  medium: 50,
  high: 80,
};
