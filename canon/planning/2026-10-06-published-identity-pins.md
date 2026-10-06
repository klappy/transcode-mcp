---
title: Published video identities are served from pinned bytes across container rebuilds
date: 2026-10-06
status: draft
mode: planning
derives_from: canon/planning/2026-10-05-legacy-video-pins.md
complements:
  - canon/planning/2026-10-06-proxy-path-normalization.md
  - canon/planning/2026-10-05-lazy-video-sources.md
  - canon/planning/2026-05-27-success-criteria-and-irreversibility.md
---

# Published video identities are served from pinned bytes across container rebuilds

> If a client may pin it (a URL handed to an app, or a hash a client recorded), the service serves it from pinned bytes, not from whatever the current container encodes. Container rebuilds may change cache keys. They must not change what a published URL returns. `PUBLISHED_PINS` maps 16 exact request paths to one identity per tier. The Worker serves the first identity whose R2 object verifies by size and streamed SHA-256, with `X-Transcode-Pinned: published`. If none verifies, the normal path still serves the request, because a video is never blocked, and the response carries `X-Transcode-Pinned: stale` plus a structured warning. Follow-up: make container builds reproducible by pinning the base image digest and an apt snapshot.

---

## Summary — Pinned bytes first, a video is never blocked, then make the build reproducible

Every Workers Build rebuilt the container image from an unpinned base. The encoder revision hashes ffmpeg and every linked library, so a Debian library update changed every video cache key. x264 does not produce identical bytes on every run, so each re-encode yielded new SHA-256s for URLs clients had already pinned. The rule from the alpha.13 incident now covers every published output. A path listed in `PUBLISHED_PINS` (`src/lib/video-published-pins.ts`) is served from a retained R2 object only if its size and full streamed SHA-256 equal a listed identity. Identities are tried in order: production, staging, then development. Each tier encoded under the same key but holds different bytes, so only the identity whose bytes are present verifies. The pin path never writes or deletes R2. If nothing verifies, the operator rule applies: the normal encode path serves the request, marked `stale`, and a `published-video-pin-stale` warning is logged. The alpha.13 legacy pins keep their fail-closed 503. Only the exact listed paths are pinned, and catalog contracts, cache keys and container slots are unchanged. Pinning the outputs protects published URLs. Reproducible builds would also stop the unneeded re-encodes and their cost.

---

## Incident — Every Workers Build Re-encoded Every Published Output

- `container/Dockerfile` builds from `node:22-bookworm-slim` (a tag, not a digest) and runs `apt-get update && apt-get install ffmpeg`. Each Workers Build therefore produces a new image whenever Debian has published updates.
- `encoderIdentity` (`container/video.mjs`) hashes the ffmpeg version, the ffmpeg executable and every `ldd`-linked library into `revision`. `videoKey` hashes `{contract, encoderRevision}`. A change to any library changes every cache key.
- A new key misses, so the request re-encodes. x264 output is not byte-identical across runs, so the re-encode produces different bytes and a different SHA-256 under the same URL.
- Verified on DEV: after S0 (#104) the image changed (v57/v58 → v59), and all 16 explicit-size and lazy outputs re-encoded to new SHA-256s. These were the 7 explicit-size outputs handed to the FIA app in `PRODUCTION-OUTPUTS.json` and the 9 lazy Mark 1:14–28 outputs.

## Cause — Delivery Identity Still Followed Encoder Identity

This is the same cause as `canon/planning/2026-10-05-legacy-video-pins.md`, with a different trigger. That incident came from a recipe change. This one came from an image rebuild with no change to the code. An encoder revision that hashes libraries is correct as a cache identity, because a different encoder must not claim old bytes. It is wrong as the delivery identity of a URL a client has already pinned.

## Rule — Anything a Client May Pin Is Served from Pinned Bytes

- **Table.** `PUBLISHED_PINS` maps each exact canonical request path to a list of identities `{tier, bytes, sha256, keys[]}`, ordered production, staging, development. The path is the raw path after `normalizeProxyPath`, with no query string. Each row records what that tier's R2 bucket held before the rebuild.
- **Serve.** Identities are tried in order, and each identity's keys in order. An object is accepted only if its size equals the identity's size and its streamed SHA-256 equals the identity's hash. A declared `customMetadata.sha256` that differs rejects the object without hashing. Verification is memoized per isolate by key, etag and identity, so a key verified for one tier never vouches for another tier's identity. The response carries the same headers as a normal HIT: the ETag is the pinned SHA-256, and Range, HEAD and 416 all work. It is marked `X-Transcode-Pinned: published`. The pin path never writes or deletes R2. Within a request, each key gets one HEAD, shared across identities.
- **Stale.** If no identity verifies in this tier's bucket, the normal path's response is served unchanged except for `X-Transcode-Pinned: stale`, which is added to the CORS expose list. A `published-video-pin-stale` warning records the path, the status, the ETag actually served, the pinned `tier:sha256` list and the keys. The operator rule is never to prevent a video from being watched. The alpha.13 legacy pins (`LEGACY_PINS`) stay fail-closed (503) under the app owner amendment and are otherwise unchanged.
- **Scope.** Only the exact listed paths are pinned. Other option orders, an omitted or unlisted size, a query string and unlisted sources all take the normal path with no pin header. A collapsed `https:/` path reaches the pins through the Worker's single entry normalization.
- **New published outputs.** Before a URL is handed to a client, add its identities to the table from the tier inventory. A digest test over the whole table makes every edit deliberate.

| Group | Paths | Production | Staging | Development |
|---|---|---|---|---|
| Explicit-size outputs handed to the FIA app (a13, a184, a10 xsmall + medium; Jordan composite xlarge) | 7 | 7 | 7 | 7 |
| Lazy Mark 1:14–28 outputs (a11, a19, a186 × xsmall, medium, xlarge) | 9 | 9 | 9 | 9 |
| **Identities** | **16** | **16** | **16** | **16** |

Match quality of the inventory: 47 of 48 rows matched by R2 `customMetadata.sha256`. Staging a11 xsmall matched by unique size, and its recorded SHA-256 equals the metadata SHA-256. No row was ambiguous or missing. Every path has one key shared by all three tiers, and the three tiers' sizes differ, so size alone separates them before any hashing.

## Follow-up — Reproducible Container Builds

Pins protect published URLs. They do not stop a rebuild from changing every cache key and re-encoding everything that is not pinned, at full encode cost. Make the image reproducible:

- Pin the base image by digest (`FROM node:22-bookworm-slim@sha256:<digest>`).
- Install apt packages from a dated Debian snapshot (`snapshot.debian.org/archive/debian/<timestamp>`) instead of a live `apt-get update`.
- Change the digest and snapshot only on purpose, and then expect new cache keys.

Even a reproducible encoder does not promise identical x264 bytes on every run. Pins remain the guarantee for anything published.
