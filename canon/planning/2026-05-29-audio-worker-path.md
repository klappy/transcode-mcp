---
title: "Audio Worker Path — Bring /audio to Image Parity via Container + R2, Codec Negotiated by <source>"
date: 2026-05-29
status: working
mode: planning
derives_from: canon/planning/2026-05-26-url-vocabulary-and-presets.md
complements:
  - canon/planning/2026-05-26-worker-container-boundary.md
  - canon/planning/2026-05-27-audio-container-recipes.md
applied_canon:
  - klappy://canon/principles/vodka-architecture
  - klappy://canon/methods/quality-attribute-tension-survey
  - klappy://odd/constraints/anti-cache-lying
---

# Audio Worker Path — Bring /audio to Image Parity via Container + R2, Codec Negotiated by <source>

> `/audio/*` is still passthrough (`X-Transcode-Encode: passthrough-pending-container`) while `/image/*` is fully built. Bring audio to parity by wiring the Container + ffmpeg + R2 path the canon already specifies. On a cache miss the Worker computes an R2 output key `sha256(source-identity + preset + q + codec)`, checks `AUDIO_BUCKET`, and on miss calls the `AudioContainer` Durable Object with `(source_url, preset, q, codec)`; the container streams source to encoded audio and returns the bytes; the Worker writes them to R2 and serves them. Parity means the same completeness and the same caller contract as images: lazy transcode, rich `X-Transcode-*` headers, passthrough fallbacks, MCP surface, tests. Parity does not mean the same mechanism: audio keeps R2 content-addressing rather than the image Cache API, because a container transcode is expensive enough to persist. iOS is a hard requirement, so codec is a negotiated axis. Opus in Ogg is the byte-optimal default and now plays on Safari 18.4+; AAC in MP4 is the fallback for the older-Safari tail this audience over-indexes on; the browser self-selects through a multi-`<source>` `<audio>` element because audio carries no reliable `Accept` header the way images do. Music bitrates are 64/96/128k (the recipes-doc numbers); voice stays 8/16/32k. AAC bitrates and the real-world listening tune land after structural parity, not before.

---

## Summary — Wire the Container Path the Canon Already Specified; Negotiate Codec by <source>

The image pipeline reads source dimensions through `env.IMAGES`, applies half-class overshoot, negotiates format from `Accept`, caches in the Cache API, and returns descriptive headers. The audio handler does none of that yet — it fetches the source and hands it back unchanged. This document is the plan to close that gap.

The engine is a Cloudflare Container running ffmpeg, because the Cloudflare Media binding emits AAC/M4A with no bitrate, sample-rate, or channel controls, and this project minimizes bytes against a quality floor. The cache is R2, content-addressed, because the transcode costs real CPU and should be paid once per distinct output. The Worker owns the URL grammar, the cache key, and the R2 read/write; the container owns ffmpeg and the recipe table and nothing else, per the worker/container boundary.

Codec becomes a fourth option on the audio URL (`f=opus|aac|mp3`, default `opus`). The reason is iOS: Ogg-Opus reaches roughly 97% of web traffic and, as of Safari 18.4 (iOS/iPadOS 18.4, macOS 15.4, ~April 2026, per testmuai.com's Opus support guide), plays in Safari's `<audio>` element. The gap that remains is Safari below 18.4, which the offline-translation audience over-indexes on because its devices update slowly. AAC covers that tail. Because `<audio>` requests do not send a useful `Accept` header, the negotiation lever is a multi-`<source>` element for interactive embeds and an explicit `f=` for offline packaging, where the packaging app already knows the target device.

Music bitrates resolve to the recipes-doc numbers (64/96/128k), superseding the url-vocabulary table's 64/128/192k. Voice (8/16/32k) already agrees across the canon and the measured cost matrix. The exact AAC bitrates and the native-aac-versus-libfdk decision wait on a listening test, which the operator can run on real iOS and Android hardware after the structural path is live.

---

## Problem — Images Are Done, Audio Is Passthrough

`src/worker.ts` `handleImageProxy` is the reference: parse, Cache API lookup, source fetch, `env.IMAGES.info()`, half-class encode width, `transform().output()`, `cache.put()` under `ctx.waitUntil`, and headers reporting source size, encode size, binding result, quality, and format. It also degrades gracefully — passthrough when no options are present and passthrough with `X-Transcode-Encode: no-binding` when `env.IMAGES` is absent in local dev.

`handleAudioProxy` fetches the source and returns it with `X-Transcode-Encode: passthrough-pending-container`. The R2 bucket and the container/Durable Object bindings are commented out in `wrangler.toml`. The MCP `AUDIO_GUIDANCE` string admits that preset and q are recorded but not applied. The six libopus recipes exist in `canon/planning/2026-05-27-audio-container-recipes.md` but have never been run in a container or verified against a sample file. The README's "Optimized FFmpeg audio transcoding" claim is therefore false and is corrected as part of this work.

## What Parity Means Here (and What It Does Not)

Parity is the completeness bar and the caller contract, measured against the image path:

- Lazy transcode on first request; cached result on every request after.
- A descriptive `X-Transcode-*` header set that lets the demo and the case study tell the byte-savings story.
- Passthrough fallbacks for the no-options case and the no-binding (local dev) case.
- An MCP surface that produces a working embed and truthful guidance.
- Unit, container, and smoke evidence per the Definition of Done.

Parity is explicitly not mechanism-identical. Images cache in the Cloudflare Cache API and store no variants, which is correct when the transform is a near-free binding call. Audio caches in R2, content-addressed, because a container transcode is not free and Cache-API eviction would re-run ffmpeg and pay the CPU twice. Copying the image cache substrate onto audio would violate the cost function this project optimizes.

## Decision 1 — Engine and Cache: Container + ffmpeg + R2

The transform engine is a Cloudflare Container running ffmpeg with libopus and an AAC encoder. Cloudflare Containers reached general availability in April 2026 with active-CPU billing; each container is fronted by a Durable Object and started on demand. The cache is an R2 bucket, `AUDIO_BUCKET`, with objects keyed by content and an R2 lifecycle rule for 90-day eviction after last access, bounding storage cost. `wrangler.toml` gains the `[[r2_buckets]]` block and the container/Durable Object binding; `worker.ts` gains `AUDIO_BUCKET` and `AUDIO_CONTAINER` on the `Env` interface.

## Decision 2 — Dispatch: Worker Owns the Key, Container Returns Bytes

On an `/audio/*` miss the Worker computes the output key, reads `AUDIO_BUCKET`, and on miss calls the `AudioContainer` Durable Object with `(source_url, preset, q, codec)`. The container fetches the source, runs the recipe, and returns the encoded bytes plus `ffprobe` metadata (duration, bitrate, sample rate, channels). The Worker writes the bytes to R2 under `ctx.waitUntil` and streams them to the caller.

This reconciles the two canon docs that currently disagree. `2026-05-26-worker-container-boundary.md` has the Worker pre-stage the source into R2 and pass an R2 key; `2026-05-27-audio-container-recipes.md` has the container fetch the source URL and write the output. The reconciled rule keeps the output in R2 (recipes doc) and keeps the key and the R2 writes in the Worker binding (boundary doc), while dropping the source pre-stage, which would route the full source through the Worker and R2 before any transcode and pay bytes twice. The container stays credential-free and ignorant of the cache key, which keeps it inside the vodka boundary. The boundary doc is updated to say the Worker writes the output, not the source.

## Decision 3 — Codec Is Negotiated; iOS Gets AAC, Everyone Else Gets Opus

Audio gains `f=opus|aac|mp3` with `f=opus` as the default. Opus is the byte-optimal codec at voice bitrates and is the reason this proxy beats a naive copy. Browser reality as of May 2026: Ogg-Opus plays on Chrome, Firefox, Edge, Opera, Samsung Internet, and Safari 18.4+; it does not play on Safari 18.3 and earlier; Opus in MP4 does not play on Safari's `<audio>` element in any version. AAC and MP3 play everywhere Apple ships.

Delivery splits by use case:

- **Interactive embed.** The MCP tool returns a multi-`<source>` element: `<audio><source type="audio/ogg" src="…f=opus…"><source type="audio/mp4" src="…f=aac…"></audio>`. The browser picks the first type it supports. Only the chosen codec is ever transcoded. No User-Agent sniffing.
- **Offline packaging.** The translation app pins `f=opus` for Android and current iOS and `f=aac` for the older-iOS tail, because it knows the target device at bundle time.

`f=auto` exists as a best-effort single-URL convenience that resolves by User-Agent in the Worker, biased to AAC when the agent is ambiguous, on the principle that a larger file that plays beats a smaller file that does not. It is the fallback path, not the recommended one, because audio lacks the `Accept` signal the image path relies on and version sniffing is brittle. This is a real asymmetry with images and is recorded as such: same goal, different lever, for a principled reason.

## Decision 4 — Bitrates: Recipes-Doc Numbers Win

Music resolves to 64k at 44.1kHz (low), 96k at 48kHz (medium), 128k at 48kHz (high). This supersedes the url-vocabulary table's 64/128/192k and matches both the recipes doc and the measured `data/pricing/audio-codec-matrix.tsv` (music opus at 128k). 192k spends bytes a phone listener cannot perceive, against the cost function. Voice stays 8k at 8kHz voip (low), 16k at 16kHz (medium), 32k at 24kHz (high), which already agrees across the canon. `2026-05-26-url-vocabulary-and-presets.md` is edited to the resolved music numbers and to add the audio `f=` row.

AAC bitrates cannot reuse the opus numbers; AAC at 8–16k voice is unacceptable. The starting hypothesis is roughly 32/48/64k mono for voice and 96/128/192k stereo for music, with the native ffmpeg `aac` encoder for license cleanliness and `libfdk_aac` (HE-AAC, better at low voice bitrate) held in reserve if the listening test rejects native at the low end. These numbers are open until the test.

## Response Contract — Headers and Fallbacks at Image Parity

Headers on a transcoded response: `X-Transcode-Cache` (HIT/MISS/PASS), `X-Transcode-Encode` (`opus`/`aac`/`mp3`/`passthrough`/`no-binding`), `X-Transcode-Preset`, `X-Transcode-Quality`, `X-Transcode-Bitrate`, `X-Transcode-SampleRate`, `X-Transcode-Channels`, `X-Transcode-Duration` (seconds, forwarded from the container's ffprobe; preserved by transcode, so source and every variant share one length), source and output byte counts, a `Content-Type` of `audio/ogg`, `audio/mp4`, or `audio/mpeg` matching the real output, and `Cache-Control: public, max-age=31536000, immutable`. Fallbacks mirror images: no options yields passthrough; missing R2 or container binding yields passthrough with `X-Transcode-Encode: no-binding`; a transcode error yields 502 or 500 with `X-Transcode-Error`. The no-binding fallback is what keeps `wrangler dev` usable without a container.

## MCP Surface Changes

The `generate_transcode_url` tool already emits `preset` and `q`. Two changes: the `f` parameter, currently an image-only enum (`auto`/`webp`/`jpeg`), accepts the audio codecs or branches by `media_type`; and the audio `embed` becomes the multi-`<source>` element above instead of a single `<audio src>`. `AUDIO_GUIDANCE` drops the passthrough disclaimer and describes preset, q, and codec selection.

## Alternatives Considered

- **Engine.** ffmpeg.wasm inside the Worker was rejected: the cost matrix prices the Workers-WASM route near 3x the container and notes "route long jobs to containers not workers," and Worker wall-time caps make long recordings risky. An external transcode service was rejected: it adds a dependency, egress, and state, which the project is explicitly not.
- **Cache substrate.** The Cloudflare Cache API (the image mechanism) was rejected for audio: eviction re-runs the container and pays CPU twice. R2 content-addressing persists the expensive artifact.
- **Dispatch.** Worker-pre-stages-source-to-R2 was rejected on the cost function (bytes paid twice). Container-writes-R2-directly-with-S3-credentials was rejected because it puts credentials and cache-key knowledge inside the container, past the vodka boundary.
- **Codec delivery.** Opus-only was rejected because iOS below 18.4 cannot play it and iOS is required. AAC-only was rejected because it discards opus's byte advantage at voice bitrates, which is the project's reason to exist. User-Agent `auto` as the primary path was rejected as brittle and kept only as a convenience fallback; the multi-`<source>` element lets the browser decide.

## Risks and Reversibility

- **Cold start.** Containers start on demand, so the first request for a given output pays start latency. The lazy plus R2 design confines that cost to the first request per `(source, preset, q, codec)`; the offline-packaging batch amortizes it, and the interactive demo can pre-warm or show a spinner per `canon/planning/2026-05-29-demo-cold-start-race.md`.
- **Older-iOS tail.** Covered by the AAC `<source>`; the browser self-selects, so no device is left without a playable file.
- **AAC low-bitrate voice quality.** Unknown until the listening test; the native-versus-libfdk decision rides on it. Held open deliberately.
- **Scope-creep breakage.** Prior canon-parity ships in the oddkit ledger landed their scope and also broke an adjacent thing. Mitigation: the image path is not touched, and the audio path ships behind the existing passthrough fallback, so a container failure degrades to today's behavior rather than erroring.
- **Cost.** The matrix measures music opus near $0.0000217 per audio-minute in a container; R2 with 90-day lifecycle GC bounds storage. R2 stays a pure binding (no dependency); the container image is a separate build artifact that does not touch `bun.lock`. The Worker does take one new npm dependency — `@cloudflare/containers` — which supplies the `Container` Durable Object base class and the `getContainer()` dispatch helper that the official Cloudflare Containers API requires; it is the idiomatic, reversible way to wire the DO and was accepted via an oddkit challenge during Slice 1 rather than hand-rolling the DO plumbing.

Reversibility is high. Every piece is additive behind a fallback, and reverting to passthrough is removing two bindings and one handler branch.

## Success Criteria

- `/audio/preset=voice,q=medium,f=opus/<src>` returns `audio/ogg` opus, mono, 16k at 16kHz, smaller than source, `X-Transcode-Encode: opus`, `Cache: MISS` then `HIT` on repeat with no second container invocation.
- `/audio/preset=voice,q=medium,f=aac/<src>` returns `audio/mp4` AAC that plays on a Safari build below 18.4.
- Every preset that ships produces `ffprobe`-verified output whose duration, bitrate, sample rate, and channels match the recipe table; this is the evidence that graduates the recipes doc from `working` to `stable`.
- The MCP audio embed is a multi-`<source>` `<audio>` element carrying both opus and AAC URLs.
- The image path behaves identically before and after (regression guard).
- Local dev with no bindings degrades to passthrough with `X-Transcode-Encode: no-binding`.
- `bun run typecheck`, `bun test`, and `smoke-mcp.ts` (extended with a live `/audio` fetch) all pass.

## Phasing

- **Phase 0 — Canon (this doc plus reconciliation).** Land this plan, reconcile the dispatch model and music bitrates, and correct the README and ARCHITECTURE audio claims.
- **Phase 1 — Container and recipes.** Dockerfile (ffmpeg, libopus, aac), a minimal server resolving `(preset, q, codec)` to a recipe in a data table, and the per-preset `ffprobe` evidence. Graduates the recipes doc.
- **Phase 2 — Worker wiring.** Bindings, `Env`, the `handleAudioProxy` rewrite (key, R2 get/put, dispatch, headers, fallbacks, defaults of `preset=voice`, `q=medium`).
- **Phase 3 — Surface, tests, demo.** MCP guidance and multi-`<source>` embed, unit tests for key determinism and recipe resolution and defaults, the smoke `/audio` fetch, and an optional audio row on the case-study page.
- **Phase 4 — Real-world validation and tune (operator, after parity).** Listening tests on real iOS and Android hardware set the final AAC bitrates and the native-versus-libfdk call. Structural parity does not wait on this.

## Canon Reconciliation Required

- `2026-05-26-worker-container-boundary.md`: the Worker writes the output to R2, not the source.
- `2026-05-26-url-vocabulary-and-presets.md`: music bitrates to 64/96/128k; add the audio `f=` row.
- `2026-05-27-audio-container-recipes.md`: expand from six opus recipes to opus plus AAC; status stays `working` until the listening test supplies evidence.
- `README.md` and `ARCHITECTURE.md`: correct the audio status from "optimized ffmpeg audio transcoding" to the real state until Phase 2 lands.
