---
title: "URL Vocabulary and Presets"
date: 2026-05-26
mode: planning
status: draft
project: transcode-mcp
---

# URL Vocabulary and Presets

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
| w   | integer (pixels)            | auto     | Target display width. Half-class overshoot applied automatically. |
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
