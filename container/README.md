# Audio transcode container

A minimal ffmpeg server fronted by the `AudioContainer` Durable Object in
`src/worker.ts`. The Worker dispatches `(source_url, preset, q, codec)`; this
server resolves the recipe, runs ffmpeg, and returns the encoded bytes plus
`ffprobe` metadata in response headers (`X-Audio-Bitrate`, `X-Audio-SampleRate`,
`X-Audio-Channels`, `X-Audio-Duration`, `X-Source-Bytes`). It owns ffmpeg and
the recipe table and nothing else — no cache key, no R2, no credentials. See
`canon/planning/2026-05-26-worker-container-boundary.md`.

## Boundary

- Input: `POST /` (any path) with JSON `{ source_url, preset, q, codec }`.
- Output on success: `200` with the encoded audio body + metadata headers.
- Output when no recipe exists for the combination: `422` (the Worker then
  passes the source through, never errors).

## Recipes

`recipes.mjs` is DATA mirroring
`canon/planning/2026-05-27-audio-container-recipes.md`. Slice 1 ships voice +
opus (8k/16k/32k mono). Add a codec or preset by extending the table, not the
server.

## Verifying recipes locally (the recipe Definition of Done)

```sh
# Generate a sample voice clip, then run a recipe and probe the output.
ffmpeg -f lavfi -i "sine=frequency=220:duration=5" -ac 1 sample.wav
ffmpeg -hide_banner -y -i sample.wav \
  -ac 1 -ar 16000 -c:a libopus -b:a 16k -vbr on -application audio out.opus
ffprobe -v quiet -print_format json -show_format -show_streams out.opus
```

The reported channels/sample-rate/bitrate must match the recipe table.

## Build / deploy

The container builds and deploys with the Worker via `wrangler deploy` (Docker
must be running locally at deploy time). See `wrangler.toml` `[[containers]]`.
