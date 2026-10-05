---
title: One source-bound FIA video adapter in the existing proxy
date: 2026-10-04
status: draft
mode: planning
derives_from: canon/planning/2026-05-26-worker-container-boundary.md
complements:
  - canon/constraints/definition-of-done.md
  - canon/governance/deploy-architecture.md
---

# One source-bound FIA video adapter in the existing proxy

> Add one real H.264/AAC MP4 recipe for the verified Jordan River source, using the existing Worker, ffmpeg container and tier-isolated R2. Bound source fetching and encoding, fail closed instead of passing video through, and prove exact cache/range/browser behavior before FIA consumes it. Cold conversion waits for a completed artifact; the shared progressive-pipe extension remains separate. This is a proposed contract, not deployment evidence.

## Summary — One video, one recipe, existing service

Source a13 is now measured as1280×720,79.153seconds,49,851,846bytes, SHA256257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718. Its exact published URL is https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4. Root's Chrome154 playback/seek and an independent10second frame comparison show materially sharper detail than the bundled400×224 copy; this is not whole-video acoustic or physical-device evidence. VideoBibleDictionary revision1c02713d022bd96a29c78f5b75455315d6d35a6e, eng/json/008.content.json binds a13 version1.0.4 and MRK1:1–13; eng/metadata.json declares Word Collective2025 CC BY-SA4.0. Preserve attribution, license and transformation notice in the derivative descriptor.

Add the minimum typed video request, recipe, bounded container path and R2 range response. Reuse AUDIO_CONTAINER and AUDIO_BUCKET with a video-v1 prefix, without renaming audio keys or provisioning another service. Existing audio/image behavior and all existing tests remain. The first release accepts only this source URL/SHA pair; arbitrary-source video and additional presets remain unavailable rather than unbounded.

## Problem and inspected installation

Problem: FIA currently hides video until manual offline download because the shared proxy has no actual video adapter. Users need selected video playback without mandatory durable download, through the same proxy, with a sharper verified original. House installation inspected: klappy/transcode-mcp checkout source/video-proxy at6ee81eb6e0e96b516136d97521d6b3ed2079d981; existing audio Worker/container/R2 is the concrete reuse precedent. World prior: no external analogue claimed; this slice reuses that inspected house installation. Fresh GitHub open-PR inventory returned no open PRs on this repository; historical telemetry S1 claim is bounded and does not by itself establish current ownership. Recheck before public code push.

## Proposed request and identity

Add /video/preset=fia,q=medium,f=mp4/{source_url} as a newly implemented route, not an existing capability. Resolve source identity from a versioned server-side allowlist containing the exact URL and SHA above; callers cannot invent a trusted source hash. MCP adds video to its typed media vocabulary and emits only supported video options. Invalid combinations return400; unapproved source returns403; saturation503; failed source/encode502. No video passthrough success fallback.

Video cache key is SHA256 of canonical versioned fields: exact source URL and expected source SHA, recipe fia-video@1, codec libx264, container mp4, no-upscale720p bound, CRF23, preset medium, yuv420p, original frame cadence, optional AAC96k stereo audio, faststart, and deployed encoder/recipe revision. A change to any output-affecting field changes the video key. Output metadata records actual source/output SHA, bytes, MIME, duration, width/height, codecs, recipe and rights source. Existing audio keys remain untouched.

## Container recipe and hard bounds

Extend the existing container with a video-specific module; keep ffmpeg flags as recipe data. Proposed arguments select the first video stream and optional first audio stream, libx264 preset medium CRF23, yuv420p, aspect-preserving even dimensions no larger than1280×720 with no upscaling, AAC96k stereo when audio exists, and +faststart MP4. Test the exact argument list against the deployed Debian ffmpeg build before accepting it; missing libx264 or invalid output is a failure, not an optimized claim. Do not fabricate an audio stream for a silent source.

Fetch the approved source once into bounded temporary storage while hashing: exact expected49,851,846bytes and SHA must match. HTTPS only, redirect hops individually checked, approved terminal host/path only; never let ffmpeg fetch an unchecked URL. Use local verified file input and disable network protocols for ffmpeg. Limits:60MiB source,60MiB output,120second source timeout, five-minute encode timeout, one concurrent video job per container, bounded request body8KiB and stderr64KiB, ten-minute total sample/job cap. Enforce limits while data arrives, not merely Content-Length. Abort/kill/reap and clean temporary data on failure; never expose partial output as ready.

Container probes verified source and actual output, validates dimensions/format and duration preservation within250milliseconds of the measured source duration (currently browser-observed79.153seconds; use source ffprobe for the encode check), and returns bytes plus measured metadata. A size/time limit must abort and mark failure rather than produce an accepted shortened MP4; a syntactically valid but short output is rejected, with a regression fixture. The cache encoder revision must identify the actual pinned/tested container build and ffmpeg version, not an invented constant; include it in the recipe identity and evidence. Worker stores the complete artifact under its immutable video identity before marking ready. R2 metadata and published descriptor retain both source and derivative hashes; storage failure is explicit and does not claim durable cache readiness.

## Completed artifact delivery and consumer boundary

Support GET and HEAD, CORS, Content-Length, ETag, Accept-Ranges, and one byte Range:206 with exact Content-Range/bytes or416 when unsatisfiable. Test suffix/open-ended bounds and reject multipart ambiguity. On a cold miss, finish conversion before returning the requested range; do not claim progressive cold-start video. Browser tests must prove advancing playback, seeking, cancellation and exact optional offline bytes through this proxy, not a direct-origin bypass.

FIA's future selected-Play adapter must bind this NEW1280×720 source SHA and upstream a13 version separately. It must not claim the derivative came from the historical400×224 pack source hash47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8. Preserve immutable pack text/history and add a reviewed source-replacement mapping carrying both identities and attribution. No source-content rewrite to disguise that difference. Existing media selection/consent/cancellation/cache ownership is reused. Offline saving remains optional and verifies the finalized derivative. No eager video fetch on catalog/select/restore.

## Alternatives, evidence and rollback

Real transformation in the existing service is chosen over a second proxy (duplicate infrastructure) and passthrough-only (explicitly rejected by the user). Progressive ffmpeg pipes use this same lifecycle later, but implementing that first adds streaming container/header/backpressure work before the first video can be proven. The initial complete-artifact response is disclosed honestly.

Success requires existing typecheck/unit/smoke tests, new parser/key/allowlist/bounds/range tests, actual Linux/container ffmpeg sample and metadata, source/output frame inspection, browser play/seek and verified cache/offline evidence. Reject if source hash changes, material detail is lost unacceptably, bounds fail, range bytes differ or audio/image behavior regresses. Roll back the additive route/recipe and leave isolated video objects unreferenced; do not rewrite existing artifacts. Public bytes and consumed compute cannot be undone, so local/container evidence precedes sequential deployment.

## Ownership and deployment remain exact

Proposed implementation owner is the FIA video lane, independent nonauthor reviewer and root merger. Changes are limited to video option/key/recipe/bounds/range modules, narrow parser/MCP/Worker/container dispatch, adjacent tests and this canon/DoD addition. The historical telemetry S1 claim is not a perpetual lock. Its S2 planned Worker createServer overlap must be checked against live open work before editing that hunk; no unrelated telemetry/config changes belong here.

Current wrangler.toml and CI use development(main)→staging→production; deploy-architecture.md still describes an older preview stack. Resolve that documentation discrepancy against actual connected projects before deployment. Preserve Workers Builds-only deployment and separate tier R2/DO classes; no Actions deploys or new infrastructure. No deployment is authorized by this draft. Required Oddkit challenge was observed, not called a PASS; run exact canon audit/phase gate and independent review before implementation proceeds.

## Optimization qualification correction


The existing bounded service baseline remains evidence, not the optimized delivery recipe. Reuse its exact approved a13 source once per qualification run, source SHA/provenance, temp-job lifecycle, H.264 compatibility, range/cache checks and independent frame/browser review. No new service or adaptive architecture.

Qualification compares three explicitly experimental lower-class budgets: 450k,750k and1000k video average, each with AAC96k stereo, target480-line display and720-line encoded canvas (1.5× display height, actual source already720). Approximate79.153s total payload budgets before mux overhead are5.40MB,8.37MB and10.84MB. These numbers are candidate measurements, not historical canon defaults or promised visual acceptance. Add2% mux allowance to the measured byte gate. Keep original frame cadence and yuv420p; no fabricated sharpening or source upscaling in this specific sample.

Use libx264 two-pass bitrate allocation, unique private passlogs shared within each candidate job. Both passes use the same geometry and bounded VBV parameters: maxrate twice target; bufsize twice maxrate (two-second reservoir). No -minrate claim: FFmpeg's libx264 adapter does not map rc_min_rate, so this candidate implements target average plus VBV ceiling/buffer, not the historical four-part scheme's independently enforced positive minimum. Record that limitation explicitly. A low-motion scene may spend fewer bits; do not add filler and call it improved quality.

Use a maximum GOP derived from30seconds of verified source frame rate, min-keyint1 and scenecut60 as a measured sensitive candidate. x264's source compares pcost >= (1-bias)*icost with bias increasing with its scenecut setting: higher values are more aggressive; zero disables. This corrects the generic historical “low threshold” wording for this encoder. Keep the built-in low-resolution cost/flash suppression; do not call me_range a coarsened scene-detector window. No equivalent independently tunable spatial-window mapping has been verified, so this third historical triangle leg remains unimplemented and disclosed. Compare keyframe timestamps to actual cuts and inspect within-scene false positives; long-GOP random-seek cost must be measured in the browser.

The entire three-candidate benchmark shares one ten-minute deadline (including its one acquisition and evidence probes); each candidate also has a five-minute combined encoder allowance. All retain the60MiB input/output ceiling and bounded request/stderr. Enforce a32MiB per-file passlog ceiling using prlimit for pass1, plus64MiB aggregate passlog ceiling (only the expected log/mbtree files, including temporary names); pass2 retains output prlimit. The qualification directory budget is384MiB total: one60MiB source, three retained outputs of at most60MiB each,64MiB active passlogs, at most36 frame JPEGs of at most2MiB each, and8MiB total JSON/log metadata. Passlogs are hashed and their settings retained before cleanup between candidates; output/frame evidence is retained. Reject unexpected stats files or any aggregate ceiling breach. A pass failure/time limit leaves no published derivative. Passlog identity and both argument arrays are captured in evidence; output cache recipe is a successor version only after one candidate passes review.

Acceptance: actual Linux encoder logs prove both passes and settings, source fetched/hash-verified once and reused, measured output average/bytes within declared budget allowance, duration within250ms, unchanged resolution/cadence/audio presence, no invalid truncation; frame/cut comparison at480-line display and fullscreen; advancing playback, long-GOP seeks, range/offline byte fidelity. Choose the smallest candidate that meets the approved visual floor. If none passes, preserve evidence and adjust only the budget rather than merge an unreviewed default. The cold complete-file waiting behavior remains disclosed; progressive pipes remain a separate shared-service extension.

Primary mechanism references: repository exploration TSV rows9/20/23 and journal bounded-two-pass/GOP sections; https://ffmpeg.org/ffmpeg.html (-pass/-passlogfile); https://raw.githubusercontent.com/mirror/x264/master/encoder/slicetype.c (scenecut_internal); https://raw.githubusercontent.com/mirror/x264/master/x264.c (--scenecut help); https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/libx264.c (rate-control mapping, no rc_min_rate mapping). Pin actual installed build/settings in output evidence; current upstream source inspection is not a claim that CI's binary is identical to master.

Qualification correction: first Linux benchmark9802257 failed safely when the actual50fps source produced an8,388,608-byte mbtree temporary passlog at44.98seconds. Preserve that failed receipt. Increase only the passlog budget to32MiB per file/64MiB aggregate and total artifact cap384MiB; encoding parameters remain unchanged. Validate first-pass encoder settings from the actual stats #options header (the null muxer does not print that header to stderr); preserve both passlogs and stderr hashes. This is a qualification-bound correction, not visual acceptance.
