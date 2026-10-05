---
title: "Sovée video policy correction — lower-rung budgets, interframes, and playback selection"
date: 2026-10-04
status: working
mode: planning
derives_from: canon/values/project-goal.md
complements:
  - canon/planning/2026-10-04-fia-video-adapter.md
  - canon/planning/2026-05-27-encode-resolution-arithmetic.md
  - canon/handoffs/2026-05-26-exploration-journal.md
---

# Sovée video policy correction — lower-rung budgets, interframes, and playback selection

> The operator's 2026-10-04 correction governs new video work: encode a higher-resolution canvas at the bitrate budget associated with two resolution steps lower; favor efficient interframes inside the longest suitable GOP while inserting keyframes at real scene changes; select playback one resolution step above the player-fit rendition when bandwidth allows. These are three separate controls. The old half-step ceiling is superseded for this video policy. The resolution ladder, bitrate table, bandwidth thresholds and some encoder mappings remain unverified; this document does not invent production defaults or claim a deployed implementation.

## Summary — Current direction and precedence

The primary technique is **higher resolution at the same lower-resolution bit budget**, not merely changing CRF or comparing several bitrates at one resolution. The operator now specifies borrowing the budget **two steps below the encoded resolution**. The secondary technique improves interframe efficiency with long suitable GOPs and automatic keyframes at genuine cuts. Playback selection is separate: choose **one step above the resolution that fits the player**, if available bandwidth supports it.

This materially changes prior records. The 2026-05-26 journal and encoding row called a half-step the ceiling and rejected a full-class overshoot. They cannot simultaneously govern the newly clarified video policy. This dated correction takes precedence for video; historical text stays intact with a pointer here. Existing image arithmetic and shipped image/audio behavior are not silently changed by this video correction.

No implementation, benchmark retry, preset promotion or deployment is authorized by this document's existence. Resume through the normal reviewed recipe and evidence process after the documentation correction is accepted. The existing Worker/container/R2 architecture remains the implementation home.

## Three axes, not one resolution knob

| Axis | Meaning | Current operator direction | Still to establish |
| --- | --- | --- | --- |
| Encoded canvas | Actual width/height of a produced rendition | Preserve a higher-resolution canvas while spending the budget of two lower resolution steps | Explicit ordered resolution ladder; dimensions/aspect treatment and source availability; which exact rung is encoded |
| Bitrate-budget class | The budget borrowed for that encoded rendition | Use the budget associated with two steps below its encoded rung, rather than that rung's usual larger budget | Measured bitrate/byte table by rung, duration/audio/mux accounting, quality floor, and encoder mapping |
| Playback selection | Which available rendition is chosen for the actual player | One step above the player-fit rung when bandwidth permits | How fit is measured, bandwidth signal and headroom thresholds, unavailable-rendition and insufficient-bandwidth behavior |

Conceptually, for an explicitly declared ladder, encoded rung R borrows budget B(R−2). If F is the player-fit rung, playback prefers the available rendition F+1 when its measured bandwidth requirement is supportable. These symbols describe relationships, not a numeric ladder. Do not assume conventional 360/480/720/1080 labels, equal pixel ratios, a universal bitrate table, device-pixel-ratio handling or a bandwidth multiplier that the operator has not specified or evidence has not established. At the bottom of a ladder, R−2 may not exist; that case must be specified before implementation rather than silently clamped.

Selecting F+1 does not mean “add another step to the already overshot encode,” and a budget two steps lower does not mean downscale the encoded pixels two steps. Do not collapse player fit, encoded canvas and borrowed budget into the previous single half-class formula. The existing image formula is image-scoped, not a substitute for defining these video axes.

## Secondary technique — efficient interframes and genuine cuts

A keyframe supplies an independently decodable reference; P/B interframes reuse temporal information. The operator's intent is to maximize useful efficient interframes within the longest GOP that remains suitable for the source and playback/seek constraints, while genuine scene changes obtain fresh keyframes. It is not “maximize I-frames,” nor “maximize B-frames” without regard to prediction structure, decoder support and quality. The operator explicitly treated the B/I terminology as uncertain; this document preserves the intended behavior without attributing unconfirmed codec terminology to them.

Retain automatic scene-change detection and measure cuts, within-scene motion, keyframe distribution and seek cost. Long GOPs can reduce redundant intra frames in stable scenes but increase decoding work for random seeks. A universal maximum GOP or scene threshold is not approved here. The older roughly 900-frame memory is historical context, not a new production constant.

For libx264, verified upstream source semantics show that a higher scenecut setting is more aggressive; do not copy a generic “lower threshold” phrase as an inverted flag. Its me_range is motion-search distance, not a verified control for coarsening the scene detector's spatial window. No such independently adjustable spatial-window mapping has been established here. Likewise, do not claim a positive hard minimum VBR bitrate from an unmapped/ignored -minrate flag. Use verified encoder controls and disclose unsupported parts; do not recreate an encoder or invent a knob to make the historical description appear implemented.

## Qualification must isolate each claim

1. **Primary matched-budget comparison.** Produce paired lower- and higher-resolution renditions from the same source/time range, with the same codec, audio settings and rate-control method, targeting the same actual video-bit and total-file budget. Declare the acceptable matching tolerance before inspecting results, then report measured payload, audio and mux bytes. Compare both at the same player size, including motion, foliage/detail, faces/text if present, and real cuts. This isolates whether the higher canvas at the lower budget gives the intended perceptual result. A smaller file alone is not proof.
2. **GOP ablation.** At matched canvas and actual budget, compare the proposed long-GOP/scene policy with a documented reference policy. Record actual encoder settings, frame types, keyframe timestamps, cut behavior, compression/time and browser seeks. Do not attribute gains to the primary resolution technique when GOP settings also changed uncontrolled.
3. **Playback selection.** Demonstrate the defined fit rung and one-above choice under sufficient measured bandwidth, then the explicitly chosen behavior when bandwidth or that rendition is unavailable. Show actual selected identities and playback behavior. Do not infer adaptive selection merely from a successful direct playback URL.

Preserve the completed CRF23/1280×720 baseline as exploratory service evidence. The later 450/750/1000 kbps trials all used the same 720-line canvas; those arbitrary experimental rates are not an approved rung-to-budget table and cannot prove the matched-resolution technique. Completed or failed trials retain their measured status and do not become accepted recipes through relabeling. Existing source hashes, licensing, output validation, cancellation, bounded resource use, cache identity and separate deployment gates continue to apply.

## Narrow next recipe work

Before further encoding, define a small explicit comparison ladder and matched budget as a provisional experiment, with the operator's three relationships visible in the recipe data. Reuse the already verified source and existing bounded pipeline. Keep comparison results separate from selecting a production preset. Promotion requires independent visual review, actual playback/seek evidence, and truthful support/limitations. No architecture restart, new service or unreviewed adaptive player is required to document this correction.

## Authority and discovery

Authority is the operator's explicit 2026-10-04 correction during the FIA video work, superseding the contradictory half-step ceiling for video. Historical sources remain useful evidence of the earlier understanding:

- [Exploration journal](../handoffs/2026-05-26-exploration-journal.md), half-step, bounded two-pass and GOP sections.
- [Exploration encoding](../encodings/2026-05-26-exploration-session.tsv), rows on half-step budget, GOP triangle and bounded VBR.
- [Image encode arithmetic](2026-05-27-encode-resolution-arithmetic.md), explicitly scoped to the image path.
- [FIA video adapter baseline](2026-10-04-fia-video-adapter.md), service/bounds proof, not optimization acceptance.

This file is discoverable through the repository README and canon index. Use its durable GitHub path or the repository-configured Oddkit knowledge base. Do not assume a deployed MCP docs tool exposes it; no runtime tool-discovery change is included here.
