# Sovee display tier and encoded resolution proposal

Status: local planning proposal, 5 October 2026. No implementation, encoding, deployment or adaptive-streaming readiness is claimed. This records the latest user direction; it does not silently amend existing released profiles.

## User direction and source limits

A display tier labeled **720** should use an encoded height of **912** when an adequate source exists. Ideally the source has at least 912 vertical pixels and sufficient horizontal resolution after respecting its actual display aspect. A 720-pixel source cannot supply new detail through upsampling. For the current a13 1280×720 source, this proposal therefore does not establish a higher-detail 912 rendition. Preserve the existing source-limited result or explicitly label any experimental upscale; never market interpolated pixels as captured detail.

The user observed water-color changes and motion jumps in the source itself. This is a user observation, not an independently verified diagnosis or proof that compression introduces no additional artifacts. Source/candidate comparisons must use matching time positions.

## Separate the three controls

- Display tier is the intended player/quality label.
- Encoded canvas is the actual coded width and height, with explicit pixel aspect ratio (SAR) and display aspect ratio (DAR).
- Bitrate budget is attached to the display tier's approved budget policy, not automatically increased with encoded pixels.

The earlier one-/two-lower-rung budget concept remains a policy relationship requiring a named ladder. Neither “half step” nor pixel interpolation establishes a historically approved numeric ladder. The following lower-tier mappings are **proposed arithmetic**, not user-confirmed values. They approximately apply the requested 912/720 scale factor, then choose an aligned canvas and exact 16:9 DAR. The user-specified anchor is 720→912; validate the other rows before implementation.

| Display tier | Proposed encoded raster | SAR (pixel width:height) | DAR | Status |
|---|---|---|---|---|
| 320 | 704×400 | 100:99 | 16:9 | Proposed mapping, not accepted numeric ladder |
| 480 | 1088×608 | 152:153 | 16:9 | Proposed mapping, not accepted numeric ladder |
| 540 | 1216×688 | 172:171 | 16:9 | Proposed mapping, not accepted numeric ladder |
| 720 | 1616×912 | 304:303 | 16:9 | User height anchor; proposed width/SAR |

These are coded dimensions, not browser intrinsic dimensions; browsers may expose SAR-adjusted dimensions. Actual encoder/container/player support must be verified before adopting any row. A source with insufficient detail should not be enlarged merely to satisfy the table. Portrait or other-aspect sources require an explicit fit policy; this table covers 16:9 only.

Keep each tier's currently approved video budget, audio policy and peak/buffer policy unchanged for a resolution-only comparison. Encoding a larger canvas is not authorization to multiply its bitrate by pixel area. Conversely, retaining the tier budget does not prove equal quality or feasible encode time. The exact relationship to a one- or two-lower-step budget must be recorded by named tier rather than inferred from these numbers.

## Current frame-rate instruction

The user now requests a clean-divisor cap of **30 fps for the current policy**: 50→25, 60→30, and rates already ≤30 remain unchanged. Drop frames; do not blend or synthesize them. Fractional/VFR and other rates require explicit deterministic handling before implementation; do not silently round 29.97 to30 or assume every input is50/60. Bind the selected frame-rate policy to output identity. This is a policy update, not a claim that deployed assets have already changed.

## Deferred adaptive delivery

A proposed initial one-second speed test can seed a conservative starting choice. The measurement needs explicit byte/time accounting and may be biased by connection setup, cache state and short samples; it is not a guaranteed sustained-bandwidth measurement.

Future adaptation can use buffered playback seconds and play-clock progress to move down on repeated buffer depletion/stall risk and up only after sustained headroom. Exact thresholds, hysteresis, switching boundaries and compatible tracks are unresolved. Switching should not restart playback or oscillate between tiers.

Manifest/chunk delivery and seamless adaptive switching are deferred architecture, outside the current release. The current complete-file verification/cache path is not a chunked adaptive pipeline. No new manifest protocol, segment production, automatic bandwidth probe or client switching behavior is authorized for implementation by this planning document alone; existing task authorization governs subsequent work.

## Cost interpretation

The [cost report](2026-10-05-fia-video-cost-rubric.md) uses measured 50 fps outputs or older 50 fps timing proxies, with the 320 sample measured on different CI hardware. It does **not** measure the new ≤30 fps cap or these larger encoded canvases. Fewer frames may reduce work, larger canvases may increase it, and neither effect can be priced by an assumed linear factor. Retain the existing estimate as a labeled historical planning scenario until relevant measurements exist; no further encode is requested here.

## Historical higher-resolution source lead

The following paragraph records the earlier metadata-only discovery, retained as history. Subsequently the video-only4K acquisition and approved-AAC composite were separately verified; that composite is not a publisher-original master and its provenance/qualification remain separate from this mapping proposal.

The public [Jordan River YouTube player](https://www.youtube.com/watch?v=AmunLtggLUI), by Video Bible Dictionary, advertised a 3840×2160 VP9 rendition at 50 fps on 5 October 2026. Its 79-second duration is consistent with the current 79.153-second FIA resource, but does not establish byte or edition identity. This is player-format metadata, not a downloaded/decoded master. The actual description distinguishes the music-bearing YouTube edition from a shareable source-video/voiceover edition and directs users to contact the publisher for CC BY-SA 4.0 delivery. A licensed 4K master URL is not yet established. Retain the approved 720p source until the higher-resolution source and its reuse terms are bound to the existing source ledger. No claim is made that every playlist video is 4K.
