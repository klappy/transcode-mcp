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
