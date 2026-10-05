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
4. **Version URLs do not support Workers implementing Durable Objects or
   Containers.** An uploaded version is not a reachable preview for this service.
   No PR deployment gate may assume such an alias exists.
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

Each tier uses its matching `AudioContainerProduction`, `AudioContainerStaging`
or `AudioContainerDevelopment` class, with binding name `AUDIO_CONTAINER`.

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

## Acceptance sequence and current platform constraint

Cloudflare's [Version URLs documentation](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
explicitly excludes Workers implementing Durable Objects, including Containers.
The observed versions a4040938 and f01b8c33 both had `has_preview: false`; the
second used explicit preview opt-in. Their upload succeeded but the alias stayed
404. This is not a passing preview test. The earlier API10061 binding failure was
separately corrected by targeting `--env development` in the existing trigger.

PR CI requires typecheck/unit checks and, for video implementation paths, the
actual Linux Docker proof. It does not poll an impossible preview alias. After
independent source/container acceptance, merge to `main` for the existing Workers
Builds development deployment. Before any staging promotion, the release owner:

1. Reads the connected development build and requires success for the exact
   merged Git SHA and development trigger. Records build UUID and Worker version.
2. Runs both existing smoke scripts against
   `https://transcode-mcp-development.klappy.workers.dev`:
   `WORKER_BASE_URL=<development-url> bun run smoke-test.ts` and
   `bun smoke-mcp.ts <development-url>`.
3. Proves the changed runtime on that deployment. Video requires real MISS then
   verified HIT/ranges/HEAD, source-output identity and browser playback/seek.
   Docker-only or mock-R2 checks cannot satisfy the Worker/container/R2 boundary.
4. Obtains independent exact evidence acceptance before promoting staging, then
   repeats deployment identity and runtime gates before production.

If the development build, smoke or changed-runtime proof fails, staging stays
unchanged. Preserve failure receipts and repair through the same main gate.
No direct deploy, GitHub Actions deployment, substitute service or new stack.
Container changes only take effect on a full Workers Builds deploy; an uploaded
Worker version cannot prove a new container image.

## Maintenance rules

- **Bindings are non-inheritable in wrangler environments.** Any binding added to
  any tier MUST be mirrored into `[env.production]`, `[env.staging]` and `[env.development]`.
- **Adding/changing a DO migration or container image** requires the full reviewed
  development deployment and the acceptance sequence above.
- **Never point `--env development` or `--env staging` at the prod project.** Workers Builds
  overrides the config worker name to the project's worker; running the wrong env
  command in the prod project retargets prod.

## Failure modes seen (symptom → cause → fix)

- Preview alias stays404 with successful version upload → this Container Worker
  cannot have Version URLs → use the exact development deployment gate above.

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
