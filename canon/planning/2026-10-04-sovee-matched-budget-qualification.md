---
title: "Provisional Sovée qualification — matched-budget resolution pair and separate GOP ablation"
date: 2026-10-04
status: draft
mode: planning
derives_from: canon/planning/2026-10-04-sovee-video-policy-correction.md
---

# Provisional Sovée qualification — matched-budget resolution pair and separate GOP ablation

> Qualify the corrected video method using one verified a13 source, a 360/720-line pair at the same measured byte budget, and a separate 720-line long-GOP comparison. The provisional ladder and numbers below are experimental choices, not approved production presets. Compare at the same 480-line player; reject unmatched budgets before making a visual claim. No encoding runs or production recipe selection are authorized until this exact qualification recipe has independent review.

## Concrete experimental mapping

The [accepted operator correction](https://github.com/klappy/transcode-mcp/blob/33deb016c16d60441412932809d8e0d7050b60b7/canon/planning/2026-10-04-sovee-video-policy-correction.md) governs this experiment: encoded resolution R borrows the budget two rungs below, while playback conditionally chooses one rung above player fit F. For this bounded experiment only, declare the ordered ladder240,360,480,720,1080 lines, with16:9 display geometry. R=720 therefore borrows the360-class budget; F=480 prefers playback720 if bandwidth supports it. The source is already1280×720, so this experiment neither fabricates detail by source upscaling nor establishes behavior for unavailable higher renditions. The360 comparator is640×360; both are rendered in the same854×480 player. No conclusions about other ladder entries or aspect ratios follow from this one test.

Define the experimental360-class video budget as450,000bits/s over the verified source video duration. Audio remains the same AAC96k stereo settings across all outputs. These numbers are chosen for a measurable experiment, not recovered historical defaults. A future production table remains unselected.

## Three outputs with controlled differences

| Output | Canvas | Video target class | GOP policy | Purpose |
| --- | --- | --- | --- | --- |
| A | 640×360 | Experimental360-class450kbps | Reference maximum2seconds, min-keyint1, scenecut40 | Lower-resolution reference |
| B | 1280×720 | Same450kbps class | Exactly the same reference policy as A | Isolate higher canvas at the lower budget |
| C | 1280×720 | Same450kbps class | Maximum30seconds, min-keyint1, scenecut60 | Isolate the combined long-GOP/scene policy relative to B |

All outputs use the same source/time range, libx264 build, medium preset, yuv420p, original50fps cadence, two-pass ABR, VBV maxrate900k/buffer1800k, optional source AAC96k stereo and faststart MP4. Extract frame rate from the verified source: keyint100 for2seconds and1500 for30seconds at50fps; fail if the inspected source contradicts that cadence. Parameters are data and both passes use identical geometry/rate/GOP settings. Keep first-pass profiling/statistics job-local and bounded.

The30second cap is an experimental policy, not proof of the longest universally allowable GOP. C tests the combined keyint/scenecut policy, not the independent effect of either knob. x264 scenecut60 is more aggressive than40; no me_range change or invented coarse-window control is included. No positive minimum bitrate is claimed. Inspect actual installed encoder settings and frame types; do not infer applied values solely from requested arguments.

## Actual-budget matching, declared before measurement

Nominal encoder targets alone do not prove equal budgets. For every output, parse actual MP4 sample tables or ffprobe packet sizes to separate video payload, audio payload and mux bytes. Report actual video duration and mean payload bitrate, total bytes and container duration. Preserve encoder-requested target alongside measured rates.

A and B qualify as a matched pair only when:

- Each actual video payload is within2% of450kbps×the verified video duration. The highest versus lowest actual video payload differs by no more than1% of the nominal video-byte budget.
- Actual audio payload SHA and sample count are equal across the pair. Identical settings alone are insufficient evidence of identical audio; if they differ, qualify a shared pre-encoded audio track from the same source in a later explicit recipe rather than quietly change this experiment.
- Total file bytes differ by no more than1% of the nominal combined video+audio-byte budget, and each total fits that combined budget plus2% mux allowance. Mux overhead is measured separately, not mislabeled video bitrate.

Apply the same gates independently to B versus C. A valid output that misses these gates remains a measured, rejected-budget candidate; capture its frames and continue other cases within safety limits. Do not loosen tolerances after seeing results. Existing450k qualification output had461.217kbps video, so a nominal450k request may fail this experiment. This is known evidence, not grounds to call its budget matched.

To avoid simply repeating that known miss, use a predeclared encoder-request correction of450000/1.025≈439024bits/s for all three initial encodes, while retaining450000bits/s as the intended class budget and the acceptance limits above. The factor is an experimental compensation derived from the measured720p two-pass overshoot, not a universal x264 property. It may underfill A or vary with GOP policy; any mismatch is a rejection. No automatic third pass or hidden encode retry is included. A subsequent bounded experiment may use measured per-configuration compensation, with new arguments and receipt identity disclosed, while keeping the actual-budget gate unchanged.

## Evidence and acceptance

First compare A/B at the same480-line player using matched time points, motion, foliage/detail, and actual cut-adjacent frames. Also inspect a720-line player as a separately labeled quality limit. Independent review must find that the higher canvas produces the intended acceptable character of loss at the same measured budget; neither smaller files nor resolution labels establish it. Record when the lower-resolution rendition is clearer instead of asserting the technique always wins.

Then compare B/C at matched actual budget. Record frame types/keyframe timestamps and cuts, within-scene motion, encode time, decoded playback and seeks across long-GOP regions. Accept the longer policy only if its quality and seek behavior meet the same usability floor. Do not credit GOP differences to the primary resolution technique.

Playback-selection evidence is a separate deterministic fixture, not a deployed adaptive-player claim: declare fit480, available renditions360/720, and observed required delivery bitrate for each measured artifact. Use explicit synthetic bandwidth cases at0.75× and1.5× the measured720 total average bitrate. A rendition is sustainable in this provisional fixture only when available bandwidth is≥1.25× that rendition’s own measured total average bitrate. Prefer720 when it is available and qualifies; consider360 only if its independently measured requirement also qualifies. If neither qualifies, return an explicit no-sustainable-rendition/defer outcome and do not begin playback. Because these artifacts deliberately have matched budgets,360 is not presumed cheaper to deliver: the low-bandwidth case should usually reject both. This is a matched-budget comparison set, not a production bandwidth ladder. Separately test720 unavailable with sufficient measured bandwidth for360, verifying fallback to that available qualified identity; also test no available qualified rendition. These factors and fallback rules are experimental, not production thresholds. Verify selected identity or explicit deferral, no unavailable-rendition invention, and no eager network request caused by selection. Play retained bytes only for a selected sustainable rendition. This proves the tested rule only; real bandwidth estimation, device-pixel-ratio policy and production fallback remain unqualified.

## Bounds, source reuse and no publication

Reuse a hash-verified retained a13 source when the exact file is supplied; otherwise acquire its single approved URL once under the existing60MiB/120second source bound, recording which path occurred. Never repeat origin downloads per candidate. SHA256257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718 and49,851,846bytes remain mandatory.

One benchmark has a shared ten-minute deadline and at most three two-pass encodes; each candidate has at most five minutes combined across its two passes. Keep32MiB per passlog/64MiB aggregate active statistics,60MiB each source/output,36 bounded2MiB frames,8MiB metadata and384MiB aggregate artifacts. Hash passlogs before cleanup between candidates; preserve outputs, measurements and rejection evidence. Source/hash/codec/duration/resource failures abort safely. No R2 publication, deployed medium selection or automatic retry occurs.

The existing service, source/provenance, cancellation, range and deployment contracts remain. The already completed CRF and same720-resolution bitrate trials stay labeled exploratory and retain their immutable evidence. This recipe changes qualification design; it does not restart architecture or alter current user-facing UI.

## 6B and reversibility

- Borrow the accepted source-verification, two-pass, Linux bounds and browser evidence machinery.
- Bend the benchmark from three bitrate-only outputs to a controlled resolution pair plus GOP comparison.
- Break the unsupported inference that nominal bitrate or720 labels prove the operator's method.
- Beget measured payload matching and separate player-selection evidence.
- Bide production ladder, thresholds and unverified encoder controls until this evidence supports them.
- Build only the three bounded experimental outputs after exact recipe review.

Local drafts and argument data are reversible. Encoding consumes compute and any permitted origin request cannot be undone; bound and record both. Private artifacts can be retained or discarded, but failed evidence is preserved. No externally consumed derivative or production pointer changes in this qualification; later publication requires its separate reviewed release train. Existing user authorization covers this bounded work; independent recipe review is a quality gate, not a new user permission request.
