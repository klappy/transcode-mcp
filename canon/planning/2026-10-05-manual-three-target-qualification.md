---
title: One explicit three-target FIA qualification dispatch
date: 2026-10-05
status: working
mode: planning
derives_from: canon/planning/2026-10-05-fia-three-delivery-targets.md
---

# One explicit three-target FIA qualification dispatch

> Keep automatic pull-request and main CI limited to unit, type and contract checks. Qualify Small, Medium and Large once through a manually dispatched, bounded three-target run using one already-retained a13 source. Do not automatically encode a184 or repeat the comparison on merge.

## Problem and decision

The current `video-container` matrix encodes a13 and a184 after relevant pull-request or main changes. That was valid for the earlier source-extension proof but contradicts the accepted three-target comparison's three-output ceiling and a13-only scope. A code push must not silently initiate these additional encodes.

Retain the existing CI unit/type tests on pull requests and main. Replace the automatic encode matrix with one `workflow_dispatch` qualification job, with no asset picker: exact targets are Small, Medium and Large, in that order. The dispatch binds an explicit reviewed 40-character runtime commit and fails if the checked-out commit differs. The operator records this as the single accepted comparison attempt; a failed job is evidence, not permission to rerun. No automatic retry, workflow rerun policy, parameter search, additional source or encoder variation is introduced.

The root publisher launches only after exact runtime and workflow review. A new reviewed attempt is needed to repeat a failed encode. Successful target artifacts are reused for review and display; merging the same code does not encode them again. Disable automatic cancellation of an in-progress qualification by unrelated pushes: use a qualification-specific concurrency group with cancellation disabled, while normal test CI retains its existing cancellation behavior.

## Source and isolation

Download the already pinned retained GitHub artifact11321498762 from run37253567874 once. Verify its source bytes49,851,846 and SHA256 `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718` before running the encoder. Missing or expired artifacts fail closed, with no origin fallback. This is reuse of retained evidence, not a new media source request.

Build one actual Docker encoder image from the reviewed runtime. Use the existing CI-only retained-source transport, with only the exact a13 source URL mapped to the hash-verified local bytes. All unexpected origin requests fail. Start targets sequentially, retaining independent target directories/receipts and source-fixture counts; each target invokes the actual `/video-info` and `/video-transcode` handler once for that target. Readiness polling may inspect identity but must never initiate an encode. No production flag, alternate encoder implementation, new service or public route is added.

## Bounds

At most one two-pass encode per target and three outputs total. Source and each output remain bounded60MiB; each encode/mux execution remains300seconds, pass logs32MiB per file/64MiB combined, stderr64KiB. The common comparison window is30minutes, including readiness, encode and evidence work; no next target starts unless300seconds plus30seconds cleanup reserve remain. The parent supervisor terminates its owned process/container at the common deadline, retains partial evidence, and reports failure. An expired deadline can never be overwritten by a later success.

Limit the retained qualification working directory to768MiB, counting source/artifact copies, partial output, frames, logs and receipts. Reserve source/output/evidence space before each target and check actual usage; do not start another target if the remaining reservation cannot fit. Bound frame exports explicitly and preserve their hashes. Keep the existing process file-size limits and cleanup evidence. No automatic rate correction or second attempt follows a measurement miss.

## Size-aware proof

Extend `scripts/video-integration.mjs` with an explicit closed size argument; select the exact source-bound contract rather than duplicate target constants. Send size consistently to identity and encode calls. Bind each receipt to reviewed Git commit, target contract, canonical recipe revision, executable/libraries/adapter identity, retained source and measured output SHA/bytes. Large omitted/explicit-size canonicalization remains covered by unit tests; the controlled run needs only one Large output.

Probe exact target width/height/SAR,50fps,H.264/yuv420p,AAC channels and48kHz sample rate; retain full duration and actual packet/mux accounting. Small SAR is1280:1281; Medium/Large are1:1. Compute video payload rate against the contract's nominal class and measured video timeline. A deviation above5% is recorded as a rejected budget qualification, not hidden by widening tolerances. Record actual AAC rates independently; changed proportional audio does not have to hash-match across targets. Preserve all measured data even when qualification fails. Listening, teaching-detail assessment, decoded matched frames/motion and browser playback are separate review gates, not inferred from container success.

The CI job reports measured targets awaiting independent acceptance, never product readiness. It uploads retained evidence on failure as well as success. The one comparison artifact can support subsequent review, but it cannot replace actual deployed HTTP/range/cache/ownership/browser evidence.

## Deployment scope and reversal

The three-output maximum applies to this controlled comparison qualification. It does not prohibit mandatory, separately scoped cold-delivery and disconnected-owner checks in the existing DEV→staging→production release train. Those checks must be explicitly accounted for by tier and source; they are not additional comparison variants or automatic CI retries. No new deployment mechanism is authorized.

Owned implementation: CI workflow, the existing retained-source integration proof and a small sequential supervisor if needed, plus focused tests. No encoder settings, source content, app UI or provider changes. Reversal is to disable manual qualification while keeping unit/type CI; do not restore automatic encoding as a fallback.

## Checks and failure modes

Verify push/pull-request cannot schedule an encode; dispatch cannot select extra assets/targets; wrong commit/source identity or unavailable retained artifact fails before encode; targets carry distinct contracts; shared deadlines and directory limits stop further work; partial/failed evidence remains; main merges do not duplicate encodes. Review exact workflow and helper source before the one root-owned dispatch. A skipped manual job on ordinary CI is not a measured encode PASS.
