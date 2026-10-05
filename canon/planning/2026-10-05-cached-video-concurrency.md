---
title: Cached video reads bypass encode admission
date: 2026-10-05
status: working
---

# Cached video reads bypass encode admission

> Validate current encoder identity and the canonical R2 object before acquiring the retained encode owner. Concurrent verified cache hits must not compete for an encode slot. Cache misses still enter the existing owner and recheck storage before encoding; publication, deadlines and byte verification remain intact.

## Summary

Two actual DEV native-player runs at main2bf1e5 returned503 for Medium while Small played. A subsequent parallel cached-range diagnostic returned the exact19-byte body `Video capacity busy` for Medium, while Small/Large returned206HIT. Deterministic local routing confirms Small and Medium both use instance-0, while Large uses instance-3. Current `VideoOwner.run` rejects different keys even when preparation only reads already verified R2 objects. This is a concrete scoped explanation to reproduce with a controlled concurrent HIT regression, not a general reliability claim.

## Decision and boundaries

Perform one read-only preparation outside encode admission. It still obtains current `/video-info`, derives the canonical source/settings/encoder key, reads R2 metadata and applies all existing source/hash/bytes/recipe/encoder validations. This operation may start the existing container to obtain its identity; it does not POST an encode, mutate R2, claim a cache-only public endpoint or remove the need for current encoder identity. The container serves video-info before its encode-busy check. Keep its current lookup mechanism; no registry or new service.

A valid HIT goes directly to the existing per-consumer range/body acquisition. A missing object enters the retained owner, repeats identity/storage preparation, and only then may encode. Concurrent misses for the same contract join existing work; different missing contracts retain bounded503. Do not bypass metadata validation, substitute stale identity, share response bodies or alter cache keys. If an object disappears after lookup, fail as the existing read path does; do not start an unowned encode.

Bound the read-only lookup by the original consumer deadline, including R2 reads that cannot be cancelled. Late lookup completion must never proceed into encode admission. A stalled read-only lookup does not hold the encode slot because no mutation or encode was started. A newly admitted cold job receives only the remaining original budget; joining callers do not reset its timer. Retained cold jobs retain the original owner lifecycle through publication and cleanup, including late uncancellable storage settlement. The final consumer body read continues to use remaining original time. No new endpoint, preset, tool, environment setting or encoder change.

## Evidence and alternatives

Add a controlled concurrent Small/Medium/Large HIT test with an asynchronous barrier: all return verified206 bytes with zero transcode calls and zero owner admission. Also prove a cached contract works while another cold owner is occupied, bad metadata still fails, and stalled lookup times out without a late encode. Preserve existing joining, disconnected publication, late PUT/cleanup, source validation and range tests. Test absence before admission followed by publication before the in-owner recheck to prevent duplicate encode.

Serializing all hits was rejected because existing independent range reads need no shared encode mutation. Changing slot count or names hides the collision without fixing admission. Skipping identity validation was rejected because it could select stale bytes. Revert if the concurrency regression cannot reproduce, integrity validation changes, or cold ownership tests regress. Root must run actual parallel verified cached ranges and the native five-player page after deployment; local mocks do not prove Cloudflare transport.

## Release and reversal

Root publishes docs then the narrow code/test change and uses the existing DEV→staging→production train. Preserve both failed browser receipts. No media re-encode is authorized by this repair; reuse current cached outputs and identities. Reversal restores the prior read path without changing stored bytes or encoder identities. This does not authorize the cancelled compact fallback or optional320 experiment.
