---
title: Fixed showcase references in existing tier R2
date: 2026-10-05
status: working
mode: execution
derives_from: canon/planning/2026-10-05-fia-video-showcase.md
---

# Fixed showcase references in existing tier R2

> Store the two already verified source references in the existing tier R2 bucket. Serve every showcase video through the Worker from R2, with no live-origin reference request or fallback.

## Fixed identities and custody

Only two reference IDs are supported:

| Route ID | Bytes | SHA256 | Deterministic R2 key |
| --- | ---: | --- | --- |
| a13-source |49,851,846|`257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718`|`video-reference-v1/257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718.mp4`|
| a13-bundled |2,547,817|`47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8`|`video-reference-v1/47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8.mp4`|

The root operator seeds already retained, independently verified exact files once per tier. Recompute local bytes and SHA before upload; do not fetch the source again or re-encode. Bind object custom metadata to reference ID, source SHA, bytes, original source URL, asset a13/version1.0.4, publisher Word Collective, CC BY-SA4.0 and the immutable source review. Set HTTP content type video/mp4. Object bodies are immutable by policy: reject a conflicting existing object; an exact already verified object can be reused without overwrite. Verify uploaded object bytes/SHA and metadata before recording readiness. R2's native opaque ETag is not asserted equal to SHA256.

Source attribution remains [the accepted immutable review](https://github.com/klappy/fia-app-cookbook/blob/56979f7463879b01ccdde18f6a36102d779c9680/evidence/2026-10-05-video-source-review-a13.json). Retain actual source URL metadata; never relabel the optimized derivative as the original reference. Use existing per-tier R2 binding and the sequential DEV→staging→production train, with recorded object identity per tier. No public upload API or new storage service.

## Fixed read route

Preserve `/reference/video/a13-source` and `/reference/video/a13-bundled`; map only these two IDs to the fixed keys. GET, HEAD and OPTIONS only. Unknown IDs/query overrides fail; malformed or unsatisfiable single ranges return416 with correct total. Multiple ranges fail. Use the existing range parser and R2 range reads; do not buffer either full video in Worker memory. HEAD returns reviewed object metadata without retrieving a body. GET serves a fresh independent R2 body, returning200 or206 and exact Content-Length/Content-Range. Abort/cancel closes the consumer body without changing the stored object.

Validate R2 size and required identity metadata against the fixed contract before serving. Missing objects return503 unavailable, unknown IDs404, and mismatched identity fails closed. Never fall back to the origin, invoke encoding, refresh metadata or modify the object from this read route. Expose CORS, range/length and an explicit expected-source-SHA header. Use a documented response ETag derived from the pinned verified SHA, separately distinguished from R2's opaque storage ETag. Keep revalidation policy rather than claiming geographic CDN edge-cache coverage.

## Proof and bounds

Unit tests cover fixed key dispatch, missing/mismatched objects, methods, HEAD without body, full reads, prefix/middle/suffix ranges,416 and cancellation. Mock an origin fetch to throw if called; no code path should call it. Actual tier proof binds seeded full bytes/SHA and metadata, verifies both fixed routes' HEAD/GET/range, then browser advancing playback and seek. This is existing-byte upload and delivery validation, not permission for extra encoding. Preserve previous origin502 and local redirect findings as historical evidence, not a current availability claim.

The page remains manual Play with no media source/preload on initial render. All five cards retain neutral shared-resource framing and existing pairs. Reference readiness is distinct from three derivative qualification; activate only when all five actual tier identities and required browser checks pass. No physical-phone, acoustic or offline FIA pack replacement claim follows merely from R2 delivery.

## Reversal

Disable the new reference route/page playback if validation fails. Keep retained objects and historical evidence; do not delete caches or restore automatic live-origin fallback. Owned changes are the fixed reference helper/tests and existing Worker binding seam only. Encoder, three-target recipes, cache-owner pipeline and other media handlers remain unchanged.
