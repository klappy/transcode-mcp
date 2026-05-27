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
revised: 2026-05-27T21:00:00Z
revision_reason: Prior version's prose contradicted canon on the overshoot mechanism. The formula was correct; the framing ("source-as-ceiling") and Branch B's mechanism were wrong. An external tool (Cursor bugbot) then pattern-matched the wrong prose against the correct formula and "fixed" the formula to match the prose, breaking it. This revision restores the correct formula, rewrites the prose to match canon, and collapses the three-branch structure to a unified rule. See canon/handoffs/2026-05-27-encode-arithmetic-wrong-turn.md meta-lesson 9 for the full sequence.
---

# Encode Resolution Arithmetic — A Candidate Technique Under the Multi-Objective Frame

> The encode dimension is governed by the display target, not by the source. The rule: encode at half-class above the display target (`target × 1.5`, mod-16 ceil), with a guard against runaway upscaling on tiny sources (`min(target × 1.5, source × 1.5)`). The byte budget constrains the encode quality; the display downscale provides artifact filtering and zoom headroom. This is one candidate technique scored against the six quality attributes in `canon/values/project-goal.md`. It is not a standalone law. "No pixel averaging" is a narrow-case target ideal for pixel-art-like content, not the primary mechanism — for the dominant traffic (photographs, scripture-reading screenshots), the display downscale IS the intended averaging step and we want it.

---

## Summary — One Page

This document defines the encode resolution selection rule the Worker applies to each image request. The rule is a single formula — `ceil_to_mod16(min(target × 1.5, source × 1.5))` — applied uniformly regardless of whether the source is larger or smaller than the target. The three-branch structure from the prior version of this document has collapsed to a unified rule: the formula produces the correct encode dimension for all source/target relationships, with Branch C (source equals target) as the only short-circuit.

The headline principle: **the encode dimension is governed by the display target.** Canon (`canon/handoffs/2026-05-26-exploration-journal.md`, "The v1 image target") states: "If the source is at or below that resolution, resolution is effectively a no-op — only the overshoot applies." The half-class overshoot encodes at 1.5× the display target, the byte budget forces the compressor to do more work on more pixels, and the display downscale averages out compression artifacts while providing zoom headroom. This mechanism works regardless of source size. Source size is not a ceiling; the byte budget is the ceiling. The only constraint on overshoot magnitude is "don't overshoot so far that the byte budget starves the encode" — which is what "half-class, not full-class" enforces.

The `source × 1.5` term in the `min()` exists solely to prevent the absurd case of tiny sources being upscaled to enormous encode dimensions (e.g., a 9px source encoding at 1620px for a 1080p display). For normal traffic where source is comparable to or larger than target, this term is slack and `target × 1.5` binds.

This document is a working hypothesis. The rule needs verification against a real source-image corpus before it's promoted to stable. The retraction conditions are in `canon/values/project-goal.md`.

---

## The Rule

```
def encode_dimension(source_w, target_w, source_h, target_h):
    # Short-circuit: source equals target (rare)
    if source_w == target_w and source_h == target_h:
        return source_w, source_h

    # Unified rule: half-class overshoot, guarded against tiny-source runaway
    encode_w = ceil_to_mod16(min(target_w * 1.5, source_w * 1.5))
    encode_h = preserve_aspect_ratio(source, encode_w)
    encode_h = ceil_to_mod16(encode_h)
    return encode_w, encode_h
```

The formula `min(target × 1.5, source × 1.5)` says: overshoot the *larger* of source-or-target by half a class. When source > target, `target × 1.5` binds (the normal downsample case). When source ≤ target, `source × 1.5` binds — which modestly upscales the source by 1.5×, providing the half-class overshoot canon prescribes while preventing runaway upscaling.

---

## How The Rule Works — By Source/Target Relationship

### Source > Target (Downsample — The Dominant Traffic Case)

A 4000-pixel phone photo headed to an 800-pixel display. This is the dominant share of real traffic: modern phone cameras produce 12MP+ source images; target displays are 800–1200 pixels wide.

**What happens.** `target × 1.5` binds (it's smaller than `source × 1.5`). The encoder resizes the source down to the overshot target dimension, compresses to the byte budget, and the browser does the final downscale from the encode dimension to the display target. That final downscale is the artifact filter — it low-passes blocking, ringing, and chroma artifacts into soft blur.

**Why this works.** A competitor encoding at exactly the display target into the same byte budget produces blocking — hard square DCT-block artifacts the eye reads as "broken." The half-class overshoot pushes artifacts to a finer grain; the display downscale then averages them away. Same information loss, opposite perceptual verdict: the eye reads soft blur as natural and blocking as broken. This is the "control the character of the loss" principle from the exploration journal.

### Source ≤ Target (Upscale — Small Source to Large Display)

A 400-pixel source going to an 800-pixel display, or a 240×320 image going to a phone screen. Canon explicitly covers this: "If the source is at or below that resolution, resolution is effectively a no-op — only the overshoot applies."

**What happens.** `source × 1.5` binds (it's smaller than `target × 1.5`). The source is upscaled to `source × 1.5` at the encoder. The byte budget constrains the encode quality. At display time, the browser scales the encode to fit the display target.

**Why this works.** The encoder operates on a canvas modestly larger than the source (1.5×), giving the compressor more pixels to spread its quantization across. The byte budget is held constant — same bytes, more pixels means the compressor works harder per pixel, but the additional resolution provides material for display-time scaling that would otherwise be absent. For a 400px source going to an 800px display, encoding at 600px (400 × 1.5, mod-16) means the browser upscales from 600→800 instead of 400→800 — a 1.33× render upscale instead of a 2× one, which produces noticeably less blur.

**Why the cap at `source × 1.5` matters here.** Without the `source × 1.5` term, a 9px source going to a 1080p display would encode at `1080 × 1.5 = 1620` — a 180× upscale, manufacturing image content from 81 pixels of real signal. The `source × 1.5` cap says: for this case, encode at `9 × 1.5 = 13.5`, mod-16 ceil = 16. A modest upscale from the source, not a catastrophic one from the display target.

### Source Equals Target (Rare — Short-Circuit)

No scaling. The encoder's only job is format conversion and quality adjustment. This branch exists to avoid the overhead of computing the overshoot when there's nothing to overshoot.

---

## Why The Cap Is `source × 1.5`, Not `source`

This section exists to prevent the misreading that caused the prior version's errors, and to anticipate the pattern-matching that external tools (bugbot, linters) may apply.

The `min(target × 1.5, source × 1.5)` formula looks like it should be `min(target × 1.5, source)` if you read "source-as-ceiling" into the design. That reading is wrong. The cap is **not** a "don't exceed source resolution" invariant. Canon explicitly endorses encoding above source dimensions for the overshoot mechanism.

The cap's actual job: **prevent the encode dimension from overshooting the display target so absurdly far above the source that we manufacture content from no signal.** The `× 1.5` on both terms means the overshoot is always half-class relative to whichever dimension is larger. For normal traffic where source ≥ target, the cap is slack and the `target × 1.5` term binds — the formula never reaches the source term at all. For tiny-source-huge-display cases (source << target), the cap kicks in and limits the encode to a modest upscale of the source.

Consider the alternatives:

- `min(target × 1.5, source)` — **wrong.** When `target × 1.5 > source > target`, this caps the encode at source dimensions, defeating the half-class overshoot entirely. Example: source 850, target 800 → `min(1200, 850) = 850`. The encoder stays at source dimensions with no overshoot, losing the artifact-cleaning and zoom-headroom benefits canon prescribes. This is what bugbot's "fix" would have produced.

- `min(target × 1.5, source × 1.5)` — **correct.** Same example: `min(1200, 1275) = 1200`. The `target × 1.5` term binds. The encoder overshoots the display target by half a class, exactly as canon prescribes. The `source × 1.5` term only binds when source is genuinely tiny relative to target.

- `target × 1.5` alone (no cap) — **almost correct** but fails the tiny-source edge case. Source 9, target 1080 → encode at 1620. Manufacturing a 1620px image from 9 pixels of signal is absurd regardless of the byte budget. The cap prevents this.

---

## Multi-Objective Scoring (Against the Six Attributes in `project-goal.md`)

The unified rule scores uniformly across all source/target relationships:

| Attribute | Score | Reasoning |
|-----------|-------|-----------|
| Perceived quality floor | ✅ Clears comfortably — artifact filter mechanism is the technique's primary purpose; zoom headroom provides buffer |
| Transcode wall time | ✅ One scale operation, deterministic, no classifier, no per-request branching |
| Implementation simplicity | ✅ One formula, one short-circuit; ~10 lines including aspect-ratio preservation |
| Maintainability | ✅ One operator can read, verify, and explain the formula. Simpler than the prior three-branch version |
| Egress cost | ⚠️ Encode area up to ~2.25× display target area; pays for the quality gain |
| Storage cost | ⚠️ Same — larger cached variants |

**Trade explicitly named.** The rule pays bytes for perceived-quality margin. The half-class overshoot only earns its byte cost when the source is lossy (JPEG with visible artifacts) or when zoom headroom is valuable. For clean sources at display resolution, the overshoot may be bytes for invisible quality gain. This is the case the corpus measurement (open item in `project-goal.md`) must resolve.

---

## Worked Examples

All examples use the corrected formula: `encode_w = ceil_to_mod16(min(target_w × 1.5, source_w × 1.5))`.

### Example 1: Large source, small target (dominant case)

Source 4000×3000, target 800×600.

- `min(800 × 1.5, 4000 × 1.5)` = `min(1200, 6000)` = 1200
- `ceil_to_mod16(1200)` = 1200 (already mod-16)
- Aspect ratio: 3000/4000 = 0.75 → `1200 × 0.75` = 900 → `ceil_to_mod16(900)` = 912
- **Encode: 1200×912.** Browser downsamples 1200→800. The downscale is the artifact filter.
- `target × 1.5` binds. `source × 1.5` is slack (6000 >> 1200).

### Example 2: Source near target (modest downsample)

Source 850×640, target 800×600.

- `min(800 × 1.5, 850 × 1.5)` = `min(1200, 1275)` = 1200
- `ceil_to_mod16(1200)` = 1200
- Aspect ratio: 640/850 ≈ 0.753 → `1200 × 0.753` ≈ 903 → `ceil_to_mod16(903)` = 912
- **Encode: 1200×912.** Source upscales modestly from 850→1200 at the encoder, byte budget compresses, browser downsamples 1200→800.
- Same result as Example 1. This is the point — the formula doesn't care whether source is above or below target; the display target governs the encode dimension.
- `target × 1.5` binds. Note: source (850) is *larger* than target (800) but *smaller* than the overshot target (1200). The prior doc's "source-as-ceiling" framing would have capped this at 850, defeating the overshoot. The correct formula overshoots the display target regardless.

### Example 3: Small source, large target

Source 400×300, target 800×600.

- `min(800 × 1.5, 400 × 1.5)` = `min(1200, 600)` = 600
- `ceil_to_mod16(600)` = 608
- Aspect ratio: 300/400 = 0.75 → `608 × 0.75` = 456 → `ceil_to_mod16(456)` = 464
- **Encode: 608×464.** Source upscales from 400→608 at the encoder. Byte budget compresses to the encode canvas. Browser upscales 608→800 for display.
- The encode canvas (608) is larger than source (400) AND smaller than the display target (800). Modest upscale at the encoder, modest upscale at the renderer, byte budget held.
- `source × 1.5` binds. The cap prevents encoding at 1200 (which would be a 3× upscale from a 400px source — not catastrophic but more upscaling than the half-class overshoot warrants for this source).

### Example 4: Tiny source, large target (the cap's actual job)

Source 9×9, target 1080×1080.

- `min(1080 × 1.5, 9 × 1.5)` = `min(1620, 13.5)` = 13.5
- `ceil_to_mod16(13.5)` = 16
- **Encode: 16×16.** Source upscales from 9→16. Browser upscales 16→1080 for display.
- The `source × 1.5` cap prevents the 1620px catastrophe. Without the cap, the encoder would manufacture a 1620×1620 image from 81 pixels of real signal — a 180× upscale that produces no information the byte budget hasn't paid for.
- This is the case that justifies the cap's existence in the formula.

---

## "No Pixel Averaging" — A Narrow-Case Target Ideal

The prior version of this document treated "no pixel averaging at the encoder" as a primary design goal for Branch B. That framing inverted canon's preference.

Canon's mechanism puts averaging deliberately at the *display downscale*, where it functions as an artifact filter. Encoder-side averaging (when the encoder resamples a non-integer scale) and display-side averaging (when the browser downscales to fit the display target) are different things. Canon prefers the display-side path — the display downscale IS the artifact filter, and for photographs and scripture-reading screenshots (the dominant traffic), we want it.

"No pixel averaging" at the encoder is a valid target ideal in one narrow case: **pixel-art-like content where the renderer's bilinear interpolation is itself the failure mode** — where the content has hard pixel boundaries that averaging would blur. For this content class, an integer-multiple upscale at the encoder preserves the pixel grid, and the renderer's nearest-neighbor mode (if available) or the integer relationship between encode and display dimensions keeps the grid clean.

For the dominant traffic, the corrected formula handles this naturally: the `min(target × 1.5, source × 1.5)` formula produces non-integer scale factors in the general case, and that's fine — the encoder resamples, the byte budget compresses, and the display downscale does the artifact filtering. The encoder-side resampling is not the enemy; the display-side downscale is the friend.

---

## Branch C — Source Equals Target (Rare)

Encode at source dimensions. No scaling. The encoder's only job is format conversion and quality adjustment to the q_preset.

**Multi-objective scoring:** dominates every other strategy on every attribute when the input dimensions already match the target. The reason this branch exists is to short-circuit the math — there's no work to do.

---

## Why Mod-16, Not Mod-8 or Mod-32

The formula uses mod-16 ceiling. Three reasons:

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
  targetW: number, targetH: number
): { encodeW: number; encodeH: number } {
  // Short-circuit: source equals target (no scaling needed)
  if (sourceW === targetW && sourceH === targetH) {
    return { encodeW: sourceW, encodeH: sourceH };
  }

  // Unified rule: half-class overshoot, guarded against tiny-source runaway
  const halfClass = Math.min(targetW * 1.5, sourceW * 1.5);
  const encodeW = ceilToMod16(halfClass);
  // Preserve aspect ratio, then align
  const aspectRatio = sourceH / sourceW;
  const encodeH = ceilToMod16(encodeW * aspectRatio);
  return { encodeW, encodeH };
}
```

Note: the `qPreset` parameter from the prior version has been removed from this function. The encode dimension is determined by source, target, and the half-class overshoot rule. The quality preset governs the byte budget and the quality parameter the encode-measure-adjust loop tunes — not the encode dimension. Separating these concerns is a simplicity win.

---

## What This Rule Buys And What It Costs

**Buys:**

- A deterministic encoder dimension per request — no per-request classifier, no machine learning
- One formula for all source/target relationships (simpler than the prior three-branch version)
- The half-class overshoot mechanism canon prescribes, with artifact filtering and zoom headroom
- Mod-16 alignment for codec efficiency
- A guard against tiny-source runaway without imposing a "source-as-ceiling" invariant that would defeat the overshoot
- ~10 lines of arithmetic including aspect-ratio preservation

**Costs:**

- Bytes proportional to encode area (~2.25× display target area). The half-class overshoot pays for artifact filtering and zoom headroom; for clean sources this may be bytes for invisible quality gain — open question, corpus measurement required.
- Small sources get a modest upscale (1.5×) that may still leave the browser doing significant upscaling at render time. A 400px source encoding at 608 for an 800px display means the browser does a 1.33× upscale — visible softness but better than the prior version's 2× cap which would have encoded at 800 and passed the render-side upscale to the browser entirely.
- Tiny sources (the 9px case) encode at a small dimension (16px) that the browser upscales dramatically at display time. This is the correct trade: the alternative is manufacturing 1620px of content from 9px of signal, paying enormous bytes for no perceptible gain.

---

## Lessons From The Sessions That Produced This Document

These are recorded because they affected how the rule was derived and where agents went wrong.

1. **Naive 1.5× breaks codec block alignment.** 854 × 1.5 = 1281, an odd number that breaks chroma alignment and macroblock grids. Mod-16 ceiling fixes it.
2. **Downsampling is the dominant case, not an edge case.** Modern phone cameras produce 12MP+ source images; target displays are 800–1200 pixels wide.
3. **No per-request content classification.** Too expensive in the Worker, requires opaque heuristics, fails maintainability. The math is the routing signal.
4. **Mod-32 is anecdotal; mod-16 is defensible.** Sovee production experience plus documented codec requirements.
5. **The encode dimension is governed by the display target, not the source.** The prior version framed the formula around "source-as-ceiling" — never encode above source resolution. Canon says the opposite: the overshoot applies regardless of source size. The `source × 1.5` term in the formula is a runaway-prevention guard, not a ceiling invariant.
6. **External tools that pattern-match are not authoritative on design constraints.** Cursor bugbot flagged the formula as a bug because the prose said "source-as-ceiling" but the formula used `source × 1.5`. The prose was wrong; the formula was right. Bugbot "fixed" the formula to match the wrong prose, breaking it. The meta-lesson: when an external tool flags something on a canon doc, verify the finding against canon before accepting it.

---

## How This Document Relates To The Goal

The byte-budget objective and the six quality attributes in `canon/values/project-goal.md` are the load-bearing frame. This document is one candidate technique within that frame. The arithmetic above is the working answer to: *for the image-transform branch of the Worker, what encoder dimension minimizes bytes while clearing the perceived-quality floor and respecting the other four attributes?*

It is not the only candidate. Alternatives the multi-objective frame might surface:

- **C1 (always encode at source).** Smallest transcode work; loses byte savings on downsamples. Acceptable when source is already small enough.
- **C2 (always encode at target).** Smallest output dimensions; loses artifact-cleaning margin on lossy sources.
- **C3 (the unified rule above).** Half-class overshoot with tiny-source guard. Current working hypothesis.
- **C4 (per-q-preset variants).** Different rules at `q=low` vs `q=high`. Adds complexity; defer until traffic data shows it's needed.

The corpus measurement open in `project-goal.md` is the test that picks between C1, C2, C3, and any C4 variants. Until that measurement runs, C3 is the working default because it's the most-defended in prior Sovee production experience and the closest to the exploration journal's "control the character of the loss" framing.

---

## Open Items

- Corpus measurement on real source images (pericope photographs, screenshots, the occasional small icon) to verify the half-class overshoot earns its byte cost.
- Mod-32 alignment audit: measure compression delta on a real downsample corpus. If gains are real, change the constant.
- Audio analogue: the audio container recipes in `canon/planning/2026-05-27-audio-container-recipes.md` carry analogous arithmetic for sample rate and bitrate. Not in scope here; cross-referenced for the operator's audit.
- Non-16:9 aspect ratios: portrait and square aspect ratios need verification on a real corpus before the formula is promoted to stable.
- Pixel-art routing: if real traffic includes pixel-art-class content where the renderer's bilinear interpolation is the failure mode, a content-class flag (not a per-request classifier — an explicit URL parameter like `content=pixel-art`) could route to integer-multiple encoding. Defer until traffic data shows demand.

---

## Constraints On This Document

This document is subordinate to `canon/values/project-goal.md`. If the rule produces an encoder configuration that violates the multi-objective frame — for example, by clearing the byte budget but breaking the perceived-quality floor — the goal-doc governs. The rule revises; the goal does not.

The rule is a working hypothesis, not stable canon. Promotion to stable requires the corpus measurement open above plus a session journal recording the gate closure.
