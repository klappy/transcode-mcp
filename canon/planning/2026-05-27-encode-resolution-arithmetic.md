---
title: Encode Resolution Arithmetic — A Candidate Technique Under the Multi-Objective Frame
date: 2026-05-27
status: working
mode: planning
derives_from: canon/planning/2026-05-26-url-vocabulary-and-presets.md
complements:
  - canon/values/project-goal.md
  - canon/planning/2026-05-26-worker-container-boundary.md
supersedes_section: canon/planning/2026-05-26-url-vocabulary-and-presets.md#Half-Class Resolution Overshoot — Open Items
governs: encoder dimension selection in the Worker image transform path
---

# Encode Resolution Arithmetic — A Candidate Technique Under the Multi-Objective Frame

> The "encode at 1.5× the smaller of source-or-target" rule from prior canon, refined into a three-branch arithmetic that respects codec block alignment (mod-16), source-as-ceiling, and pixel-grid integrity (no fractional resampling when an integer multiple is reachable). The rule is one candidate technique scored against the six quality attributes in `canon/values/project-goal.md`. It is not a standalone law. "No pixel averaging" is named as a target ideal the technique pursues when reachable cheaply — held in tension with byte cost, transcode time, simplicity, and the perceptual quality floor.

---

## Summary — One Page

This document defines the encode resolution selection rule the Worker applies to each image request. The rule has three branches keyed on the relationship between source and target dimensions. Each branch encodes a different combination of trade-offs across the six quality attributes named in `canon/values/project-goal.md`. The rule replaces the naive `target_w × 1.5` formula in `canon/planning/2026-05-26-url-vocabulary-and-presets.md` with arithmetic that accounts for codec block alignment, integer scale factors where reachable, and source-as-ceiling.

The headline principle: **encode preserves information; renderer presents it.** When the encoder can deliver an integer-multiple of the source pixel grid, the renderer's final downsample (LANCZOS / browser bilinear) does cleaner work than any encoder-side resampling. When integer multiples aren't reachable, mod-16 alignment helps codec efficiency. When neither is reachable cheaply (tiny sources), keeping source dimensions and raising the quality knob is the bytes-cheaper move.

This document is a working hypothesis. The rule needs verification against a real source-image corpus before it's promoted to stable. The retraction conditions are in `canon/values/project-goal.md`.

---

## The Three-Branch Rule

```
def encode_dimension(source_w, target_w, source_h, target_h, q_preset):
    if source_w > target_w:
        # BRANCH A — Downsample (the dominant traffic case)
        encode_w = ceil_to_mod16(min(target_w * 1.5, source_w))
        encode_h = preserve_aspect_ratio(source, encode_w)
        encode_h = ceil_to_mod16(encode_h)
    elif source_w < target_w:
        # BRANCH B — Upscale (modest, capped)
        N = min(ceil(target_w / source_w), 2)  # integer multiple, cap at 2
        encode_w = source_w * N
        encode_h = source_h * N
    else:
        # BRANCH C — Source equals target (rare)
        encode_w = source_w
        encode_h = source_h
```

Each branch is described below with its mechanism, its multi-objective scoring, and worked examples.

---

## Branch A — Downsample (Source > Target)

The dominant traffic case: a 4000-pixel phone photo headed to a 1200-pixel display. The encoder ingests the high-resolution source and produces an intermediate-resolution encode; the browser does the final downscale to display.

**Mechanism.** `encode_w = ceil_to_mod16(min(target_w × 1.5, source_w))`.

- `min(target × 1.5, source)` — the half-class overshoot, capped so we never invent pixels above the source resolution. For source > target (this branch), the binding term is `target × 1.5` whenever `target × 1.5 ≤ source`; otherwise the `source` cap binds and the encoder stays at source dimensions.
- `ceil_to_mod16(...)` — round up to the next multiple of 16 so the codec's macroblock grid divides cleanly. JPEG, WebP, AVC, HEVC, AV1 all benefit; the cost is at most 15 extra pixels per dimension.

**Why the overshoot.** The final browser downscale is the artifact filter. Encoding at exactly the target dimension means the encoder's quantization noise is what the user sees; encoding at 1.5× target means the noise passes through a downscale that smooths blocking, ringing, and chroma artifacts.

**Multi-objective scoring (against the six attributes in `project-goal.md`):**

| Attribute | Score | Reasoning |
|-----------|-------|-----------|
| Perceived quality floor | ✅ Clears comfortably — artifact filter mechanism is the technique's primary purpose |
| Transcode wall time | ✅ One scale operation, deterministic, no classifier |
| Implementation simplicity | ✅ Three lines of arithmetic; no per-request branching beyond source/target comparison |
| Maintainability | ✅ One operator can read, verify, and explain the formula |
| Egress cost | ⚠️ Bytes proportional to encode area × ~2.25; pays for the quality gain |
| Storage cost | ⚠️ Same — larger cached variants |

**Trade explicitly named.** This branch pays bytes for perceived-quality margin. The half-class overshoot only earns its byte cost when the source is lossy (JPEG with visible artifacts) — for clean sources, the overshoot may be bytes for invisible quality gain. This is the case the corpus measurement (open item in `project-goal.md`) must resolve.

**Worked example.** Source 4000×3000 phone photo, target 800×600 display.
- `min(800×1.5, 4000)` = 1200
- `ceil_to_mod16(1200)` = 1200 (already mod-16)
- Encode dimensions: 1200×900, then ceil_to_mod16(900) = 912
- Final encode: 1200×912
- Browser downsamples 1200×912 → 800×600 (final artifact-cleaning step)

---

## Branch B — Upscale (Source < Target), Capped at ×2

Modest upscale from a small source to a larger display. The risk here is manufacturing pixels above the information content of the source. The cap protects against the worst case.

**Mechanism.** `N = min(ceil(target_w / source_w), 2)`, then `encode_w = source_w × N`.

- Integer multiple `N` — when reachable, this means the encoder does no fractional resampling. Pixel averaging at the encoder is avoided. The renderer handles the final fit to display via bilinear or whatever the browser's downscale uses.
- Cap at 2 — beyond ×2, we're manufacturing image content from sparse source information. A 9-pixel source extrapolated to a 1080-pixel display via ×120 would produce a 1.1-megapixel file from 81 pixels of real information. The bytes pay for nothing the user couldn't perceive in a much smaller file.

**Why integer multiples matter for small sources.** When source × N lands on a clean pixel-grid multiple of the source, the encoder doesn't apply averaging — each source pixel maps to N×N output pixels with no interpolation. The renderer's final downscale to display does the smoothing. This is the "no pixel averaging" target ideal: when reachable, achieve it; when not, accept the loss and minimize bytes.

**Multi-objective scoring:**

| Attribute | Score | Reasoning |
|-----------|-------|-----------|
| Perceived quality floor | ✅ Integer multiples preserve source information faithfully |
| Transcode wall time | ✅ One scale operation |
| Implementation simplicity | ✅ Two-line branch; ceil and cap are trivial |
| Maintainability | ✅ Cap-at-2 is a documented invariant, not tribal knowledge |
| Egress cost | ✅ Small source × small N = small file |
| Storage cost | ✅ Same |

**Trade explicitly named.** The ×2 cap means a 100-pixel source going to a 1080-pixel display encodes at 200, not 1080. The browser does a 200→1080 upscale at render time, which is a soft-blur scale. The alternative — encoding at 1080 — would pay ~25× the bytes for content that has no real information above 100×100. The cap is the conscious sacrifice of one quality attribute (resolution-match-to-display) for five others (bytes, time, simplicity, maintainability, cost).

**Worked examples.**

- Source 400×300, target 800×600 → `N = min(ceil(800/400), 2) = 2` → encode at 800×600 (clean ×2, no averaging)
- Source 200×150, target 800×600 → `N = min(ceil(800/200), 2) = 2` → encode at 400×300 (×2, browser upscales 400→800 at render)
- Source 9×9, target 1080×1080 → `N = min(ceil(1080/9), 2) = 2` → encode at 18×18 (×2, browser upscales 18→1080 at render)

The 9×9 case is the one we verified empirically last turn: `encode=18, q=50` produces 194 bytes with quality score 232, beating both `encode=9, q=80` (154 bytes, quality 215) on quality and `encode=32 mod-16 ceil, q=50` (280 bytes, quality 214) on bytes-and-quality. The integer multiple at the cap wins on the multi-objective score even though it's neither the smallest-bytes nor the highest-quality option in isolation.

---

## Branch C — Source Equals Target (Rare)

Encode at source dimensions. No scaling. The encoder's only job is format conversion and quality adjustment to the q_preset.

**Multi-objective scoring:** dominates every other strategy on every attribute when the input dimensions already match the target. The reason this branch exists is to short-circuit the math — there's no work to do.

---

## Why Mod-16, Not Mod-8 or Mod-32

The downsample branch uses mod-16 ceiling. Three reasons:

1. **Codec block size.** JPEG uses 8×8 DCT blocks; H.264/AVC uses 16×16 macroblocks; H.265/HEVC and AV1 use larger superblocks with 8×8 minimum. Mod-16 satisfies the largest common requirement and is the historical Sovee default.
2. **Chroma subsampling.** 4:2:0 chroma needs even dimensions; mod-16 trivially satisfies this.
3. **Mod-8 vs mod-16 vs mod-32 trade-off.** Mod-8 catches JPEG and HEVC efficiently but leaves AVC/WebP suboptimal. Mod-32 is anecdotal (some claims of compression efficiency gains, no verified data in canon). Mod-16 is the defensible middle: documented codec benefit, modest pixel cost (up to 15 extra per dimension), aligned with Sovee production experience.

The mod-16 choice is held as a working default. If corpus measurement shows mod-32 delivers measurable compression gains for the dominant traffic class, the constant can change. The rule structure stays.

---

## Reference Implementation (TypeScript, for the Worker)

```typescript
function ceilToMod16(n: number): number {
  return Math.ceil(n / 16) * 16;
}

function encodeDimension(
  sourceW: number, sourceH: number,
  targetW: number, targetH: number,
  qPreset: 'low' | 'medium' | 'high'
): { encodeW: number; encodeH: number } {
  // Branch C — source equals target (no scaling needed)
  if (sourceW === targetW && sourceH === targetH) {
    return { encodeW: sourceW, encodeH: sourceH };
  }

  // Branch A — downsample (dominant traffic case)
  if (sourceW > targetW) {
    const halfClass = Math.min(targetW * 1.5, sourceW);
    const encodeW = ceilToMod16(halfClass);
    // Preserve aspect ratio, then align
    const aspectRatio = sourceH / sourceW;
    const encodeH = ceilToMod16(encodeW * aspectRatio);
    return { encodeW, encodeH };
  }

  // Branch B — upscale (modest, capped at ×2)
  const N = Math.min(Math.ceil(targetW / sourceW), 2);
  return {
    encodeW: sourceW * N,
    encodeH: sourceH * N,
  };
}
```

---

## What This Rule Buys And What It Costs

**Buys:**

- A deterministic encoder dimension per request — no per-request classifier, no machine learning
- Integer-multiple preservation when reachable, mod-16 alignment when not
- The "no pixel averaging" target ideal pursued whenever it's cheap to achieve
- Source-as-ceiling protection (never invent pixels above source)
- Three lines of arithmetic per branch, total ~20 lines including aspect-ratio preservation

**Costs:**

- Branch A pays bytes for the half-class overshoot. For clean sources this may be bytes for nothing — open question, corpus measurement required.
- Branch B at the ×2 cap delivers a smaller-than-display encode that the browser must upscale at render time. The render-side upscale is a soft-blur scale; visually acceptable for most pericope photos but explicitly named here as the sacrifice.
- The integer-N cap means we deliberately undershoot resolution for tiny sources. This is the correct trade for bytes — but a caller who needs `q=high` on a tiny source will see render-time blur. The `q=high` preset on a small source is the case where the rule's working hypothesis is most likely to need adjustment.

---

## Lessons From The Session That Produced This Document

These are recorded here because they affected how the rule was derived and where the agent went wrong before recovering.

1. **Naive 1.5× breaks codec block alignment.** The first derivation ignored mod-N constraints entirely. The operator caught it: 854 × 1.5 = 1281, an odd number; 1281 breaks 4:2:0 chroma alignment, breaks JPEG 8×8 DCT, breaks AVC 16×16 macroblocks. Mod-16 ceiling fixes it.
2. **Downsampling is the dominant case, not an edge case.** The agent initially labeled "source > target" as an edge case for next session. The operator corrected: modern phone cameras produce 12MP+ source images; target displays are 800–1200 pixels wide; source > target is the dominant share of real traffic. The Sovee technique was built for this case from day one.
3. **No per-request content classification.** The agent proposed a pixel-art-vs-photograph classifier to route between integer-multiple and half-class strategies. The operator rejected: "ridiculous" — too expensive in the Worker, requires opaque heuristics, fails the maintainability constraint. The math (source-vs-target dimension comparison) is the routing signal.
4. **Integer N for upscale is a cap at 2, not a minimum.** The agent reversed direction twice on whether to allow large N. The operator's intuition was right: capping at ×2 protects against manufacturing pixels from sparse information. A 9-pixel source going to 1080 via ×120 would pay ~1.1M pixels of bytes for 81 pixels of real signal. Cap at 2.
5. **Mod-32 is anecdotal; mod-16 is defensible.** Operator named that mod-32 compression-efficiency claims are not verified in canon. Mod-16 is Sovee production experience plus documented codec requirements. Mod-8 is too soft for AVC and WebP macroblocks.

These lessons are session-level, not canon-level. The canon-level meta-lessons are in `canon/values/project-goal.md` under "Anti-patterns to watch for."

---

## How This Document Relates To The Goal

The byte-budget objective and the six quality attributes in `canon/values/project-goal.md` are the load-bearing frame. This document is one candidate technique within that frame. The arithmetic above is the working answer to: *for the image-transform branch of the Worker, what encoder dimension minimizes bytes while clearing the perceived-quality floor and respecting the other four attributes?*

It is not the only candidate. Alternatives the multi-objective frame might surface:

- **C1 (always encode at source).** Smallest transcode work; loses byte savings on downsamples. Acceptable when source is already small enough.
- **C2 (always encode at target).** Smallest output dimensions; loses artifact-cleaning margin on lossy sources.
- **C3 (the three-branch rule above).** Half-class for downsamples, capped integer for upscales. Current working hypothesis.
- **C4 (per-q-preset variants).** Different rules at `q=low` vs `q=high`. Adds complexity; defer until traffic data shows it's needed.

The corpus measurement open in `project-goal.md` is the test that picks between C1, C2, C3, and any C4 variants. Until that measurement runs, C3 is the working default because it's the most-defended in prior Sovee production experience and the closest to the exploration journal's "control the character of the loss" framing.

---

## Open Items

- Corpus measurement on real source images (pericope photographs, audio waveforms not applicable here, screenshots, the occasional small icon) to verify Branch A's half-class overshoot earns its byte cost.
- `max_n` configuration: the ×2 upscale cap is currently a constant in the rule. If real traffic shows demand for higher caps (e.g. `q=high` on small sources where render-side blur is unacceptable), expose `max_n` as a URL parameter.
- Mod-32 alignment audit: measure compression delta on a real downsample corpus. If gains are real, change the constant. Defer until corpus data is available.
- Audio analogue: the audio container recipes in `canon/planning/2026-05-27-audio-container-recipes.md` carry analogous arithmetic for sample rate and bitrate. Not in scope here; cross-referenced for the operator's audit.
- Non-16:9 aspect ratios: the worked examples here assume 16:9 or similar. Portrait and square aspect ratios need verification on a real corpus before the formula is promoted to stable.

---

## Constraints On This Document

This document is subordinate to `canon/values/project-goal.md`. If any branch of the rule produces an encoder configuration that violates the multi-objective frame — for example, by clearing the byte budget but breaking the perceived-quality floor — the goal-doc governs. The rule revises; the goal does not.

The rule is a working hypothesis, not stable canon. Promotion to stable requires the corpus measurement open above plus a session journal recording the gate closure.
