# transcode-mcp

A media transcoding proxy. An automagic URL that drops into an `<img>` or `<audio>` tag with zero integration, plus an MCP control surface so an LLM can generate optimized URLs on behalf of a user.

The primary use case is packaging media resources for offline delivery in Bible translation projects — ensuring images and audio attached to a pericope assignment are as small as possible for a cheap Android phone with limited storage and a slow connection.

The product's value is transcoding craft — finding the perceptual axis the human under-samples, spending nothing there, and pouring the entire budget into what will actually be looked at and listened to. The proxy is only the delivery mechanism.

## Project Identity — Proactive Integrity

**Orientation**: Before I speak, I observe. Before I claim, I verify. Before I confirm, I prove. What I have not seen, I do not know. What I have not verified, I will not imply.

See full details in [canon/values/project-identity.md](canon/values/project-identity.md)

## Status

**Execution phase — Core functionality live**

- Real MCP tools: `generate_transcode_url` (with perceptual half-class math) + `docs` (canon proxy via oddkit)
- Real lazy proxy handlers for `/image/*` and `/audio/*`
- Optimized FFmpeg audio transcoding (voip mode, VBR, filters, streaming)
- Production deployment via Cloudflare direct integration

## Features

- **MCP Control Surface**: LLM agents can call `generate_transcode_url` to get optimized proxy URLs.
- **Canon-Aware `docs` Tool**: Proxies natural language queries to the project's canon (following the PTXprint-MCP / oddkit pattern).
- **Proxy-First + Lazy Architecture**: URLs are generated instantly; actual transcoding/caching only happens on first request.
- **Perceptual Optimization**: Uses half-class overshoot math and preset-specific ffmpeg recipes tuned for voice vs music.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for current state.

## Canon & Governance

The project's durable record lives in `canon/`. Exploration artifacts, planning decisions, and session journals are committed there as they are produced. The canon is the source of truth — not this README, not inline comments, not conversation memory.

- `canon/handoffs/` — session journals
- `canon/encodings/` — DOLCHEO+ structured decision records
- `canon/planning/` — planning session artifacts
- `canon/values/` — project identity, orientation, axioms
- `canon/constraints/` — definition of done, core governance baseline

## License

TBD ("pay it forward, pay it back" model under consideration)
