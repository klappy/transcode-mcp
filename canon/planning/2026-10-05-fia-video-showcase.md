---
title: FIA video showcase — useful detail at field-friendly download sizes
date: 2026-10-05
status: working
mode: planning
derives_from: canon/planning/2026-10-05-video-single-baseline.md
---

# FIA video showcase — useful detail at field-friendly download sizes

> Add one video showcase to the existing transcode homepage navigation, centered on the FIA Guide use case: retain useful visual detail while reducing the cost of taking teaching resources into the field. Compare the same Jordan River asset in five visible cards: published high-quality source, original small FIA bundle, and optimized Small480p, Medium540p and Large720p H.264 outputs. Preserve exact identities and disclose that the measured Large example is larger than the old low-resolution bundle; lower-target sizes remain unmeasured.

## Summary — One real resource, five visible comparisons

Add `/bench/video`, linked alongside Image bench and Audio bench using their existing navigation and visual language. This is a transcode showcase, not an FIA application redesign or an encoder-settings playground. Group the five contain-fit players into a clear comparison story: first the published720p source beside optimized Large720p, then the original low-resolution bundle beside optimized Small480p, followed by Medium540p as a prominent balanced option. Each pair uses equally sized players; narrow screens preserve that same paired reading order. Keep all five visible. Attach the matching size/detail tradeoff to its pair instead of separating it from the videos. Medium is positioned as a practical middle choice, not an experimentally proven universal quality optimum. Provide explicit Play, accessible names, native controls, and no media `src` or preload fetch before selection. Playing one pauses the others. A compact table presents exact bytes, dimensions, duration, and provenance; caption each source clearly. The separately accepted three-delivery-target contract governs480p mono,540p stereo and720p stereo qualification. This page authorizes no additional encode, alternate codec, cadence selector or custom resolution. Do not hide the three optimized targets behind a selector or scatter them across an undifferentiated grid. Lower-target byte counts/durations/quality claims remain unavailable until actual qualification, never calculated placeholders presented as measured results.

The first example is FIA's Jordan River video, a13. Existing source review is immutable at cookbook commit `56979f7463879b01ccdde18f6a36102d779c9680`, [a13 source review](https://github.com/klappy/fia-app-cookbook/blob/56979f7463879b01ccdde18f6a36102d779c9680/evidence/2026-10-05-video-source-review-a13.json). Individual asset version is1.0.4, collection version1.1.2. Preserve Word Collective attribution, [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), and adaptation notice from that reviewed rights record; do not label public hosting as public domain.

## Evidence — Compare exact retained artifacts

| Role | Bytes | Dimensions | SHA-256 |
| --- | ---: | --- | --- |
| Published HQ source | 49,851,846 | 1280×720 | `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718` |
| Original FIA bundle | 2,547,817 | 400×224 | `47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8` |
| Actual verified DEV baseline | 5,509,514 | 1280×720 | `d9ff4ef21cfa27bd62f31c69949b12a0b39e5be2f1bd06fc59b0500ea1f61184` |

Source duration is79.153seconds; the actual optimized probe is79.168seconds. Final displayed duration must come from each exact retained probe, not copy source duration into every row. HQ URL is `https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4`; original bundle is `https://fiaguide.app/assets/jordan-river.mp4`. Large optimized playback uses the existing same-origin `/video/preset=fia,q=medium,f=mp4/` route with that HQ URL. Small and Medium use the new explicit size selector only after its accepted implementation and actual output qualification. The displayed output identity must match the actual tier's verified output; the DEV row above is evidence, not a fabricated promise of identical cross-platform encoder bytes.

This output is about88.95% smaller than HQ but about2.16times the old bundle. Previously inspected matched scenes at10/40/70seconds show finer foliage than the old bundle at equal display size. Revalidate decoded frames for the exact showcase output; stills do not establish whole-motion, listening, or physical-phone equivalence. No universal quality score or unsupported network-time promise.

## Timing and Cloudflare delivery — Show measured work and reuse

For each encoded target, show actual encode/mux duration with pass-one/pass-two breakdown available in the evidence details. Keep first-request end-to-end wait distinct from encode time, and cached delivery transfer time distinct from both. Every displayed measurement is tied to the actual output, runtime/tier and measurement scope. Source and old-bundle references are not generated by this service: show encode time as not applicable, not zero. Small/Medium times remain pending until measured. Timing from one sample is an observation, not a universal latency or time-to-first-frame guarantee.

Explain the deployed delivery path plainly: first explicit Play requests the Cloudflare Worker; on a miss the bounded container verifies source, encodes, verifies output and stores it in R2; subsequent requests reuse that verified R2 object through the Worker with byte-range playback/seeking. `X-Transcode-Cache: HIT` describes the stored derivative, not proof of a geographic CDN edge-cache hit. Current video responses use `Cache-Control: public, max-age=0, must-revalidate`; do not claim immutable browser caching, edge residency, zero Worker/container activity, progressive second-pass streaming, or measured worldwide latency. Illustrate one-time work versus repeated delivery, with actual timings and source/settings-bound identity. The source and bundled references pass through their fixed proxy routes without re-encoding.

## Field impact — Real maps, explicit arithmetic

Independently rehashed retained first-pack source maps have these sizes: c1687,735,008B; c1976,712,636B; c2016,646,608B; c2021,065,016B. Their accepted optimized derivatives are341,548B,316,396B,196,190B,149,218B respectively. Thus this roughly79-second optimized video is smaller than each of the first three source maps, but not the fourth and not any of those optimized maps. Say exactly that, rather than claiming all maps are larger.

Show per-resource download arithmetic: HQ→optimized saves44,342,332bytes; old bundle→optimized adds2,961,697bytes for additional detail. For an offline pack, substitute this one resource in a measured inventory: `new pack total = measured current pack total − old video bytes + verified optimized video bytes`. Label totals conditional until a concrete manifest is selected and counted. An optional60-minute calculator scales only this measured clip average: approximately250.5MB optimized versus2.267GB HQ, labeled an estimate with content-dependent results and no claim that a downloadable60-minute pack exists. The optimized frame contains about10.3times as many pixels as the original bundle; pixel count is not a perceptual-quality score. A hypothetical10-copy example may be labeled arithmetic only, never ten distinct corpus videos or a measured whole-corpus saving. Do not extrapolate one clip to68pericopes, languages, or resource counts.

## Delivery — All five through the proxy without falsifying originals

Current `/video` transforms only accepted HQ contracts; routing HQ through it cannot serve the unmodified source. Existing image/audio no-option passthrough has unsuitable semantics and lacks request Range forwarding. Do not misuse those routes or fetch originals directly in the browser.

Propose a narrow reference handler `/reference/video/a13-source` and `/reference/video/a13-bundled`. These two fixed IDs map to the two exact URLs above; no user URL parameter, redirects, extra hosts, origin fallback, encoder dispatch, new storage, or arbitrary open proxy. GET/HEAD/OPTIONS only. Forward only a validated single byte range and the accepted origin validator; reject multipart or malformed ranges. Require actual MP4 MIME, expected total length, consistent Content-Range and status200/206/416 semantics. The bundled origin currently omits Content-Length on HEAD: that method alone may use the pinned reviewed expected length after matching its strong validator; full/range GET must still verify actual response length and the full publication proof must hash the bytes. Never treat HEAD as content verification; stream at most the accepted full size or requested range length, cancel on overrun/disconnect, and bound header acquisition25seconds and complete transfer120seconds. Apply CORS and expose the useful range/length/identity headers, never upstream cookies/auth headers.

Before publication, perform one bounded full byte verification of each reference through this handler and record its upstream strong validator. Pin the reviewed strong origin validator into each fixed reference configuration. Every GET, HEAD and Range request uses If-Match with that exact validator;412 or a response-validator mismatch fails closed. Never refresh it automatically. The opaque ETag, including an S3 multipart ETag, is not a SHA: the bounded full verification binds validator to the separately computed source SHA. Conditional requests must prevent silently serving changed source content; if the origin lacks a usable stable validator, hold this reference route rather than pretending that a streaming length check proves its SHA. Whole-file hashes are evidence from that actual full verification; arbitrary partial ranges cannot independently prove a whole-file SHA. Test changed validator, wrong length/MIME, redirect, malformed/unsatisfiable range, overrun and cancellation. No buffering50MB merely to hash before first playback. No source or optimized media fetch on page load, navigation or metadata rendering.

## Acceptance — Useful page, bounded routes, unchanged encoding

Owned implementation paths after acceptance: new demo-video HTML/TypeScript wrapper, existing demo navigation/home links, narrowly registered reference route/helper with focused tests, and source-pinned showcase metadata. No container/recipe/cache-owner/audio/image changes. Follow existing build embedding and homepage routes rather than add a service or framework.

Verify desktop and390px layout, keyboard controls, selected-only media network, source/bundle full bytes and representative ranges, optimized actual tier identity, native decoded playback and matched contain-fit frames. Present image/map context without downloading maps on page load. Preserve source attribution in the page and metadata. Existing image/audio/MCP and video ownership tests remain required; deploy sequentially DEV→staging→production with actual per-tier evidence. This proposal does not itself claim route readiness, production availability, offline FIA replacement, or iPhone support.

## Reversal and prior decisions

Remove only the new page links/route if it fails; existing media delivery and caches remain intact. Borrow existing bench navigation and retained evidence; bend the narrative toward FIA field use; break no encoder contract; beget only a fixed comparison page; bide unsupported source-validator or physical-device claims; build the smallest source-identity-preserving reference route. H.264-only policy remains authoritative; this is a delivery demonstration, not renewed codec experimentation.


## Collaborative presentation — operator clarification, 2026-10-05

Frame this as a shared-resource comparison with collaborators, never “theirs versus ours.” Use neutral visible labels: **720p source**, **Optimized720p**, **Existing compact version224p**, **Optimized480p**, and **Balanced540p**. Do not use “Their224p,” “Our480p,” or “OUR OFFERING.” Keep the accepted pairs and equally sized players:720p source beside Optimized720p; Existing compact version224p beside Optimized480p; Balanced540p separately visible. Normalized spacing in rendered labels is expected.

The existing compact file is one measured version of this specific resource, not evidence of an industry-wide typical compression method or of collaborators' general quality. Discussion of typical approaches must not turn that one file into an unsupported benchmark for an entire organization or industry. Describe measured resolution, bytes, timing and visible differences directly; preserve Word Collective attribution, licensing, source identities, qualification limits and all recorded measurements. This wording clarification changes no media, encoder settings, playback gate or release evidence.


## Bounded deployed reference diagnostic — 2026-10-05

The first deployed DEV source-reference request returned502 before media delivery, while prior local real-origin full/range proofs passed. The cause is unproven. Add one bounded structured failure event per request to the existing reference handler: finite transport stage and finite reason codes only, with no source URL, request headers, response body, raw exception text, tokens or arbitrary user input. Distinguish fetch, signal check, header validation, hash initialization, response construction and body streaming. Preserve all validator, byte, hash, cancellation and timeout checks and the generic client-facing error. Tests must prove upstream exception secrets cannot enter the event. Existing Cloudflare logs supply the read path; no new service, storage, origin fallback or codec change. Use actual deployed evidence to choose any later fix rather than weakening validation.


### Observed Workers redirect incompatibility

The actual local workerd runtime with deployed compatibility date2025-05-01 and the same three flags rejects Fetch `redirect:error` with a TypeError before contacting the origin. The reported cause is unsupported redirect mode, not a source-validator failure. Use `redirect:manual` in the fixed reference handler and retain the existing strict expected200/206 status validation: any3xx response fails closed without following Location or issuing a second fetch. Preserve fixed source URLs, If-Match, MIME/length/range/hash checks and generic client errors. A focused test must verify manual mode, rejection of302, and exactly one fetch. This is a compatibility repair, not authorization for redirect following or an origin fallback. Root then ran the actual local workerd probe with only manual redirect mode changed: both fixed-source HEAD requests returned200 with the pinned validators and expected49,851,846 /2,547,817-byte lengths. The initial pre-reload failure was retained separately. This confirms the compatibility cause without proving full deployed delivery. Subsequent exact-handler and deployed reference proof remain required before availability claims.


## Current reference delivery decision — R2, 2026-10-05

The operator explicitly replaces live-origin reference delivery with retained objects in the existing tier R2 bucket. This decision supersedes the live-origin reference handler, conditional origin requests, range slicing and pending redirect diagnostic/repair as the showcase's delivery path. Keep their failure/proof history; do not ship unnecessary origin transport fixes for this page. All five showcased videos are served from R2 through the existing Worker: two exact retained references and three qualified optimized derivatives. Follow [fixed reference R2 storage](2026-10-05-fixed-reference-r2.md). No source rewrite, new bucket/service, automatic origin fallback, encoder invocation or media preload is introduced.
