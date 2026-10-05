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
2. **No upscale.** When the source is shorter than the target (e.g. xlarge 912 from a 720p source), the video is encoded at the source's coded height. That height is aligned down to the container's existing 16-pixel raster rule, which is exact for 720p, and the display aspect stays 16:9. The actual raster is returned in `X-Transcode-Video-Width` and `X-Transcode-Video-Height`.

## Other bounds carried, not new policy

- The cadence comes from the probed source using the existing integer-divisor ≤30 fps policy. Sources must be constant frame rate (avg = r frame rate) with a 16:9 display aspect (±1%); other sources fail the job (502).
- The source byte ceiling for lazy rows is the largest existing qualified source ceiling (the composite rows' `sourceBytes`, 256 MiB). Output, time and encode limits are the profile's own.
