---
title: FIA video showcase — useful detail at field-friendly download sizes
date: 2026-10-05
status: working
mode: planning
derives_from: canon/planning/2026-10-05-video-single-baseline.md
---

# FIA video showcase — useful detail at field-friendly download sizes

> Add one video showcase to the existing transcode homepage navigation, centered on the FIA Guide use case: retain useful visual detail while reducing the cost of taking teaching resources into the field. Compare the same Jordan River asset in five visible cards: published high-quality source, original small FIA bundle, and our Small480p, Medium540p and Large720p H.264 outputs. Preserve exact identities and disclose that the optimized video is larger than the old low-resolution bundle.

## Summary — One real resource, five visible comparisons

Add `/bench/video`, linked alongside Image bench and Audio bench using their existing navigation and visual language. This is a transcode showcase, not an FIA application redesign or an encoder-settings playground. Provide five equally sized, contain-fit players with explicit Play, accessible names, native controls, and no media `src` or preload fetch before selection. Playing one pauses the others. A compact table presents exact bytes, dimensions, duration, and provenance; caption each source clearly. The separately accepted three-delivery-target contract governs480p mono,540p stereo and720p stereo qualification. This page authorizes no additional encode, alternate codec, cadence selector or custom resolution. Keep all five comparators visible rather than hiding our three targets behind a selector; narrow screens stack the same five cards. Lower-target byte counts/durations/quality claims remain unavailable until actual qualification, never calculated placeholders presented as measured results.

The first example is FIA's Jordan River video, a13. Existing source review is immutable at cookbook commit `56979f7463879b01ccdde18f6a36102d779c9680`, [a13 source review](https://github.com/klappy/fia-app-cookbook/blob/56979f7463879b01ccdde18f6a36102d779c9680/evidence/2026-10-05-video-source-review-a13.json). Individual asset version is1.0.4, collection version1.1.2. Preserve Word Collective attribution, [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), and adaptation notice from that reviewed rights record; do not label public hosting as public domain.

## Evidence — Compare exact retained artifacts

| Role | Bytes | Dimensions | SHA-256 |
| --- | ---: | --- | --- |
| Published HQ source | 49,851,846 | 1280×720 | `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718` |
| Original FIA bundle | 2,547,817 | 400×224 | `47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8` |
| Actual verified DEV baseline | 5,509,514 | 1280×720 | `d9ff4ef21cfa27bd62f31c69949b12a0b39e5be2f1bd06fc59b0500ea1f61184` |

Source duration is79.153seconds; the actual optimized probe is79.168seconds. Final displayed duration must come from each exact retained probe, not copy source duration into every row. HQ URL is `https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4`; original bundle is `https://fiaguide.app/assets/jordan-river.mp4`. Large optimized playback uses the existing same-origin `/video/preset=fia,q=medium,f=mp4/` route with that HQ URL. Small and Medium use the new explicit size selector only after its accepted implementation and actual output qualification. The displayed output identity must match the actual tier's verified output; the DEV row above is evidence, not a fabricated promise of identical cross-platform encoder bytes.

This output is about88.95% smaller than HQ but about2.16times the old bundle. Previously inspected matched scenes at10/40/70seconds show finer foliage than the old bundle at equal display size. Revalidate decoded frames for the exact showcase output; stills do not establish whole-motion, listening, or physical-phone equivalence. No universal quality score or unsupported network-time promise.

## Field impact — Real maps, explicit arithmetic

Independently rehashed retained first-pack source maps have these sizes: c1687,735,008B; c1976,712,636B; c2016,646,608B; c2021,065,016B. Their accepted optimized derivatives are341,548B,316,396B,196,190B,149,218B respectively. Thus this roughly79-second optimized video is smaller than each of the first three source maps, but not the fourth and not any of those optimized maps. Say exactly that, rather than claiming all maps are larger.

Show per-resource download arithmetic: HQ→optimized saves44,342,332bytes; old bundle→optimized adds2,961,697bytes for additional detail. For an offline pack, substitute this one resource in a measured inventory: `new pack total = measured current pack total − old video bytes + verified optimized video bytes`. Label totals conditional until a concrete manifest is selected and counted. An optional60-minute calculator scales only this measured clip average: approximately250.5MB optimized versus2.267GB HQ, labeled an estimate with content-dependent results and no claim that a downloadable60-minute pack exists. The optimized frame contains about10.3times as many pixels as the original bundle; pixel count is not a perceptual-quality score. A hypothetical10-copy example may be labeled arithmetic only, never ten distinct corpus videos or a measured whole-corpus saving. Do not extrapolate one clip to68pericopes, languages, or resource counts.

## Delivery — All five through the proxy without falsifying originals

Current `/video` transforms only accepted HQ contracts; routing HQ through it cannot serve the unmodified source. Existing image/audio no-option passthrough has unsuitable semantics and lacks request Range forwarding. Do not misuse those routes or fetch originals directly in the browser.

Propose a narrow reference handler `/reference/video/a13-source` and `/reference/video/a13-bundled`. These two fixed IDs map to the two exact URLs above; no user URL parameter, redirects, extra hosts, origin fallback, encoder dispatch, new storage, or arbitrary open proxy. GET/HEAD/OPTIONS only. Forward only a validated single byte range and the accepted origin validator; reject multipart or malformed ranges. Require actual MP4 MIME, expected total length, consistent Content-Range and status200/206/416 semantics; stream at most the accepted full size or requested range length, cancel on overrun/disconnect, and bound header acquisition25seconds and complete transfer120seconds. Apply CORS and expose the useful range/length/identity headers, never upstream cookies/auth headers.

Before publication, perform one bounded full byte verification of each reference through this handler and record its upstream strong validator. Pin the reviewed strong origin validator into each fixed reference configuration. Every GET, HEAD and Range request uses If-Match with that exact validator;412 or a response-validator mismatch fails closed. Never refresh it automatically. The opaque ETag, including an S3 multipart ETag, is not a SHA: the bounded full verification binds validator to the separately computed source SHA. Conditional requests must prevent silently serving changed source content; if the origin lacks a usable stable validator, hold this reference route rather than pretending that a streaming length check proves its SHA. Whole-file hashes are evidence from that actual full verification; arbitrary partial ranges cannot independently prove a whole-file SHA. Test changed validator, wrong length/MIME, redirect, malformed/unsatisfiable range, overrun and cancellation. No buffering50MB merely to hash before first playback. No source or optimized media fetch on page load, navigation or metadata rendering.

## Acceptance — Useful page, bounded routes, unchanged encoding

Owned implementation paths after acceptance: new demo-video HTML/TypeScript wrapper, existing demo navigation/home links, narrowly registered reference route/helper with focused tests, and source-pinned showcase metadata. No container/recipe/cache-owner/audio/image changes. Follow existing build embedding and homepage routes rather than add a service or framework.

Verify desktop and390px layout, keyboard controls, selected-only media network, source/bundle full bytes and representative ranges, optimized actual tier identity, native decoded playback and matched contain-fit frames. Present image/map context without downloading maps on page load. Preserve source attribution in the page and metadata. Existing image/audio/MCP and video ownership tests remain required; deploy sequentially DEV→staging→production with actual per-tier evidence. This proposal does not itself claim route readiness, production availability, offline FIA replacement, or iPhone support.

## Reversal and prior decisions

Remove only the new page links/route if it fails; existing media delivery and caches remain intact. Borrow existing bench navigation and retained evidence; bend the narrative toward FIA field use; break no encoder contract; beget only a fixed comparison page; bide unsupported source-validator or physical-device claims; build the smallest source-identity-preserving reference route. H.264-only policy remains authoritative; this is a delivery demonstration, not renewed codec experimentation.
