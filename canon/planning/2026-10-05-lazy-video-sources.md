---
title: Lazy video for any approved-host source
date: 2026-10-05
status: working
mode: planning
---
# Lazy video for any approved-host source

> Operator ruling (2026-10-05): the service is a 100% lazy on-demand proxy — "There is no such thing as unavailable." Video requests are no longer gated by the closed source×size catalog.

## Summary

Applies constraint 1, Proxy-First + Lazy Transcoding (`canon/constraints/core-governance-baseline.md`). The exact catalog rows (a13, a184, a10 and the Jordan composite) are consulted first and are unchanged. Their contracts, encoder revision and cache keys stay the same: `container/video.mjs` and `container/video-catalog.mjs` are byte-identical. Any other source URL on an approved host is served lazily at every FIA size (xsmall/small/medium/large/xlarge). Its contract comes from that size's existing profile recipe (`container/video-sources.mjs`). The contract pins no source sha. The container records the fetched source sha256 and byte count in the output metadata. The cache key is derived from the URL, profile and encoder revision. Lazy jobs use their own container routes (`/video-lazy-info`, `/video-lazy-transcode` in `container/video-lazy.mjs`). Their encoder revision also hashes the lazy modules.

## Flagged defaults (operator review)

1. **Host allowlist (abuse guard).** Only canonical https URLs under `https://s3.amazonaws.com/cbbt-er.public/` or `https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/` are accepted. URLs with a query, fragment, credentials or dot-segments are also refused. Everything else returns 403 with the allowed prefixes in the message. The list is the single constant `VIDEO_SOURCE_ALLOWED_PREFIXES`.
2. **No upscale.** The output is never larger than the source's display size. When the source is smaller than the size profile, it is encoded at its own display size with square pixels (e.g. a 720p source at xlarge is 1280x720). The actual raster is returned in `X-Transcode-Video-Width` and `X-Transcode-Video-Height`.

## One raster rule (any aspect, any pixel shape)

Every lazy source is served, whatever its shape (operator ruling: no source is unavailable). The display aspect is DAR = (width × SAR) / height. The output fits inside the size profile's box (profile width × height) and keeps that DAR. It never exceeds the source's display size, uses square pixels (SAR 1:1), and has even dimensions, which is all libx264 yuv420p needs. One case keeps the profile raster unchanged. When the source is exactly 16:9 and at least as large as the profile's display size, the output uses the profile raster itself, including its 16-pixel alignment and SAR (e.g. small 864x480 SAR 80:81). The 16-pixel rule belongs to the catalog's fixed 16:9 rasters. It is not applied to other aspects, because no raster can be 16-aligned and also keep the exact aspect with square pixels. Examples: a 1440x1080 SAR 4:3 source at xlarge → 1616x912 (profile). A 4:3 square-pixel 1440x1080 source at large → 960x720. A 1080x1920 portrait source at large → 404x720. Rotation metadata (display matrix side data, or the legacy `rotate` tag) is honoured. A quarter-turned source is fitted as its upright picture, with width, height and pixel aspect swapped: a phone-portrait 1280x720 rotation=90 source at large → 404x720. ffmpeg autorotates the input, and the output check compares against the upright size and refuses any output that still carries rotation. The rule lives in `fitLazyRaster` (`container/video-sources.mjs`). The derived contract is checked before the encode starts. The output is checked against the same raster afterwards.

## Other bounds carried, not new policy

- The cadence comes from the probed source using the existing integer-divisor ≤30 fps policy. Variable frame rate sources (avg ≠ r frame rate, or no usable rate) are normalized, not refused. The nominal rate is the average rate (r_frame_rate if the average is unusable, 30/1 if neither is usable). It is snapped to the nearest broadcast rate within 1%, or else rounded to whole fps. The same ≤30 fps rule picks the output rate, and an fps filter makes the encoder input constant-rate in both passes. The contract records `cadenceNormalization`. Only undecodable input (no video stream, no raster size) is refused, with **422** after the probe and before any encode.
- Output audio is resampled to 48 kHz on every lazy size, so 44.1 kHz sources pass the existing 48 kHz output check.
- The source byte ceiling for lazy rows is the largest existing qualified source ceiling (the composite rows' `sourceBytes`, 256 MiB). Output, time and encode limits are the profile's own.
