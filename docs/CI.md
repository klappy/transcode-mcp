# CI/CD for transcode-mcp

This repository uses GitHub Actions for continuous integration.

## What runs on every push / PR

- **Type checking** (`bun run tsc --noEmit`)
- **Unit tests** (`bun test`)
- Optional **live smoke tests** against a preview Worker (only if the `WORKER_PREVIEW_URL` secret is set)

## Required Secrets (for full smoke testing)

Add this Repository Secret:

- `WORKER_PREVIEW_URL` → Your Cloudflare Workers preview or staging URL

When this secret is present, the `smoke-test` job will automatically run real HTTP checks against canon-formatted URLs and upload evidence as an artifact.

## Deploys — production vs. preview (read this before `wrangler deploy`)

`wrangler deploy` **always targets production** (`transcode-mcp` →
`transcode-mcp.<subdomain>.workers.dev`). It has no per-branch preview concept,
and because this Worker implements a Durable Object, Cloudflare does **not** mint
version preview URLs for it (`wrangler versions upload` produces no preview URL
for DO Workers). So branch/staging work goes through a separate, fully isolated
preview Worker defined as `[env.preview]` in `wrangler.toml`.

```bash
# Production (only from main / a reviewed state):
wrangler deploy

# Preview / staging (branch work — never touches production):
wrangler deploy --env preview          # -> transcode-mcp-preview.<subdomain>.workers.dev
```

Preview is a *different worker* with its **own** R2 bucket
(`transcode-mcp-audio-preview`), its own AudioContainer DO namespace, and its own
container. Production and preview share no state.

**One-time preview setup** (before the first `--env preview` deploy):

```bash
wrangler r2 bucket create transcode-mcp-audio-preview
wrangler deploy --env preview   # full deploy: applies the v1 DO migration to the
                                # preview DO and builds its container image
```

After that, `wrangler deploy --env preview` per branch is enough. Point the
`WORKER_PREVIEW_URL` CI secret at `https://transcode-mcp-preview.<subdomain>.workers.dev`
so smoke tests run against preview, never production.

For day-to-day branch iteration without any deploy, prefer `wrangler dev --remote`
(local server against real bindings).

## Local Development

```bash
bun install
bun run typecheck
bun test
WORKER_BASE_URL=https://your-preview.workers.dev bun run smoke-test.ts
```

## Extending the CI

- Add real Vitest tests in `src/**/*.test.ts`
- The workflow will automatically pick them up via `bun test`
- For preview deployments + smoke testing on every PR, we can add a separate deployment workflow later.
