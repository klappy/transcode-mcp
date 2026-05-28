---
title: "URL Vocabulary and Presets"
date: 2026-05-26
status: working
mode: planning
derives_from: canon/handoffs/2026-05-26-planning-journal.md
---

# URL Vocabulary and Presets

> The proxy URL is `https://transcode.klappy.dev/{media_type}/{options}/{source_url}` where `media_type` is `image` or `audio` (video deferred), `options` is comma-separated `key=value` pairs with no spaces and order-independent, and `source_url` is the rest of the path with no URL-encoding required. Image options: `w`, `h`, `q` (low/medium/high → 20/50/80), `f` (auto/avif/webp/jpeg). Audio options: `preset` (voice/music), `q` (low/medium/high). Quality presets cross-multiply with content type to give six audio combinations from telephone-quality voice (voice+low, 8k mono) to high-quality music (music+high, 128k stereo).

---

## Summary — One URL Shape, Two Media Types, Six Audio Combinations

This document is the binding specification for the URL the proxy serves. It defines the path shape, the option grammar, the quality presets, and the MCP tool schema that wraps them. The URL is the API — both for direct callers (a translation app constructing URLs by string concatenation) and for the MCP tool surface (an LLM picking presets and widths from context). The half-class overshoot is computed by the Worker from the target dimensions and the source dimensions; callers do not specify the encode resolution. Status is `working` because the audio recipes in `canon/planning/2026-05-27-audio-container-recipes.md` have not yet been verified against real source files; the URL vocabulary itself is settled.

---

## URL Structure

    https://transcode.klappy.dev/{media_type}/{options}/{source_url}

### media_type

Required first path segment. Routes to the correct transform pipeline.

| Value   | Pipeline                        | v1 status |
|---------|---------------------------------|-----------|
| image   | Cloudflare Images binding       | ship      |
| audio   | Container + ffmpeg + R2         | ship      |
| video   | Cloudflare Media binding / TBD  | deferred  |

### options

Comma-separated key=value pairs. No spaces. Order does not matter.

#### Image options

| Key | Values                      | Default  | Description |
|-----|-----------------------------|----------|-------------|
| s   | integer (pixels)            | auto     | Target SHORTEST side. Preferred sizing input: stable across device rotation. The worker maps it to a width from the source orientation, then applies the half-class overshoot. |
| w   | integer (pixels)            | auto     | Target display width (advanced). Overrides s. Half-class overshoot applied automatically. |
| h   | integer (pixels)            | auto     | Target display height. Maintains aspect ratio with w. |
| q   | low, medium, high           | medium   | Quality preset. |
| f   | auto, avif, webp, jpeg      | auto     | Output format. auto selects best for the requesting browser. |

#### Audio options

| Key    | Values                      | Default  | Description |
|--------|-----------------------------|----------|-------------|
| preset | voice, music                | voice    | Content-type preset. |
| q      | low, medium, high           | medium   | Quality preset (maps to bitrate/sample-rate per content preset). |

### source_url

Everything after the options segment. The full origin URL of the source media,
not URL-encoded. The parser splits on the boundary between the options segment
and the source URL (which starts with http:// or https://).

## Quality Presets

### Image quality

| Preset | quality | Use case |
|--------|---------|----------|
| low    | 20      | Thumbnails, previews, Save-Data, offline packaging on constrained devices |
| medium | 50      | Default delivery, cheap Android, most offline use |
| high   | 80      | Detail view, pinch-zoom expected, desktop review |

With the half-class upsample absorbing artifacts on the display downscale,
q=20 produces usable results where it normally would not.

### Audio quality

| Preset + q   | Bitrate | Sample rate | Channels | Use case |
|--------------|---------|-------------|----------|----------|
| voice+low    | 8k      | 8000 Hz     | mono     | Telephone-quality speech, maximum compression, offline on constrained devices |
| voice+medium | 16k     | 16000 Hz    | mono     | Clear speech, default for voice recordings on cheap phones |
| voice+high   | 32k     | 24000 Hz    | mono     | High-quality voice, review/editing, good earbuds |
| music+low    | 64k     | 24000 Hz    | stereo   | Background music, low-bandwidth |
| music+medium | 128k    | 44100 Hz    | stereo   | General music delivery |
| music+high   | 192k    | 48000 Hz    | stereo   | High-quality music, good playback chain |

## Shortest-Side Sizing (`s`)

`s` is the preferred way to size images. It names the **shortest side** of the
intended display, in CSS pixels. Because a phone rotates — the same photo is
landscape or portrait depending on how it's held — a literal `w` (width) is an
arbitrary axis. The shortest side is the stable "resolution class": an `s=720`
image carries the same per-pixel quality whether shown 720 wide (portrait) or
720 tall (landscape).

The Worker resolves `s` to a target width at request time, using the measured
source orientation:

    portrait or square (sourceW <= sourceH):  width = s
    landscape          (sourceW >  sourceH):  width = round(s * sourceW / sourceH)

That width then feeds the half-class overshoot below. Callers do not compute
this — only the Worker knows the true orientation at request time, so the
mapping lives there. `w` remains available as an advanced escape hatch and
overrides `s` when both are present.

## Half-Class Resolution Overshoot

The Worker computes the encode resolution from the target display width and the
source dimensions:

    encode_width = min(target_width * 1.5, source_width * 1.5)

If the source is smaller than the target, the encode width is capped at
source * 1.5. Exact arithmetic with worked examples is a planning follow-up.

## Examples

### Image — offline packaging for a pericope

    <img src="https://transcode.klappy.dev/image/w=800,q=low,f=auto/https://cdn.example.org/gen-1-1.jpg">
    <!-- Result: ~1200px wide AVIF (800*1.5), quality 20, ~30-80 KB -->

### Audio — voice recording for offline

    <audio src="https://transcode.klappy.dev/audio/preset=voice,q=low/https://cdn.example.org/gen-1-1-reading.mp3">
    <!-- Result: 32kbps mono, ~240 KB for a 1-minute recording -->

### Programmatic batch — translation app packaging

The app has 47 image URLs and 12 audio URLs for a pericope assignment. It
constructs 59 proxy URLs by string concatenation, fetches them in parallel,
and packages the results for offline sync. The proxy doesn't know about the
batch.

## MCP Tool Surface

One tool: transcode. Generates proxy URLs.

    {
      "name": "transcode",
      "description": "Generate a transcode-mcp proxy URL for optimized media delivery.",
      "parameters": {
        "source_url": "The origin URL of the media to transcode",
        "media_type": "image | audio | video",
        "options": {
          "w": "Target display width (images/video)",
          "h": "Target display height (images/video)",
          "q": "Quality preset: low | medium | high",
          "f": "Output format (images): auto | avif | webp | jpeg",
          "preset": "Content preset (audio): voice | music"
        }
      },
      "returns": "A proxy URL string"
    }
