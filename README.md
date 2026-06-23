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

## Response Headers & CORS

The proxy is transparent about what it did. Every transcoded image response
carries a descriptive `X-Transcode-*` set so the caller can see which
constraint bound the output and which knobs to turn. **Currently shipped** on
the `/image/*` transcode path:

| Header | Meaning |
|--------|---------|
| `X-Transcode-Source-W` / `-H`   | Measured source dimensions (px) |
| `X-Transcode-Encode-W` / `-H`   | Encode dimensions after half-class overshoot |
| `X-Transcode-Quality`           | Effective quality (0–100) |
| `X-Transcode-Format`            | Output content type chosen |
| `X-Transcode-Binding`           | Which constraint bound the encode dimension |
| `X-Transcode-Cache`             | `HIT` / `MISS` / `PASS` |

**Planned — savings-headers slice** (spec:
[`canon/planning/2026-06-22-response-savings-headers.md`](canon/planning/2026-06-22-response-savings-headers.md)):
adds `X-Transcode-Source-Bytes` and `X-Transcode-Encoded-Bytes` (the source and
transcoded file sizes the proxy already measures), plus
`Access-Control-Allow-Origin: *` and an `Access-Control-Expose-Headers` list, so
a browser `fetch()` can read the byte counts cross-origin and show real savings
instead of a heuristic. New response headers extend the `X-Transcode-*` family;
the as-built names are canonical (see the drift note in
[`canon/handoffs/2026-05-29-design-session.md`](canon/handoffs/2026-05-29-design-session.md)).

## Testing

The MCP server is tested at four layers, in order of feedback speed:

### 1. Unit tests (fast, run on every change)

`bun test` runs the suite. The pure URL-construction and tool-response builders are tested directly (no MCP SDK, no network):

```sh
bun test
```

Covers: viewport → `s=` mapping, raw `w/h` escape hatch precedence, quality and format passthrough, the full response shape (`proxy_path`, `full_url`, `embed`, request echo, guidance), audio passthrough, source-aspect-aware shortest-side resolution, URL parser validation.

### 2. Live smoke test (proves the protocol works end-to-end)

`smoke-mcp.ts` is a no-mocks JSON-RPC client that POSTs to a deployed `/mcp` endpoint and asserts the responses. Same protocol Claude Desktop / Cursor / the Inspector would use.

```sh
bun smoke-mcp.ts                 # production
bun smoke-mcp.ts preview         # current branch preview
bun smoke-mcp.ts https://your-deploy.workers.dev
```

Covers: `initialize` handshake (protocol version, server info, tools capability), `tools/list` (schema advertises `viewport` + `q/f/w/h`), `tools/call` for image (viewport → `s=`, `w` overrides), `tools/call` for audio. Exits non-zero on first failure.

### 3. MCP Inspector (interactive verification)

The [official MCP Inspector](https://github.com/modelcontextprotocol/inspector) is a web UI that connects to any MCP server, shows the advertised tools/schemas, and lets you fire `tools/call` requests by hand. Best for human verification and exploring the response payload.

```sh
npx @modelcontextprotocol/inspector
# In the UI:
#   Transport: Streamable HTTP
#   URL: https://transcode-mcp.klappy.workers.dev/mcp
```

### 4. Real MCP client (the actual product use case)

Point a real client at the deployed `/mcp` endpoint to verify it integrates correctly with the runtime an LLM agent would actually use.

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "transcode-mcp": {
      "type": "http",
      "url": "https://transcode-mcp.klappy.workers.dev/mcp"
    }
  }
}
```

Restart Claude Desktop. Ask the model to "use the transcode tool to make a proxy URL for [image URL] at 720px shortest side."

**Cursor / Claude Code** — same config shape in their respective MCP settings, pointing at the same `/mcp` URL.

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
