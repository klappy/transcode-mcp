---
title: Three FIA delivery targets with proportional audio
date: 2026-10-05
status: working
mode: planning
derives_from: canon/planning/2026-10-05-natural-video-budget-frame-rate.md
---

# Three FIA delivery targets with proportional audio

> Support three explicit FIA delivered sizes: Small480p with mono audio, Medium540p with stereo audio, and Large720p with stereo audio. Scale nominal audio and video budgets together, retain H.264/AAC and full50fps, and qualify exactly three bounded a13 outputs. Delivered size is separate from encoding quality; existing720p medium-quality URLs do not change meaning.

## Summary — User-selected delivery choices

This concrete FIA use case supersedes the earlier480/720-only decision and the unpublished one540 isolation draft. The latest request intentionally changes audio alongside raster/video rate; these are delivered-package comparisons, not video-only isolated quality experiments. Implement generalized target selection after cookbook acceptance and qualification, without new codecs, FPS experiments, auto benchmark loops or app navigation changes. Existing baseline delivery/reliability promotion proceeds separately first.

## Target contract — Explicit derivation, no old-file-size target

The accepted natural-budget document records the known720canvas/nominal450000bit/s pair and explicitly proposes `450000 × (height/720)^2` for lower canvases. It does not establish a historical540rung or universal perceptual optimum. Reuse that documented interpolation. Audio scales from nominal72096,000bit/s by the same nominal video ratio; do not mistakenly divide by the a13-specific actual439024 request correction. Round audio to the nearest integer bit/s for FFmpeg `-b:a`, which accepts integer bit-rate values; these are ABR requests, not guaranteed packet rates.

| Delivered target | Encoded raster / display aspect | Video request | Nominal class | Audio request / channels | VBV max / buffer |
| --- | --- | ---: | ---: | --- | --- |
| Small |854×480,SAR1280:1281 for16:9 |200000bit/s |200000 |42667bit/s, mono |400000 /800000 |
| Medium |960×540,square pixels |253125bit/s |253125 |54000bit/s, stereo |506250 /1012500 |
| Large |1280×720,square pixels |439024bit/s |450000 |96000bit/s, stereo |900000 /1800000 |

The existing Large actual request439024 is retained unchanged, not rounded silently to450000. Small audio is `96000×200000/450000=42666.666…`, rounded42667; Medium is exactly54000. Native AAC is not restricted to MP3's discrete nominal rate table. Encoder acceptance and actual achieved rates remain measured gates. Mono Small is explicitly requested: document the downmix and assess speech intelligibility; no claim that reduced channels universally preserve music/spatial fidelity.

All targets use50fps, libx264 medium, yuv420p, two-pass ABR, Lanczos scaling, GOP1500frames/30s,min-keyint1,scenecut60, AAC at the same established sample rate, full source timeline, MP4 faststart. Use explicit `-ac 1` only for Small; `-ac 2` for Medium/Large. No Opus, HEVC, AV1 or cadence change. Audio comes from the same verified HQ source; it cannot be stream-copied unchanged into lower proportional rates. Record each AAC payload/timing identity separately rather than require equality across intentionally changed audio.

## Source and execution — Exactly three qualified outputs

Use retained a13 HQ49,851,846B,SHA256 `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718`,79.153s,1280×720/50fps. Keep Word Collective CC BY-SA4.0 attribution, asset1.0.4 and adaptation notice. No new source download is necessary. Reuse an existing Large output only if its exact source/settings/executable/library/adapter identity matches the accepted target; otherwise one explicit Large control is allowed within the three-output maximum. No duplicate Large encode merely for presentation.

At most one new two-pass job per target, three total outputs maximum. Each complete encode/mux job≤300s with process termination/cleanup; source/output≤60MiB each; pass logs≤32MiB each/64MiB total; stderr≤64KiB; retained experiment directory≤768MiB counting partial files. Reserve capacity before each job. Shared active window≤30minutes: refuse new work unless300s+30s cleanup reserve fits; terminate at the common cap. Preserve failed results; no automatic retry or rate search. Pin actual executable/libraries/adapter, target recipe revision, source and output identities in every receipt. No provider calls, speech generation or extra source videos.

## Delivery API — Add size without changing quality

Add an optional video `size=small|medium|large` selector to the existing proxy option parser, MCP URL generator and source-bound contract lookup. Omitted size maps to Large and must preserve the current contract/key/output behavior exactly. `q=medium` remains encoding quality and must not become a synonym for540p. Existing accepted quality/format restrictions remain. Explicit Large canonicalizes to the same current Large contract/key; Small/Medium have distinct full target contracts, encoder-bound cache keys and source identities. The offered video target set is closed: only Small480, Medium540 and Large720. Reject unknown sizes, FullHD,4K and any arbitrary video width/height/resolution override at every interface before encoder dispatch; there is no advanced/custom video bypass. Existing generic image width/height controls remain unchanged. Audio budget/channels are derived automatically from the selected target, with mono only for Small; no independent audio tuning selector. Reject conflicting supplied video dimensions rather than ignore them. Extend deterministic admission to full source+target contract; same target joins, different targets never share bytes or metadata.

The first supported source remains a13 for these new targets; existing a184/a10 omitted-size Large behavior is unchanged. Unsupported source/size combinations fail truthfully, never silently select another raster. Generalized data-driven target selection does not authorize encoding all sources. Showcase uses these three delivered targets after qualification; unchanged HQ and old bundled references remain comparison context, not additional encoded target variants. FIA application binding, automatic viewport choice and offline pack policy are separate integrations; no automatic bulk download.

## Acceptance — Package usefulness and exact accounting

Probe actual width/height/SAR/fps/channels/sample rate, source/output duration, packet bytes/rates, mux overhead, hashes, peak disk/time and source attribution. Rates are requested ABR values: a video target miss over5% is diagnostic and holds claims about the intended budget; a later correction needs one explicitly reviewed measured successor. Report actual audio bitrate rather than hiding low-rate encoder deviation. No total-size promises from nominal arithmetic.

Compare decoded matched10/40/70s frames and motion at equal390px and480px contain-fit players, plus listening to the same excerpts for intelligibility and stereo/downmix tradeoffs. Do not infer listening or physical-device support from browser decode success. Show per-target actual file bytes and qualified dimensions, exact source/recipe/output identity, and truthful latency/cache state. Smaller files are useful only if teaching detail and speech remain acceptable; retain failures and do not label a rejected target ready.

Test parser/MCP size semantics, absent-size backwards compatibility, cache/admission separation, all three source-bound contracts and unsupported combinations. Real proxy HTTP/range/cache/disconnected-owner and browser playback gates follow the existing sequentialDEV→staging→production train; no new deployment mechanism. Publish no target readiness before actual accepted outputs. Close this bounded qualification after deciding which targets meet the FIA need; no further variations are scheduled.

## Reversal — Preserve the reliable baseline

Disable new Small/Medium selection if qualification fails; omitted-size Large remains unchanged. No baseline cache deletion or source replacement. Borrow existing recipe/owner pipeline, bend target data and audio channels, break no old URL meaning, beget three explicit delivered choices, bide automatic app selection, build no codec expansion.
