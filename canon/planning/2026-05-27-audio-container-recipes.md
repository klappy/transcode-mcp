# Audio Container Recipes (ffmpeg)

## Proxy-First Principle
The Worker generates the proxy URL immediately using presets + half-class math. The container is only called on actual request (lazy). The container receives only the preset name and source URL.

## Voice Presets (8k / 16k / 32k mono)

### voice+low (8k telephone quality)
```bash
ffmpeg -i $SOURCE \
  -ac 1 -ar 8000 -c:a libopus -b:a 8k -vbr on \
  -application voip \
  output.opus
```

### voice+medium (16k clear speech)
```bash
ffmpeg -i $SOURCE \
  -ac 1 -ar 16000 -c:a libopus -b:a 16k -vbr on \
  -application audio \
  output.opus
```

### voice+high (32k high-quality voice)
```bash
ffmpeg -i $SOURCE \
  -ac 1 -ar 24000 -c:a libopus -b:a 32k -vbr on \
  -application audio \
  output.opus
```

## Music Presets (higher bitrate, stereo preserved)

### music+low
```bash
ffmpeg -i $SOURCE \
  -ac 2 -ar 44100 -c:a libopus -b:a 64k -vbr on \
  output.opus
```

### music+medium
```bash
ffmpeg -i $SOURCE \
  -ac 2 -ar 48000 -c:a libopus -b:a 96k -vbr on \
  output.opus
```

### music+high
```bash
ffmpeg -i $SOURCE \
  -ac 2 -ar 48000 -c:a libopus -b:a 128k -vbr on \
  output.opus
```

## Container Boundary Notes
- Worker passes only: preset name + source URL
- Container owns all ffmpeg details and perceptual tuning
- Output written to R2 with deterministic key (hash of preset + source)
- Worker caches the result on first successful transcode

**Evidence required**: Sample command output + resulting file (duration, bitrate, sample rate) for each preset.