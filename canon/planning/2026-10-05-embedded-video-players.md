---
title: Embedded video comparisons — show the resource before Play
date: 2026-10-05
status: accepted-for-implementation
---

# Embedded video comparisons

> The operator rejects blank squares with text Play buttons. Show five recognizable embedded video players, preserving the existing paired comparison story, accurate measurements and R2 playback.

## Decision and design contract

The visitor is a partner evaluating useful picture detail against file size. Their journey is: recognize the same scene in each option, play a comparison, seek or expand it using familiar controls, and choose a practical size. All five videos remain present: source720 beside optimized720, existing compact224 beside optimized480, then balanced540.

Use visible native HTML video controls from the initial render, contain-fit 16:9 media wells, and a real matched poster frame from each exact retained video. No covering text button, hidden video, opening another page, autoplay, or client-side first-frame video fetch. Accessible names identify each version. Video source URLs are present immediately with preload=metadata, matching normal embedded-player behavior. Browser metadata requests are allowed; playback requires user intent and autoplay remains absent. The earlier zero-video-request rule overextended an FIA offline-download constraint into this comparison page and is superseded. Tiny still previews and metadata loading are not persistent offline downloads.

Extract the same scene time from the five already qualified local files, preserving each file's visible quality, colors and full frame. Record original SHA, requested/actual timestamp, poster dimensions/bytes/SHA and extraction settings. Reuse a bounded static poster representation in the existing page embedding path: prefer inline small JPEGs over a new endpoint, bucket or client framework. Cap the aggregate poster payload at200KB before base64. No video re-encode. Reassess if the actual payload exceeds that budget.

Preserve the current page typography, tokens, widths, paired order, captions, figures, licensing and disclosures. This contract supersedes only the blank media well and custom text Play overlay. Review before/after screenshots at390×844 and1280×800. Native controls vary by browser; do not claim physical iPhone proof from desktop mobile emulation.

## Driver's-seat delta

Changed initial-state acceptance to normal embedded players with metadata preload and no autoplay. The earlier no-src/no-video-request restriction accidentally forced unfamiliar placeholders and does not apply to this comparison page. Evidence includes the unplayed player, permitted metadata requests, keyboard activation, native controls, playback after intent, seeking and pause-other behavior. Reuse the five stored files and their exact identities; no new media discovery or encoder work.

Rejected autoplay. Metadata preloading is explicitly allowed by the operator; matched static posters avoid needing playback merely to see the scene. Rejected a third-party player framework because native controls already supply the interaction. Rejected one high-quality poster reused across all variants because it would misrepresent the compact file. Rejected a new poster service/storage binding for five fixed previews because it adds lifecycle work without improving this bounded page.

## Four-lens scope and boundaries

Apply the live driver's-seat, product, design and vodka lens instructions to this transcode showcase, as explicitly requested by the operator. Do not silently reuse FIA-v2 registration or claim endorsement by a human lens owner. Product reviews the single comparison journey; design reviews the rendered player against this contract and the previous page outside the changed well. Architecture reviews the narrow static presentation boundary, not a new server system.

The showcase is L5 presentation embedded in the existing Worker. No MCP tools, durable bindings, source handlers, container settings or encoding contracts change.

### Knows
- Fixed comparison labels and verified resource URLs.
- Preview bytes derived from the retained files and published measurements.
- Presentation state needed to pause another player when native playback starts.

### Does NOT Know
- Encoding internals, storage ownership or user accounts.
- Automatic download selection, source discovery or media generation policy.

### Is NOT
- A new player platform, media cache or transcoder.
- An offline-pack manager or a new MCP service.

### Scoped lens registration
- Target: this embedded-player correction only; operator explicitly invokes all four lenses. No FIA-v2 registration is reused and no human endorsement is implied.
- Driver's-seat: current method `klappy://canon/methods/driver-seat-lens`, content hash `adp0vp`; delta above precedes challenge.
- Product: `klappy/kitchen cookbook/lenses/product-lens.md` blob `bc6e51814b7789986781b7a2be80b674ad9c4c07`; primary partner comparison journey above, no collecting or results surface added.
- Design: `klappy/kitchen cookbook/lenses/design-lens.md` blob `e8ba65f5696da28fd52928209e7a7d2e702abbe7`; operator's visible-player correction plus this contract governs the media well; prior production page at `625ec4d563fe895f6fd11a23ff27d8dafbefed85` governs surrounding layout and tokens. Initial unplayed before/after pairs at390×844 and1280×800 are required; a rendered draft is not described as a pre-approved mock.
- Architecture: `klappy/kitchen cookbook/lenses/vodka-lens.md` blob `4120066966d83d0753c967ae43a5ca186ea1054c`; governed components are `src/demo-video.html`, its existing `src/demo-video.ts` embedding wrapper, fixed poster data/provenance and this contract, all L5 presentation. Spec boundaries are the three enumerations above. Existing `wrangler.jsonc` bindings and `src/index.ts` registration/route wiring remain unchanged; zero new tools, bindings or modules outside the presentation surface. Governance home is `canon/planning/`; maintainer is the existing transcode repository owner. Preview data is static derived presentation, not a new durable truth store. No domain conditionals are introduced in substrate code. Existing server/API and media-service qualification remain separate and are not recertified by this narrow review.

## Acceptance, release and reversal

Before release: actual rendered phone/laptop screenshots, all five native players visible with nonblank matched posters, keyboard-operable playback, metadata requests allowed with no autoplay or persistent offline download, clock advance, seeking, native fullscreen availability and one playing resource. Preserve exact file identities and original measurements. Run the existing focused demo tests and relevant typecheck; no unrelated encoding tests or extra transcodes. Record four lens findings and independent review. One sequential DEV→staging→production Git release train, each verified against its actual served page. Revert only this presentation commit if needed. Automation stays paused.
