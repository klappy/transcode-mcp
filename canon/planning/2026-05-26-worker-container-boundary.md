---
title: "transcode-mcp — Worker/Container Boundary"
date: 2026-05-26
mode: planning
status: draft
project: transcode-mcp
applied_canon:
  - klappy://canon/principles/vodka-architecture
  - klappy://docs/promotions/P0006-vodka-boundary-enumeration-as-spec-convention
  - klappy://canon/constraints/anti-cache-lying
modeled_on: "klappy/ptxprint-mcp v1.2 spec section 1"
---

# transcode-mcp — Worker/Container Boundary

## What This Server Knows

1. **The URL vocabulary.** The Worker parses the request path into media type,
   options (comma-separated key=value), and source URL. It validates option
   keys and values against a preset data object.

2. **Cache lookup via Cloudflare Cache API.** The Worker checks the Cache API
   for a previously transformed result, keyed by the full request URL. On a
   hit, it returns the cached response.

3. **Image transformation via Cloudflare Images binding.** On a cache miss for
   images, the Worker fetches the source, reads dimensions via
   env.IMAGES.info(), computes the half-class encode width, calls
   env.IMAGES.input().transform().output(), writes to Cache API, returns it.

4. **Audio dispatch to Container.** On a cache miss for audio, the Worker
   fetches the source, writes it to R2 keyed by sha256, dispatches to the
   Container with the R2 key and options, serves the output.

5. **Preset data.** A JSON object mapping preset names to quality values per
   media type. The only domain opinion in the Worker, and it is data not code.

6. **Half-class resolution arithmetic.** For images: min(target * 1.5,
   source * 1.5). Arithmetic, not transcoding opinion.

## What This Server Does NOT Know

1. **How Cloudflare Images works internally.** The Worker calls the binding
   API. It does not know codecs, chroma subsampling, or transform internals.

2. **How ffmpeg works.** The Worker passes a preset name and quality level to
   the Container. It does not know codec flags or filter chains.

3. **What audio presets contain.** The Worker knows preset names (voice, music)
   from the URL vocabulary. It does not know that voice+low means 32kbps mono
   at 16kHz.

4. **Source media analysis.** The Worker does not probe or analyze source media
   beyond what env.IMAGES.info() returns (dimensions).

5. **Perceptual quality judgments.** Quality decisions are made by preset data
   (images) or Container recipes (audio).

## What This Server Is NOT

- **Not a CDN.** Transcodes on miss, serves from cache on hit. Not a
  general-purpose CDN.
- **Not a batch processor.** One URL per request. Batch packaging is the
  caller's responsibility.
- **Not a media editor.** No cropping, rotating, watermarking, mixing,
  trimming.
- **Not a media analysis API.** Container analysis is an implementation
  detail, not exposed.
- **Not stateful.** No user accounts, no project state, no job history.

## The Vodka Constraint Test

- **Has the server grown thick?** Target: ~60 lines for images, ~120 for
  audio routing.
- **Has the server acquired domain opinions?** One: the half-class resolution
  arithmetic. Everything else is preset data or binding API calls.
- **Can the domain opinion be replaced?** Yes — the preset JSON and the
  half-class multiplier are both data.

## What the Container Owns (Audio Only in v1)

1. ffmpeg and codec libraries
2. Recipe data files — preset+quality to ffmpeg flags mapping
3. Content-class detection — voice vs music auto-detect
4. Output upload to R2
