# transcode-mcp

A media transcoding proxy. An automagic URL that drops into an `<img>` or `<audio>` tag with zero integration, plus an MCP control surface so an LLM can generate optimized URLs on behalf of a user.

The primary use case is packaging media resources for offline delivery in Bible translation projects — ensuring images and audio attached to a pericope assignment are as small as possible for a cheap Android phone with limited storage and a slow connection.

---

## The Goal — Read This First

**Outcome:** smaller files at acceptable perceived quality, delivered fast and cheap, for offline packaging on constrained devices.

**Cost function (what we minimize):** bytes per delivered media asset.

**Constraints in tension (the quality attributes this project holds simultaneously, per `klappy://canon/methods/quality-attribute-tension-survey`):**

| Constraint               | Floor / ceiling                                       | Why it tensions |
|--------------------------|-------------------------------------------------------|----------------|
| Perceived quality        | ≥ the floor set by the request's `q=low/med/high` preset | A smaller file that looks unacceptable is a failure, not a win |
| Transcode wall time      | Worker + container budget; first-request latency      | A perfect file the user waited too long for is a failure |
| Implementation simplicity| One Worker, one Container, presets as data, no per-request classification | Sophistication that won't survive a year of maintenance is a failure |
| Maintainability          | One person can operate it indefinitely                 | Configuration sprawl is a failure |
| Bandwidth cost (egress)  | Cloudflare egress on cache miss; R2 cost on hit       | Bytes paid twice is a failure |
| Storage cost (R2)        | Content-addressed; lifecycle GC                        | Stored variants that won't be re-read are a failure |

**Decision protocol:** any encoder choice (resolution, quality, format, codec, sample rate) is evaluated against ALL of these simultaneously. There is no single "right value" derived from geometry. There is a set of candidate configurations, each scored on bytes-and-quality-and-time-and-simplicity, and the one that holds all the constraints with the smallest byte cost wins. When constraints conflict, the operator (or the canon planning doc for the relevant class) names the trade explicitly — not implicitly by picking one and ignoring the others.

**Core principle (`canon/handoffs/2026-05-26-exploration-journal.md`):** spend nothing on what the human can't perceive; control the character of the loss; the system of constraints is the trick.

If a proposed rule reduces bytes but degrades quality below the floor — reject. If it improves quality but costs bytes the user can't perceive — reject. If it improves both but adds a per-request classifier that won't survive maintenance — reject. **The art is in holding all of them at once.**

---

## Project Identity — Proactive Integrity

**Orientation:** Before I speak, I observe. Before I claim, I verify. Before I confirm, I prove. What I have not seen, I do not know. What I have not verified, I will not imply.

See full details in [canon/values/project-identity.md](canon/values/project-identity.md) and the full goal framing in [canon/values/project-goal.md](canon/values/project-goal.md).

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
- **Perceptual Optimization**: Uses encoder-parameter selection (resolution × quality × format) tuned to the per-request budget, with preset-specific ffmpeg recipes for voice vs music.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for current state.

## Canon & Governance

The project's durable record lives in `canon/`. Exploration artifacts, planning decisions, and session journals are committed there as they are produced. The canon is the source of truth — not this README, not inline comments, not conversation memory.

- `canon/handoffs/` — session journals
- `canon/encodings/` — DOLCHEO+ structured decision records
- `canon/planning/` — planning session artifacts
- `canon/values/` — project identity, orientation, axioms, **and the goal**
- `canon/constraints/` — definition of done, core governance baseline

**Agent operating protocol:** at the start of every session in this repo, the first oddkit calls are `get` on `canon/values/project-goal.md` and `canon/values/project-identity.md`. The goal is the cost function; the identity is the creed. Skipping either is how rules get built against the wrong objective.

## License

TBD ("pay it forward, pay it back" model under consideration)
