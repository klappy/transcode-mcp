# GOVERNANCE: Deploy Architecture (production / staging / development + per-branch previews)

Status: CANON — strict. Read this before touching `wrangler.toml` environments,
Durable Object classes, container config, CI, or any deploy wiring. This exists
because the team re-derived all of it the hard way across many failed builds.
**Do not re-derive. Follow this. If reality contradicts it, fix the doc.**

## Invariants (never violate)

1. **Deploys go through Cloudflare Workers Builds** (CF dashboard connected to
   GitHub via githooks). **NEVER GitHub Actions.** Do not add `.github/workflows/*`
   that deploy. Workers Builds authenticates on Cloudflare's side, so there are
   no GitHub secrets for Cloudflare and there never should be.
2. **A container application is keyed on the Durable Object CLASS NAME**, not the
   worker name. Two workers cannot both own a container app for the same class
   (`DURABLE_OBJECT_ALREADY_HAS_APPLICATION`). Therefore **every full stack has
   its own DO class.**
3. **Each tier has its OWN R2 bucket. Never share a bucket across tiers.** This
   is WHY there are three workers and not two. The existing audio cache key is
   `sha256(source + preset + q + codec)` with NO recipe/version component, so a
   build that changes transcode *output* (a codec/bitrate/quality tweak — which
   this project tunes constantly) writes *different bytes under an existing key*.
   Anyone sharing that bucket then serves those experimental bytes. Therefore a
   tier that must stay clean (prod, and staging as the pre-prod gate) cannot
   share a bucket with anything — and since a connection's non-production
   (preview) lane shares the env worker's bucket with its live version, prod and
   staging keep their preview lanes OFF. Only the development tier shares one bucket
   among its branch versions (last-build-wins is acceptable there).
4. **`wrangler versions upload` cannot carry a NEW migration.** Preview/version
   uploads only work when the DO class + migration already exist on the worker.
5. **Prod and staging are single, stable workers** on their own branch / class /
   bucket. They never race and never share state with anything.

## The model

One `wrangler.toml`, three environments, three Workers Builds projects (one per
worker). Three DO classes, three buckets — the irreducible per-tier differences.

| Tier | Branch | Worker | DO class | Bucket | Deploy |
|------|--------|--------|----------|--------|--------|
| production | `production` | `transcode-mcp-production` | `AudioContainerProduction` | `transcode-mcp-audio-production` | `wrangler deploy --env production` |
| staging | `staging` | `transcode-mcp-staging` | `AudioContainerStaging` | `transcode-mcp-audio-staging` | `wrangler deploy --env staging` |
| development | `main` | `transcode-mcp-development` | `AudioContainerDevelopment` | `transcode-mcp-audio-development` | `wrangler deploy --env development` |
| PR preview | any PR branch | (a VERSION of `transcode-mcp-development`) | shared `AudioContainerDevelopment` | shared development bucket | `wrangler versions upload --env development` |

- **Development is the single shared preview backend.** Every PR branch is a *version* of
  the one preview worker, with its own stable alias
  `<branch>-transcode-mcp-development.<subdomain>.workers.dev`. All previews share the one
  preview container/DO/bucket. **Last-build-wins on shared state; each version still
  previews its own code.** Code-only PRs are effectively parallel-safe. A PR that
  changes the DO shape or container image needs a full development deployment — see below.
- Each DO class is a trivial subclass in `src/worker.ts`:
  `AudioContainerProduction`, `AudioContainerStaging`, `AudioContainerDevelopment`. The
  binding NAME stays `AUDIO_CONTAINER` in every env; only the class differs.

## Workers Builds project settings (the three projects)

Verified against the connected Workers Builds triggers on 2026-10-05:

- Production: worker `transcode-mcp-production`, branch `production`, command
  `npx wrangler deploy --env production`; no non-production trigger.
- Staging: worker `transcode-mcp-staging`, branch `staging`, command
  `npx wrangler deploy --env staging`; no non-production trigger.
- Development: worker `transcode-mcp-development`, branch `main`, command
  `npx wrangler deploy --env development`. Its non-production trigger accepts
  all branches except `main` and uses
  `npx wrangler versions upload --env development`.

Promotion is development (`main`) → staging → production. The top-level
`transcode-mcp` configuration is retired legacy configuration, not a deployment
target. Do not create replacement stacks. Existing tier classes and buckets are
already provisioned.

`preview_urls = true` is explicit only under `[env.development]`. Wrangler now
requires this opt-in to give uploaded versions a reachable URL. Dashboard
`previews_enabled: true` alone did not make version a4040938 reachable. The
initial bare versions-upload command selected legacy `AudioContainer` and failed
with API10061; adding the development environment fixed binding selection.

Container changes are not deployed by `versions upload`. A branch preview may
exercise its new Worker code against the existing development container. Actual
new container acceptance therefore requires the main development deployment and
its source/output proof before staging promotion; never call a preview Worker
success proof of the new container image.

## Maintenance rules

- **Bindings are non-inheritable in wrangler environments.** Any binding added to
  any tier MUST be mirrored into `[env.production]`, `[env.staging]` and `[env.development]`.
- **Adding/changing a DO migration** changes the development preview workflow: PR branches
  with a *new* migration cannot `versions upload`. To preview such a branch, push
  merge the reviewed candidate through the normal `main` gate for a full
  development deploy before staging promotion. This is the accepted edge case, not a bug.
- **Never point `--env development` or `--env staging` at the prod project.** Workers Builds
  overrides the config worker name to the project's worker; running the wrong env
  command in the prod project retargets prod.

## Failure modes seen (symptom → cause → fix)

- `Failed to match Worker name ... expected transcode-mcp. Overriding` → the
  command ran in the prod-bound Workers Builds project → run it in the project
  bound to the right worker.
- `DURABLE_OBJECT_ALREADY_HAS_APPLICATION` → two workers share a DO class → give
  each tier its own class (`AudioContainerProduction`, `AudioContainerStaging`, `AudioContainerDevelopment`).
- `Cannot create binding for class X ... not configured to implement Durable
  Objects` → the deploy targeted a worker whose live migrations don't define X
  (usually the name-override retargeting prod) → fix the project/worker mapping.
- Build keeps failing identically after a fix is pushed → **Retry re-runs the
  ORIGINAL commit.** Trigger a NEW build on the latest commit; never Retry.
- "new versions with new migrations cannot be uploaded" → a PR preview
  (`versions upload`) introduced a new migration → see Maintenance rules.

## What NOT to do (rejected approaches, with reasons)

- GitHub Actions deploys — rejected; we deploy only via Workers Builds.
- A single `[env.preview]` worker — rejected; one worker, PR2 overwrites PR1.
- Per-branch container/DO — rejected; unbounded classes, collisions, no scale.
- Cross-script binding a branch worker to staging's container-backed DO —
  UNVERIFIED; do not rely on it. The shared-preview model avoids needing it.
