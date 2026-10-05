---
title: Apply the three existing video profiles to all three approved sources
date: 2026-10-05
status: working
---

# Apply existing profiles to the approved source set

> Use one source-by-size catalog for a13, a184 and a10 with the existing Small480, Medium540 and Large720 settings. A container adapter change creates a new encoder identity for every combination, including the five already supported ones. Preserve old objects and qualify new identities before updating any app or showcase binding.

## Summary

Current source reads confirm that both `container/video.mjs` and `src/lib/video.ts` select Large for all three approved source URLs but restrict Small/Medium to a13. The parser and MCP already understand the closed three-size vocabulary. Generalize only source/profile selection; no new profiles, dimensions, codecs, FPS policy or service. Current cache-concurrency repair must complete its release train first.

## Small implementation surface

Use one shared pure catalog/selector module, consuming the existing three source contracts and two lower-profile templates. Large returns its existing source-specific contract unchanged. For a13 Small/Medium return the existing exact template unchanged. For a184/a10 lower profiles compose a selected contract from the same profile encoding/limits and the selected source's exact URL/SHA/bytes/provenance; update transformation wording to the selected raster/channels. A canonical extension recipe revision applies to the four newly supported source/profile contracts. Do not claim those outputs qualified just because the composition is valid.

Worker and container import that same catalog selection rather than each growing asset-specific branches. Keep the source allowlist closed to the three exact ledger URLs and size enum closed to small/medium/large. Omitted size and explicit Large remain identical selected contracts. The helper must be pure data selection; it must not fetch sources, compute bitrate ladders dynamically, publish media, choose substitutes or accept arbitrary dimensions.

Expected files: shared catalog module plus focused catalog tests; small selection imports in `container/video.mjs` and `src/lib/video.ts`; Docker COPY for the shared module; source×size parser/MCP/cache tests; update the existing private integration verifier's a13-only lower-size assumption. Include the shared selector module SHA in encoder identity, alongside the existing actual video.mjs/executable/libraries/selected-contract identity. This makes transitive code custody explicit; do not quietly remove adapter hashing to preserve cache hits. No worker routing, bucket, instance-count, UI or FFmpeg argument changes are needed.

## Existing profiles and source evidence

| Profile | Raster / SAR | Video requested / class bps | AAC bps / channels |
| --- | --- | --- | --- |
| Small |854×480 /1280:1281|200000 /200000|42667 / mono|
| Medium |960×540 /1:1|253125 /253125|54000 / stereo|
| Large |1280×720 / existing declaration|439024 /450000|96000 / stereo|

All retain H264/yuv420p,50fps, two passes, existing GOP1500/min1/scenecut60, VBV and safety ceilings. All three retained HQ sources were independently measured1280×72050fps; source durations are79.153s,56.453s and55.857s. Accepted source ledger `0c6b18ce07914c6e61f8827a536836c0d0bfbcfb198f876d38aaa4f041d1836d` binds all three. The extension does not transfer a13 perceptual acceptance to the other subjects.

## Honest identity and release cost

Current support is five combinations: a13 Small/Medium/Large plus a184 Large and a10 Large. Generalization adds four combinations, for nine total. Because current encoder identity hashes all of video.mjs, even a routing-only modification changes every existing encoder revision/key. Adding the shared-module hash also changes the identity formula honestly. There is no legitimate automatic alias from old keys to new ones, and no guarantee new bytes match older outputs across runtime hardware.

The smallest complete public qualification is nine new verified identities per tier. Sequential DEV→staging→production therefore has an upper baseline of27 cold publications if none of the new keys exist. This is nine reused profile/source combinations on three deployments, not27 experimental variants. Count actual cache hits separately; do not force a miss by deletion. No automatic CI encode or additional nine-output CI comparison is proposed: unit/type/catalog tests run first, and root-owned tier qualification supplies actual encoder/decode/delivery evidence. If an isolated CI proof is later required, name and count it separately.

Retained source inputs total79,606,153bytes (49,851,846+18,665,321+11,088,986). Current published Large files total13,281,010bytes, but new outputs/lower profiles must be measured. Nine times the16MiB app cap is a conservative144MiB retained-output bound per tier, not a predicted size. Acquire sequentially in bounded resumable batches; never start all nine on the five-slot pool. Root schedules separate bounded windows as needed; timeout/failure is preserved, no automatic retry or capacity expansion.

Before each tier: stable exact build/Worker/container identity and expected new keys; no active rollout. For every source×size: one necessary cold GET or truthful existing HIT, full SHA/bytes, actual codec/cadence/raster/SAR/channels/duration, full decode, actual video-rate±5% gate, canonical R2 source/contract/encoder/recipe metadata, then HEAD/prefix range/HIT and real browser selected playback/aspect/seek. Keep Large unspecified-SAR exception scoped to its existing verified track-display+browser gate. Source-specific sampled teaching quality and audio/motion caveats remain visible.

## Downstream cutover

Production qualification yields nine actual descriptors. Update the app's schema3 catalog with all nine video variants, including newly identified defaults for all three videos. Do not insert old output SHA under new identity. Existing audio/image variant work is independent; the151 audio/image paths imply302 additional Low/High slots before any accepted reuse, and that work does not eliminate these nine video gates.

The showcase's three optimized a13 paths remain textually the same but now select new encoder identities. Replace all three measured SHA/bytes/durations/timings and evidence bindings from production, update calculated statistics and exact browser manifests. Five reference/source comparator bytes remain unchanged. Check posters still correspond to the selected source/frame; no new poster encode is required merely because an identity changed unless visual evidence shows content changed.

The fixed-artifact showcase cutover described below must precede generalized service activation. The forthcoming alpha13 catalog waits for the new nine qualified outputs.

## Tests and reversal

Test all nine selections, exact old five selected-contract equality, distinct source/size keys, omitted/explicit Large equivalence, mismatched source metadata rejection, unknown URL/size rejection, unchanged arguments/profile values and shared Worker/container selected-contract equality. Retain concurrent cached-range and cold-owner tests. A mismatched catalog, unqualified identity or old manifest discrepancy blocks activation.

Reversal restores the prior adapter/catalog release and corresponding app/showcase manifests. Keep all old R2 objects/evidence; no cache deletion, fabricated revision, cross-identity alias or per-asset special-case fallback. Root owns deployment and data publication. This proposal records impact only; no code or encoding has been performed.

## Fixed-artifact cutover keeps the showcase playable

Preserve all five current comparison players throughout the migration. Freeze the three already-qualified production a13 optimized outputs as explicit immutable comparison references using the existing fixed-reference R2 handler. These are historical qualified artifacts, not aliases claiming the new encoder produced old bytes. Their encoder evidence, measured sizes/timings, posters and labels retain the actual qualified production scope.

Use new closed reference IDs `a13-small-qualified-v1`, `a13-medium-qualified-v1`, `a13-large-qualified-v1`, exact production bytes/hashes:

| ID | Bytes | SHA256 |
| --- | ---: | --- |
|a13-small-qualified-v1|2564228|19195e93cd9ba96aa920d23b94fddd5a0c9ccb12cc8c18af8224da39b4e2d9c5|
|a13-medium-qualified-v1|3203638|f0b39072378b5ca7ad77236f50981e779274cabc3d7d39b374fd7d6210ece610|
|a13-large-qualified-v1|5508450|7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15|

Root uploads retained verified production bytes to each existing tier's `video-reference-v1/<SHA>.mp4`, verifies complete readback, and publishes per-entry provenance sidecars last. Total copied optimized bodies11,276,316bytes per tier/33,828,948 across three tiers; zero new video encodes. Prefer this over pointing each tier at its former canonical cache keys: tier outputs differ, whereas identical fixed production artifacts make the displayed production measurements truthful everywhere.

Extend the fixed registry with three data records and exact per-record review evidence. Existing two source-reference records retain their current evidence binding; the optimized records bind an immutable published production-output qualification record. The legacy sidecar field `sourceReview` must match the selected record's exact evidence URL, which for optimized artifacts is output qualification, not merely source rights. Do not accept arbitrary supplied review URLs or source URLs. Record the original HQ provenance and transformation in that qualification evidence. R2-only HEAD/GET/ranges retain exact size/SHA-derived ETag/MIME/storage-ETag validation and no origin/encode fallback.

Change only the three showcase media URLs to the new fixed-reference routes, with copy disclosing that the comparison uses these qualified artifacts; preserve current measured data, native controls, layout and two original reference URLs. Seed all three tiers before publishing code that uses the new paths. Prove all five reference routes and actual native playback before advancing. Source-specific cold encoder API qualification proceeds separately afterward; old API objects remain untouched.

The app's live alpha12 has no published video descriptors, so its new alpha13/schema3 catalog can wait for the nine newly qualified encoder outputs without invalidating a deployed video catalog. The showcase no longer follows that mutable API identity during qualification. No source/byte rewrite or forged revision is involved. Existing consumers of the generic encode API still receive its truthful new identity; this addendum protects the actual published comparison page and forthcoming app catalog only.
