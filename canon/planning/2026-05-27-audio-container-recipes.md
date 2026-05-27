---
title: Audio Container Recipes (ffmpeg)
date: 2026-05-27
status: working
mode: planning
derives_from: canon/planning/2026-05-26-url-vocabulary-and-presets.md
complements:
  - canon/planning/2026-05-26-worker-container-boundary.md
applied_canon:
  - klappy://canon/principles/vodka-architecture
---

# Audio Container Recipes (ffmpeg)

> Six ffmpeg recipes — three voice presets (8k / 16k / 32k mono, libopus, telephone → high-quality voice) and three music presets (64k / 96k / 128k stereo at 44.1 or 48 kHz, libopus). Each recipe is a single self-contained ffmpeg command. The Worker passes only the preset name plus the source URL into the Container; the Container resolves the preset name to a recipe and runs it. Recipes are data, not code branches — adding or tuning a preset is editing this file, not changing the Container source.

---

## Summary — Six Recipes, Two Content Classes, All libopus

The Container's audio job is to take a source URL and a preset name and produce an opus file at the bitrate, sample rate, and channel layout the preset names. There are exactly six presets in v1: voice+low (8k telephone-quality), voice+medium (16k clear speech, the default for voice on cheap phones), voice+high (32k high-quality voice), music+low (64k stereo background), music+medium (96k stereo general delivery), music+high (128k stereo high-quality playback). All six use libopus because opus dominates the perceptual-quality-per-bit benchmarks at speech and low-music bitrates. Voice recipes use `-application voip` at the lowest bitrate (the codec's telephone-optimized mode) and `-application audio` at higher bitrates (the codec's general mode). Music recipes use the default application. Each recipe is verified at pick-time, not from-memory — the Container's pick step looks up the recipe in this file and runs it as-is.

---

## Proxy-First Principle

The Worker generates the proxy URL immediately using presets and half-class math. The Container is only invoked on actual request (lazy). The Container receives only the preset name and the source URL; it does not know the URL vocabulary, the half-class math, or the cache strategy.

---

## Voice Presets — Mono, libopus, Frequency Ceiling Floored to Content

### voice+low (8k, telephone-quality)

```bash
ffmpeg -i $SOURCE \
  -ac 1 -ar 8000 -c:a libopus -b:a 8k -vbr on \
  -application voip \
  output.opus
```

### voice+medium (16k, clear speech — the default for voice on cheap phones)

```bash
ffmpeg -i $SOURCE \
  -ac 1 -ar 16000 -c:a libopus -b:a 16k -vbr on \
  -application audio \
  output.opus
```

### voice+high (32k, high-quality voice — review and editing)

```bash
ffmpeg -i $SOURCE \
  -ac 1 -ar 24000 -c:a libopus -b:a 32k -vbr on \
  -application audio \
  output.opus
```

---

## Music Presets — Stereo, libopus, Full Frequency Ceiling

### music+low (64k stereo, background music)

```bash
ffmpeg -i $SOURCE \
  -ac 2 -ar 44100 -c:a libopus -b:a 64k -vbr on \
  output.opus
```

### music+medium (96k stereo, general delivery)

```bash
ffmpeg -i $SOURCE \
  -ac 2 -ar 48000 -c:a libopus -b:a 96k -vbr on \
  output.opus
```

### music+high (128k stereo, high-quality playback)

```bash
ffmpeg -i $SOURCE \
  -ac 2 -ar 48000 -c:a libopus -b:a 128k -vbr on \
  output.opus
```

---

## Container Boundary Notes

- The Worker passes only `(preset_name, source_url)` to the Container.
- The Container owns ffmpeg and all codec details.
- Output is written to R2 with a deterministic key (sha256 of canonical source identity plus normalized preset name).
- The Worker caches the result on first successful transcode (content-addressed; no TTL).

---

## Evidence Required Before This Document Moves from `working` to `stable`

For each of the six presets:

- Sample input file (URL or path).
- Reported output duration, bitrate, sample rate from `ffprobe` on the output.
- Listening sanity check on the target playback chain (cheap Android phone, mono earbud for voice; stereo for music).

This evidence has not yet been captured. Until it is, this document's status remains `working` and code that depends on these exact flags is itself `working`, not `stable`.
