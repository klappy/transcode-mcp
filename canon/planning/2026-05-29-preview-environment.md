---
title: "Preview Environment — A Separate Isolated Worker, Because a DO Worker Gets No Version Preview URL"
date: 2026-05-29
status: working
mode: planning
derives_from: canon/planning/2026-05-29-audio-worker-path.md
complements:
  - docs/CI.md
---

# Preview Environment — A Separate Isolated Worker, Because a DO Worker Gets No Version Preview URL

> Branch/staging work was being deployed with `wrangler deploy`, which always
> targets **production** — there is no per-branch preview. The lightweight
> alternative (`wrangler versions upload`, which mints a version preview URL) is
> unavailable here: Cloudflare does not generate version preview URLs for any
> Worker that implements a Durable Object, and our worker implements the
> `AudioContainer` DO. So we add a separate, fully isolated preview Worker as
> `[env.preview]` in `wrangler.toml` — `transcode-mcp-preview`, with its own R2
> bucket, its own DO namespace, and its own container — deployed with
> `wrangler deploy --env preview`. It never touches production, and its
> workers.dev URL is the preview URL the DO limitation otherwise denies us.
> Production and preview share NO state, by explicit requirement.

---

## Problem

`wrangler deploy` deploys to the production worker (`transcode-mcp` →
`transcode-mcp.<subdomain>.workers.dev`). Every branch deploy clobbered live
production. We wanted isolated preview URLs.

Two facts (Cloudflare docs, verified 2026-05-29) box us in:

- **Preview URLs are not generated for Workers that implement a Durable Object.**
  So `wrangler versions upload` — the usual "stage a version, get a preview URL,
  promote later" path — yields no clickable preview URL for this worker.
- **Uploading a version with Durable Object migrations is not supported; use
  `wrangler deploy`.** This is why the AudioContainer migration forced a full
  deploy in the first place.

## Decision

Add `[env.preview]` to `wrangler.toml` — a separate named environment, which
Wrangler deploys as the worker `transcode-mcp-preview` at
`transcode-mcp-preview.<subdomain>.workers.dev`. `wrangler deploy --env preview`
deploys ONLY that worker; production (`transcode-mcp`) is untouched.

Bindings are non-inheritable in Wrangler environments, so each is redefined
under the env against its **own** preview resources:

- **R2:** `transcode-mcp-audio-preview` — a separate bucket. Production and
  preview never share a bucket. (Hard requirement: clean staging/prod isolation.)
- **Durable Object / container:** the env's `AUDIO_CONTAINER` resolves to a
  distinct DO namespace automatically because the worker name differs, with its
  own container image and `v1` migration applied on first `--env preview` deploy.
- **Images:** the account-level `IMAGES` binding (stateless transforms; nothing
  to isolate).

Production deploys remain `wrangler deploy` from a reviewed state (ideally
`main`). Day-to-day branch iteration prefers `wrangler dev --remote`; the preview
worker is for shareable, deployed staging.

## Why Not the Alternatives

- **`wrangler versions upload` (no new env).** No preview URL for a DO worker, so
  it does not deliver the isolated preview we want. Useful only as a
  promote/rollback safety net for production.
- **Share production's R2 bucket for preview.** Rejected by requirement and on
  merit: shared state defeats isolation; preview writes, lifecycle, and GC would
  touch production storage. Content-addressing makes it *low-risk*, not *isolated*.
- **Cloudflare Workers Builds preview branches.** Still bound by the DO
  preview-URL limitation; to get a real URL it would have to deploy to a separate
  environment anyway — i.e., this decision. Workers Builds can be layered on top
  later to automate `--env preview` per PR.

## Operations

One-time setup before the first preview deploy:

```
wrangler r2 bucket create transcode-mcp-audio-preview
wrangler deploy --env preview   # applies the v1 DO migration to the preview DO,
                                # builds + pushes the preview container image
```

Then `wrangler deploy --env preview` per branch. Point the CI `WORKER_PREVIEW_URL`
secret at the preview worker so smoke tests never hit production. The full
runbook lives in `docs/CI.md`.

## Risks and Reversibility

- **Cost.** A second container pool and a second R2 bucket. Containers are
  start-on-demand (active-CPU billing, scale to zero when idle), so the steady
  cost is storage. **The preview bucket must get the same 90-day lifecycle GC
  rule as production** or it will accumulate transcodes indefinitely.
- **Config drift.** The preview env duplicates the prod bindings (non-inheritable
  keys), so a binding added to prod must be mirrored to `[env.preview]`. Mitigated
  by keeping both blocks adjacent in `wrangler.toml`.
- **Reversibility: high.** Deleting the `[env.preview]` block and the preview
  bucket removes the environment; production config is untouched by its presence.
- **Disconfirmer.** Cloudflare calls the DO/preview-URL gap a temporary
  limitation. If they ship version preview URLs for DO Workers, revisit whether
  the separate env is still worth its cost (it may remain preferable for true
  state isolation regardless).

## Success Criteria

- `wrangler deploy --env preview` deploys `transcode-mcp-preview` and leaves
  `transcode-mcp` (production) untouched.
- `/audio/...` on the preview worker writes to `transcode-mcp-audio-preview`, not
  the production bucket.
- The preview worker serves the demo + proxy at
  `transcode-mcp-preview.<subdomain>.workers.dev`.
- CI smoke tests run against `WORKER_PREVIEW_URL` = the preview worker.
