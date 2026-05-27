# transcode-mcp

A media transcoding proxy. An automagic URL that drops into an `<img>` or
`<audio>` tag with zero integration, plus an MCP control surface so an LLM can
generate optimized URLs on behalf of a user.

The primary use case is packaging media resources for offline delivery in Bible
translation projects — ensuring images and audio attached to a pericope
assignment are as small as possible for a cheap Android phone with limited
storage and a slow connection.

The product's value is transcoding craft — finding the perceptual axis the
human under-samples, spending nothing there, and pouring the entire budget into
what will actually be looked at and listened to. The proxy is only the delivery
mechanism.

## Project Identity — Proactive Integrity

**Orientation**: Before I speak, I observe. Before I claim, I verify. Before I confirm, I prove. What I have not seen, I do not know. What I have not verified, I will not imply.

See full details in [canon/values/project-identity.md](canon/values/project-identity.md)

## Status

Exploration complete. Planning in progress.

## Canon

The project's durable record lives in `canon/`. Exploration artifacts, planning
decisions, and session journals are committed there as they are produced. The
canon is the source of truth — not this README, not inline comments, not
conversation memory.

- `canon/handoffs/` — session journals
- `canon/encodings/` — DOLCHEO+ structured decision records
- `canon/planning/` — planning session artifacts
- `canon/values/` — project identity, orientation, axioms

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for current state.

## License

TBD
