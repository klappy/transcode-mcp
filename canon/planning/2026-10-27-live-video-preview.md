---
title: Normal video preview invokes the live proxy only on explicit Play
date: 2026-10-27
status: working
---
# Normal video preview invokes the live proxy only on explicit Play

> Make the live proxy the normal preview. Request only the selected source and size after Play, show preparation/retry and observed response measurements, and keep historical benchmarks separately labeled.

## Decision and scope

The operator rejected a fixed-file-only preview. The four historical benchmark publications were separately copied and verified through staging and production; their availability does not complete this UI change.

Add one normal live preview above a collapsed historical comparison section. Default to the already reviewed Jordan source and explicit `size=large`; let the user choose an approved source URL and supported size. No video receives a source on page load, and no HEAD/prefetch batch runs. On explicit Play, one selected `GET` with `Range: bytes=0-0` requests/prepares the existing deterministic proxy object and reads actual size/cache/raster response headers. Then assign that same live `/video/` URL to the selected native player and play. The one-byte preparation response is not a full transfer or an encode-time measurement. The proxy remains the only durable cache owner. No browser blob cache or alternative publication store is added.

Busy, deadline and unavailable responses leave a visible manual Retry button, without an automatic retry loop or origin fallback. Fixed historical players also receive their reference source only after their explicit Play button. Historical sizes/timings remain explicitly scoped to those immutable files.

## Acceptance and limits

Behavioral tests prove zero initial media/fetch, one selected request after Play, explicit Large URL, preparation state, retry after failure, honest observed measurements, and no source assignment after failed preparation. Browser proof covers playback/seek and narrow/mobile layout. This is UI work; no recipe, encoder or reference identity changes. Actual dev/staging/production validation remains required through existing branch integrations; a local mocked endpoint is only UI evidence.

The separate CDN allowlist PR #108 is not incorporated. Its package/changelog holds overlap eventual release bookkeeping; resolve that release ordering explicitly before editing those held files. No new pipeline, worker, container, bucket or credential is authorized or needed.
