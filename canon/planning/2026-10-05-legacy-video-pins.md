---
title: Released video identities are served from pinned bytes
date: 2026-10-05
status: draft
mode: planning
derives_from: canon/planning/2026-10-04-fia-video-adapter.md
complements:
  - canon/planning/2026-05-27-success-criteria-and-irreversibility.md
---

# Released video identities are served from pinned bytes

> A URL an app has released with a byte-integrity check is an immutable identity. The service serves those exact bytes from retained storage; it never re-derives them from the current encoder identity. If the retained bytes are unavailable, an encode may run, but only output equal to the pinned length and SHA-256 is served — otherwise an explicit error.

## Incident

FIA alpha.13 pins the exact bytes of three omitted-size video URLs, `/video/preset=fia,q=medium,f=mp4/<src>` (omitted size = Large), for sources a13, a184 and a10. Production #99 changed the Large recipe (`fia-video@4` → `@5`). The cache key is derived from contract + encoder revision, so the same URLs re-encoded to different bytes and the app's integrity checks failed. Report: https://github.com/klappy/transcode-mcp/pull/99#issuecomment-6003937813.

## Cause

Delivery identity was derived from encoder identity. A recipe change is a legitimate encoder change, but for a URL an app already shipped with a hash, it silently changes released content.

## Rule

- Released identities are served by pinned bytes (`LEGACY_PINS` in `src/lib/video-published-pins.ts`, formerly `src/lib/video-legacy-pins.ts`; generalized to every published output in `canon/planning/2026-10-06-published-identity-pins.md`), keyed by the exact released URL form. Only the omitted-size form alpha.13 uses is pinned; explicit `size=large` follows the current recipe.
- Candidates, in order: `video-reference-v1/<sha256>.mp4`, then the historical `video-v1/<key>.mp4`. An object is accepted only if its size equals the pin and its streamed SHA-256 equals the pin (memoized per isolate by key + etag). A key name or metadata claim alone is never trusted — staging/development hold different bytes under the a13 `video-v1` key.
- No retained candidate verifies: the unchanged encode path may run, but its full output must match the pinned length and SHA-256 before any byte is served (app owner amendment). Mismatch → `503 Pinned release bytes unavailable` with `X-Transcode-Pinned`; those bytes are never served under the legacy identity.
- The pin path never writes or deletes R2. Explicit-size and lazy requests keep their cache keys and behavior.
- Future app bindings that release a URL with a byte check pin it through the same mechanism before the recipe behind it may change.

| Source | Bytes | SHA-256 |
|---|---|---|
| a13 | 5,508,450 | `7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15` |
| a184 | 3,958,360 | `bb1e991a78c8bdf146599efc4170caee51b284e7bf48bc23e4a59754f8789d99` |
| a10 | 3,814,200 | `077bef593feb976f8b18eaa01feb0e5fba7b0c805cff767d25732c06309daa92` |
