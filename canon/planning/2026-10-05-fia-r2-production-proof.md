---
title: FIA production R2 delivery measurements
date: 2026-10-05
status: active
mode: evidence
derives_from: canon/planning/2026-10-05-fixed-reference-r2.md
---

# FIA production R2 delivery measurements

> Five versions of the same Jordan River resource are stored in R2 and served through the Worker on explicit Play. The original 720p and compact 224p files are unchanged; Small 480p mono, Medium 540p stereo and Large 720p stereo are the only optimized targets. No video preloads or additional codec experiments.

## Measured production outputs

Runtime commit `c6ab972a0996537f87f5cc8bd76c4e654af7b339`, Git-connected build `4983cd3d-6bd8-49c6-9d49-19229442d130`, Worker `1042ac89-896e-46b3-bb8a-869655e99313`, container image `e7a6168b49c323ed5264194bd125bac00f46bc4903588e9b86cc441e331d8080`. These are actual Cloudflare production measurements, distinct from the retained Linux CI comparison and earlier production 0.4.0 observation.

| Target | Bytes | Encode/mux | First complete request | Cached complete request |
| --- | ---: | ---: | ---: | ---: |
| Small 480p, mono | 2,564,228 | 34.823 s | 40.030 s | 0.905 s |
| Medium 540p, stereo | 3,203,638 | 36.326 s | 39.551 s | 0.910 s |
| Large 720p, stereo | 5,508,450 | 53.409 s | 61.347 s | 0.976 s |

Each optimized file is 79.168 seconds, H.264/AAC, full source cadence of 50 fps. Encode/mux comes from the same R2 object's encoding metadata; complete-request timings are wall time from one client and include transfer. They are not first-frame latency, billed CPU time, a performance guarantee or proof of a geographic CDN edge-cache hit.

Output SHA256: Small `19195e93cd9ba96aa920d23b94fddd5a0c9ccb12cc8c18af8224da39b4e2d9c5`; Medium `f0b39072378b5ca7ad77236f50981e779274cabc3d7d39b374fd7d6210ece610`; Large `7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15`.

The reference files remain 49,851,846 bytes / SHA256 `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718` and 2,547,817 bytes / SHA256 `47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8`. Seed retained bytes once, verify full R2 readback, then publish provenance sidecars. Reference routes perform no origin fallback or encoding.

## Validation and limits

DEV, staging and production each passed full HTTP hashes, HEAD, byte ranges, optimized cache reuse, complete local decoding, and actual desktop Chrome playback with advancing time and seeking. Actual source/encoder/recipe identities and packet rates were reconciled with R2 metadata. Three production jobs each recorded both successful passes and cleanup. Documentation, image and retained audio regressions passed. Existing unchanged ownership proof remains separate; no new exactly-once or crash guarantee follows.

The original CI run's missing-SAR assertion failure remains preserved. Its retained Large output was subsequently checked by full decode and MP4 display dimensions; it was not re-encoded or relabeled as a successful original CI run. Production file measurements above bind the actual served outputs, not those CI files.

Use neutral shared-resource labels: source 720p beside optimized 720p, existing compact version beside optimized 480p, then the 540p middle option. All preserve the river scene's teaching context in the reviewed still; fine detail and visible compression differ. This is one resource, not a general ranking of collaborators or a universal quality guarantee. Physical iPhone, listening, motion-quality acceptance and actual FIA offline-pack replacement remain distinct from desktop delivery proof.

The five-player showcase activation is a separate UI release, using these exact production measurements. Preserve manual Play, no media source before selection, one active player, attribution and expandable evidence. H.264-only and the three targets remain the chosen baseline; reopen codec or frame-rate experiments only when a concrete use case justifies their costs.
