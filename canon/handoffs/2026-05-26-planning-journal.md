---
title: "Session Journal — Media Transcoding Proxy, Planning Session 1"
audience: journal
date: 2026-05-26
mode: planning
status: complete
project: transcode-mcp
operator: Christopher Klapp
prior_session: "2026-05-26-exploration-journal.md"
---

# Session Journal — Media Transcoding Proxy, Planning Session 1

## Orientation

This session picked up after the exploration session's convergence. The
exploration journal (493 lines) and DOLCHEO+ encoding (37 rows) were read in
full. The session gated into planning mode via oddkit (exploration → planning,
PASS after stating problem definition and reviewing constraints).

## What happened

### Reading ptxprint-mcp source (the first planning task)

The handoff required reading the actual source of klappy/ptxprint-mcp — not
just README/ARCHITECTURE.md. The repo was fetched via GitHub archive and read:

- src/index.ts (1178 lines) — Worker entry, 6 MCP tools, fetch handler,
  internal routes, R2 proxy, telemetry hooks
- src/container.ts (32 lines) — Container DO wrapper, sets port and sleepAfter
- container/main.py (406 lines) — FastAPI handler: fetches inputs, runs
  PTXprint subprocess, uploads artifacts via Worker callback
- src/job-state-do.ts (154 lines) — per-job Durable Object state machine
- src/payload.ts (118 lines) — Zod schema, JCS canonicalization, sha256 hashing
- wrangler.jsonc (120 lines) — all bindings

Key observations from the code (not visible in README/ARCHITECTURE.md):
- Container calls back through the Worker's public URL to patch DO state and
  upload artifacts — not via service binding
- The job_id IS the payload hash, giving free idempotency
- The Worker is genuinely thin — validates, hashes, cache-checks R2, dispatches

### The architecture pivot — from ptxprint-mcp clone to HTTP proxy

The initial boundary document modeled transcode-mcp as a ptxprint-mcp clone:
Worker + Container + DOs + R2. The operator challenged this repeatedly,
converging on a much simpler model through three key moves:

**Move 1: R2-folder-as-protocol.** The operator proposed using R2 bucket
structure as the coordination surface. Cleaner than explicit dispatch but
raised orphan management concerns.

**Move 2: Prior art search → Cloudflare Images binding.** Searching for the
most vodka approach revealed that Cloudflare has an env.IMAGES binding that
transforms images directly in a Worker from a ReadableStream — no Container
needed. Also discovered env.MEDIA binding for video/audio (March 2026), which
extracts audio as M4A but lacks bitrate/quality controls.

**Move 3: Actual HTTP proxy.** The operator's final insight: "what if we did
what I used to do years ago — make an actual proxy?" This collapsed the
architecture to its simplest form. The URL IS the API. The proxy is stateless.
For images: no R2, no DOs, no Container — just Worker + Cloudflare Images
binding + Cache API. For audio: R2 + Container only because Cloudflare lacks
an audio transcode binding with quality controls.

### Quality presets: 20/50/80

The operator moved from initial 40/60/80 to 20/50/80, reasoning that with
the half-class upsample absorbing artifacts on the display downscale, the
spread should be wider. q=20 is viable precisely because the upsample +
downscale acts as artifact cleanup.

### URL convention

Settled on media-type-prefixed convention:

    /image/w=800,q=low,f=auto/https://example.com/photo.jpg
    /audio/preset=voice,q=low/https://example.com/podcast.mp3
    /video/w=720,q=medium/https://example.com/clip.mp4

### Primary use case crystallized

Packaging media resources for offline delivery in Bible translation projects.
A translation workspace app knows the pericope, knows which images/audio are
attached, and needs them as small as possible for a cheap Android phone. The
app constructs proxy URLs and fetches them in parallel.

### MCP tool role

The MCP tool is a URL constructor. It generates proxy URLs based on context.
The primary caller is the translation workspace app (programmatic). The MCP
layer teaches an LLM how to use the proxy when assisting a translator.

## Decisions locked in this session

1. Architecture: stateless HTTP proxy (not a ptxprint-mcp clone)
2. Images: Cloudflare Images binding, Cache API only
3. Audio: Container + ffmpeg + R2
4. Quality presets: 20/50/80
5. URL convention: /{media_type}/{options}/{source_url}
6. MCP tool: URL constructor returning strings
7. No batch API — callers handle batching

## Open items carried forward

- P1: Large-source identity cost (audio-only now)
- Exact half-class resolution arithmetic with worked examples
- Audio Container recipe format (ffmpeg flags as data)
- Video pipeline design (deferred from v1)

## Meta-notes

The assistant's initial approach cloned ptxprint-mcp's architecture. The
operator's repeated challenges drove three successive simplifications. Each
round removed machinery. The final architecture has less code, fewer moving
parts, and no orphan risk for the primary use case. This is borrow-don't-build
working at the architecture level.
