# Selected-C pipeline extension: a184 and a10

Status: private cookbook/server-canon proposal for independent review. No encode, deployment, application binding, or output qualification is authorized by this draft. Preserve accepted a13 recipe and qualification unchanged.

## Decision and source authority

Extend the existing bounded two-pass `fia-video@2` implementation with two explicitly allowlisted source contracts. Reuse its validation, Linux resource limits, encoder identity, private quarantine, canonical R2 publication, cancellation, and range-serving paths. Do not add arbitrary URL or preset support. The existing a13 source contract, settings, and source qualification remain byte-identical. The encoder identity includes the complete adapter SHA, so a reviewed source-lookup adapter change intentionally creates a new encoder revision and cache key, including for a13. Preserve that binding; do not weaken adapter identity to reuse an old cache key. Cached bytes may be reused only under an exactly matching verified contract and encoder identity. Outputs under the new adapter revision require actual output qualification before readiness; prior a13 measurements remain historical evidence, not acceptance of newly identified bytes.

The accepted source-only ledger is SHA256 `0c6b18ce07914c6e61f8827a536836c0d0bfbcfb198f876d38aaa4f041d1836d` (5150 bytes). Its immutable source-review receipts are at cookbook commit `56979f7463879b01ccdde18f6a36102d779c9680`, paths `evidence/2026-10-05-video-source-review-a184.json` and `evidence/2026-10-05-video-source-review-a10.json`. These establish source identity and attribution only, never derivative acceptance.

| Asset | Exact published source | Bytes | SHA256 |
|---|---|---:|---|
| a184, Sandals | https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4 | 18665321 | `6e792600f8e6befa70a81f19f70358b0b9dae7f2f791325e0b4103335425fa4f` |
| a10, Wilderness/Desert | https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4 | 11088986 | `a8bbc6a9cb9a603f4cd61217f066ead1bbcd4b72ce2fe27652747f22a3713254` |

Pinned publisher metadata: `BibleAquifer/VideoBibleDictionary@1c02713d022bd96a29c78f5b75455315d6d35a6e`; a184 `eng/json/015.content.json`, SHA256 `f5084d0a8d3487b9a0bc6335c92ca71635e5bfbadd2ea495b0a7bad37536b550`; a10 `eng/json/018.content.json`, SHA256 `20293f22477757922aee0cb0f3a69c703329a198542529e8a60477694fe12c9a`. Both asset versions are **1.0.4**; collection version **1.1.2** is a separate field. Retain exact ledger rights text: Word Collective, CC BY-SA 4.0, and supplied adaptation/attribution notices. Do not relabel the bundled low-resolution hashes as these HQ inputs.

Read-only inspection of already retained source bytes with PyAV found both video tracks H.264, 1280×720, average/base rate 50/1, time base 1/12800. a184: 2821 frames, 722176 video ticks (56.42 seconds). a10: 2792 frames, 714752 video ticks (55.84 seconds). Container/media durations previously measured are respectively 56.453 and 55.857 seconds; track and container durations are distinct, not a discrepancy to normalize away. No video was fetched or encoded for this proposal.

## Concrete extension contract

Use separate source-contract documents with the existing a13 shape: recipe, exact source URL/SHA/bytes/provenance, limits, encoding, and an immutable extension acceptance revision. A small explicit source lookup chooses the matching contract before fetch or cache lookup; any unlisted URL, conflicting ID, or option mismatch fails closed. Existing a13 document and its qualificationRevision `7fc5e54667fb4d7f9df16755172d6ffec8b3c52d` remain unchanged. The two new contracts must bind their own accepted extension revision; they cannot inherit a13's output qualification as evidence.

Initial settings for each new source: maximum 1280×720, preserve verified 50fps, libx264 medium, yuv420p, two passes, video target 439024 bit/s (nominal 450000-bit/s class), maxrate 900000 bit/s, buffer 1800000 bits, minimum keyint 1, scenecut 60, AAC 96 kbit/s stereo, MP4 faststart. GOP duration is **30 seconds**, translated to keyint **1500 at these verified 50fps**. Do not retain 1500 for a future differently rated source or introduce an unreviewed framerate change. Future rates require a new exact contract; this extension supports only these two verified rates.

Keep existing server limits exactly: output/source contract byte ceiling 62914560; request 8192 bytes; source deadline 120000ms; encode deadline 300000ms; job deadline 600000ms; stderr 65536 bytes; passlog per-file 33554432 and total 67108864 bytes. Retain incremental byte bounds, Linux process/file limits, kill/cleanup on cancellation and deadlines, executable/library/adapter/recipe identity, and no canonical cache readiness before complete verification. Application publication still separately requires output at most 16777216 bytes and its accepted 50331648-byte application-payload allocation proof; server acceptance alone does not satisfy that gate.

439024 is a proposed reuse of the measured a13 control value, not a promise of exact bitrate, size, quality, or compression factor on another source. Record actual video/audio/container rates and sizes for each result. Any adjustment beyond this concrete setting requires a reviewed contract successor and new identity, not a silent retry with different encoder parameters.

## Staged qualification and acceptance

1. Independently review this extension and publish the exact server canon before code or encoding. Implement source lookup and two contracts with fixtures; prove a13 contract/settings/source qualification unchanged and the reviewed adapter change produces the expected new encoder/cache identity, both new exact sources accepted, forged source bytes/metadata and unknown sources rejected. Existing audio/image behavior and tests remain unchanged.
2. Qualify a184 through the same pipeline first. Preserve source/output hashes, encoder/build and contract identities, pass logs, actual rate/size/duration/codec/dimensions/framerate and seek observations. Compare actual decoded frames and motion with its own HQ source at the accepted medium viewing size (854×480), with independent review of legibility/detail/artifacts and audio. a13's quality verdict does not transfer to sandals.
3. Once the first extension sample is accepted, process and independently qualify a10 with identical checks. Do not label either derivative accepted merely because ffmpeg exited successfully. Preserve rejected trials privately and never publish them as ready.
4. For each accepted output, prove actual deployed Worker/container/R2 MISS then HIT, byte/hash identity, bounded failure/cancellation, correct full/range/invalid-range responses and browser playback/seek. Preserve standard route revalidation semantics. No progressive/mobile success claim beyond observed evidence.
5. Only after those gates may a separate application publication bind each logical asset, accepted HQ source-ledger row, and accepted derivative via v2 delivery descriptors. Keep raw presentation identity, all 151 audio/image entries, explicit current-resource playback, no preload, offline verification, and native-owner retention intact. No application changes are part of this server extension.

If a source fails quality, latency, size, or integrity, keep it unqualified and report that specific failure. Do not fall back to a13 output, silently use the old bundled source, or block independently accepted a13 delivery. Actual server deployment and output qualification remain separate from this source-contract acceptance.

## Scope, ownership, and reversibility

Proposed server author scope: exact source-contract files plus existing contract selection/validation seam and focused tests; shared runtime changes only as needed for explicit lookup, reviewed before implementation. No new service, public write endpoint, architecture redesign, generic preset ladder, or application edits. Root owns publication/release; independent integration review is required. Revert the two added allowlist entries/contracts and adapter change to remove the extension while restoring the prior a13 runtime identity; do not alias cache entries across revisions.

6B: Borrow the accepted source ledger and two-pass runtime; Bend explicit source lookup; Break the single-source assumption only; Beget two identity-bound contracts; Bide per-source measured output and browser acceptance; Build the smallest allowlist adapter. Premortem: unacknowledged a13 cache revision, collection/asset version confusion, transferring a13 quality approval, wrong GOP duration, and publishing server-valid but app-oversize bytes are explicit rejection cases above.
