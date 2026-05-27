# Architecture

## Current State

Exploration complete (2026-05-26, session 1). Planning in progress (2026-05-26,
session 2).

## What It Is

A stateless HTTP proxy that transcodes media on the fly. The URL is the API:

    https://transcode.klappy.dev/image/w=800,q=low,f=auto/https://example.com/photo.jpg
    https://transcode.klappy.dev/audio/preset=voice,q=low/https://example.com/podcast.mp3

Drop the proxy URL into an `<img src="">` or `<audio src="">` tag. No SDK, no
client library, no API key for read access. The same URL convention is exposed
as an MCP tool surface so an LLM can generate optimized URLs programmatically.

## Primary Use Case

Package media resources for offline delivery in Bible translation projects.
Images and audio attached to a pericope assignment need to be as small as
possible for a cheap Android phone with limited storage and a slow connection.
The translation workspace app already knows the list of media URLs — it
rewrites each through the proxy with the right preset and bundles the results.

## Core Method

**Multi-objective constrained optimization.** Minimize bytes subject to a set
of constraints held simultaneously. The constraints — perceived quality floor,
transcode wall time, implementation simplicity, maintainability, egress cost,
storage cost — are named and quantified in
[canon/values/project-goal.md](canon/values/project-goal.md). Every encoder
choice is scored against all of them, not against one in isolation.

The principle that orients the trades is from the exploration journal: spend
nothing on what the human can't perceive; control the character of the loss;
the system of constraints is the trick. The art is in holding all of them at
once.

The techniques the system uses to find bytes-cheap configurations that clear
the quality floor:

- **Per-axis perceptual leash** — push each axis (chroma, color depth,
  resolution, bit budget, sample rate) to just short of its breaking point
- **Control the character of the loss** — degrade toward natural soft blur,
  away from blocking/ringing/banding
- **Half-class resolution overshoot** — for downsamples from lossy sources,
  encode at ~1.5x the target so the display downscale cleans up artifacts.
  Applied conditionally, not universally — see encode-resolution planning doc.
- **Three quality presets** — low (q=20), medium (q=50), high (q=80),
  same intent across media types, different codec settings per type
- **Interchangeable knobs** — resolution, quality parameter, and format are
  interchangeable levers against the byte budget. The encoder picks the
  cheapest combination that clears the floor; no lever is privileged.

None of these is the rule by itself. They are techniques in service of the
multi-objective optimum.

## Platform

One Cloudflare Worker. No Container needed for images (v1). Presets as data.

### Images (v1)

- **Transform engine:** Cloudflare Images binding (env.IMAGES)
- **Cache:** Cloudflare Cache API (no R2, no stored variants)
- **Orphan risk:** Zero — nothing is stored; cache evicts naturally
- **Worker code:** ~60 lines

### Audio (v1)

- **Transform engine:** Container with ffmpeg (Cloudflare Media binding lacks
  bitrate/quality controls for audio)
- **Cache:** R2 content-addressed by sha256(source hash + normalized params)
- **Orphan risk:** R2 lifecycle rules — 90-day eviction after last access
- **Presets:** voice and music

### Video (future, architecture-ready)

- **Transform engine:** Cloudflare Media binding (env.MEDIA) or Container
- **Deferred from v1 launch** — URL convention and Worker routing handle video
  today; the transform pipeline is not yet built

## URL Convention

    /{media_type}/{options}/{source_url}

- **media_type** — image, audio, video. Routes to the correct pipeline.
- **options** — comma-separated key=value pairs.
- **source_url** — the rest of the path. No URL-encoding needed.

## MCP Tool Surface

Same URL vocabulary, different transport. The MCP tool generates proxy URLs.
The LLM is a smart URL constructor — it picks the right preset and width based
on the user's context and returns URL strings.

## What Comes Next
