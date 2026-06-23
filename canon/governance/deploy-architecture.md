# GOVERNANCE: Deploy Architecture (prod / staging / preview + per-branch previews)

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
   is WHY there are three workers and not two. The cache key is
   `sha256(source + preset + q + codec)` with NO recipe/version component, so a
   build that changes transcode *output* (a codec/bitrate/quality tweak — which
   this project tunes constantly) writes *different bytes under an existing key*.
   Anyone sharing that bucket then serves those experimental bytes. Therefore a
   tier that must stay clean (prod, and staging as the pre-prod gate) cannot
   share a bucket with anything — and since a connection's non-production
   (preview) lane shares the env worker's bucket with its live version, prod and
   staging keep their preview lanes OFF. Only the preview tier shares one bucket
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
| prod | `production` | `transcode-mcp` | `AudioContainer` | `transcode-mcp-audio` | `wrangler deploy` |
| staging | `staging` | `transcode-mcp-staging` | `AudioContainerStaging` | `transcode-mcp-audio-staging` | `wrangler deploy --env staging` |
| preview | `preview` | `transcode-mcp-preview` | `AudioContainerPreview` | `transcode-mcp-audio-preview` | `wrangler deploy --env preview` |
| PR preview | any PR branch | (a VERSION of `transcode-mcp-preview`) | shared `AudioContainerPreview` | shared preview bucket | `wrangler versions upload` |

- **preview is the single shared preview backend.** Every PR branch is a *version* of
  the one preview worker, with its own stable alias
  `<branch>-transcode-mcp-preview.<subdomain>.workers.dev`. All previews share the one
  preview container/DO/bucket. **Last-build-wins on shared state; each version still
  previews its own code.** Code-only PRs are effectively parallel-safe. A PR that
  changes the DO shape (a new migration) is the one case that breaks — see below.
- Each DO class is a trivial subclass in `src/worker.ts`:
  `AudioContainer` (prod), `AudioContainerStaging`, `AudioContainerPreview`. The
  binding NAME stays `AUDIO_CONTAINER` in every env; only the class differs.

## Workers Builds project settings (the three projects)

For each project: Settings → Build → Branch control.

- **prod project** → connected worker `transcode-mcp`; production branch
  `production`; production deploy command `npx wrangler deploy`; non-production
  branch builds **OFF**.
- **staging project** → worker `transcode-mcp-staging`; production branch
  `staging`; deploy command `npx wrangler deploy --env staging`; non-prod **OFF**.
- **preview project** → worker `transcode-mcp-preview`; production branch `preview`; deploy
  command `npx wrangler deploy --env preview`; **non-production branch builds ON**;
  non-production branch deploy command `npx wrangler versions upload --env preview`.
  Every non-production branch (all PR/feature branches) builds here as a version
  with its own preview URL — preview is scoped to ALL branches; prod and staging
  are scoped strictly to their own branch.

## Stand-up runbook (from zero)

1. Create branches `production`, `staging`, `preview`.
2. Create R2 buckets `transcode-mcp-audio`, `-staging`, `-preview`; set the same
   lifecycle GC (90-day) on each.
3. First full deploy of each tier (creates each DO class + its `v1` migration and
   builds its container): a push to each tier branch via its Workers Builds
   project, or a manual `wrangler deploy --env <tier>` once.
4. Wire the three Workers Builds projects per the settings above.
5. Verify: a PR opens → preview project's non-prod build uploads a version → a
   `<branch>-transcode-mcp-preview...` URL is commented on the PR; prod/staging
   untouched.

## Maintenance rules

- **Bindings are non-inheritable in wrangler environments.** Any binding added to
  prod (top-level) MUST be mirrored into `[env.staging]` and `[env.preview]`.
- **Adding/changing a DO migration** changes the preview preview story: PR branches
  with a *new* migration cannot `versions upload`. To preview such a branch, push
  it to the `preview` branch (full deploy) rather than as a PR version, or bump the
  shared preview migration deliberately. This is the accepted edge case, not a bug.
- **Never point `--env preview/staging/preview` at the prod project.** Workers Builds
  overrides the config worker name to the project's worker; running the wrong env
  command in the prod project retargets prod.

## Failure modes seen (symptom → cause → fix)

- `Failed to match Worker name ... expected transcode-mcp. Overriding` → the
  command ran in the prod-bound Workers Builds project → run it in the project
  bound to the right worker.
- `DURABLE_OBJECT_ALREADY_HAS_APPLICATION` → two workers share a DO class → give
  each tier its own class (`AudioContainer{,Staging,Preview}`).
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
