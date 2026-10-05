---
title: Embedded video comparisons — show the resource before Play
date: 2026-10-05
status: accepted-for-implementation
---

# Embedded video comparisons

> The operator rejects blank squares with text Play buttons. Show five recognizable embedded video players, preserving the existing paired comparison story, accurate measurements and R2 playback.

## Decision and design contract

The visitor is a partner evaluating useful picture detail against file size. Their journey is: recognize the same scene in each option, play a comparison, seek or expand it using familiar controls, and choose a practical size. All five videos remain present: source720 beside optimized720, existing compact224 beside optimized480, then balanced540.

Use visible native HTML video controls from the initial render, contain-fit 16:9 media wells, and a real matched poster frame from each exact retained video. No covering text button, hidden video, opening another page, autoplay, or client-side first-frame video fetch. Accessible names identify each version. Video source URLs may be present immediately with preload=none; this replaces the earlier no-src rule. Actual browser checks must prove zero video-byte requests before explicit playback. Tiny still previews are page presentation, not automatic offline resource downloads.

Extract the same scene time from the five already qualified local files, preserving each file's visible quality, colors and full frame. Record original SHA, requested/actual timestamp, poster dimensions/bytes/SHA and extraction settings. Reuse a bounded static poster representation in the existing page embedding path: prefer inline small JPEGs over a new endpoint, bucket or client framework. Cap the aggregate poster payload at200KB before base64. No video re-encode. Reassess if the actual payload exceeds that budget.

Preserve the current page typography, tokens, widths, paired order, captions, figures, licensing and disclosures. This contract supersedes only the blank media well and custom text Play overlay. Review before/after screenshots at390×844 and1280×800. Native controls vary by browser; do not claim physical iPhone proof from desktop mobile emulation.

## Driver's-seat delta

Changed the initial-state acceptance from absence of src to absence of video network traffic. The former accidentally forced an unfamiliar blank placeholder; preload=none with posters separates visual readiness from video transfer. Changed evidence to include the unplayed player, keyboard activation, native controls, selected-only video requests, seeking and pause-other behavior. Reuse the five stored files and their exact identities; no new media discovery or encoder work.

Rejected autoplay/metadata preloading for thumbnails because it spends video bandwidth before intent. Rejected a third-party player framework because native controls already supply the interaction. Rejected one high-quality poster reused across all variants because it would misrepresent the compact file. Rejected a new poster service/storage binding for five fixed previews because it adds lifecycle work without improving this bounded page.

## Four-lens scope and boundaries

Apply the live driver's-seat, product, design and vodka lens instructions to this transcode showcase, as explicitly requested by the operator. Do not silently reuse FIA-v2 registration or claim endorsement by a human lens owner. Product reviews the single comparison journey; design reviews the rendered player against this contract and the previous page outside the changed well. Architecture reviews the narrow static presentation boundary, not a new server system.

The showcase is L5 presentation embedded in the existing Worker. It knows fixed comparison labels, verified resource URLs, preview bytes and published measurements. It does not know encoding internals, storage ownership or user accounts. It is not a new player platform, media cache, transcoder or offline-pack manager. No MCP tools, durable bindings, source handlers, container settings or encoding contracts change.

## Acceptance, release and reversal

Before release: actual rendered phone/laptop screenshots, all five native players visible with nonblank matched posters, keyboard-operable playback, selected-only R2 requests, clock advance, seeking, native fullscreen availability and one playing resource. Preserve exact file identities and original measurements. Run the existing focused demo tests and relevant typecheck; no unrelated encoding tests or extra transcodes. Record four lens findings and independent review. One sequential DEV→staging→production Git release train, each verified against its actual served page. Revert only this presentation commit if needed. Automation stays paused.
