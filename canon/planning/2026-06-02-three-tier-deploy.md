# Three-Tier Deploy: Production, Staging, and Per-Branch Previews

Date: 2026-06-02
Status: implementing
Supersedes the deploy-routing parts of `canon/planning/2026-05-29-preview-environment.md`
(single `[env.preview]` worker). That approach could not satisfy the real
requirement; this document records what does.

## The requirement (operator, stated plainly)

- **Production must never be taken down by un-validated code.** A bad PR, or an
  AI agent testing something radical, must not be able to affect prod.
- **Every branch gets its own live deployment, automatically.** Not one shared
  preview, not manual per-branch setup in the Cloudflare dashboard — N branches,
  N deployments, zero manual config.
- **A constant staging URL** for stable pre-merge validation, with a dedicated
  `staging` branch and a `prod` branch, because this project values stability
  more than most.

## Why the earlier approaches failed

1. A single `[env.preview]` worker (`transcode-mcp-preview`) is one worker — PR #2
   overwrites PR #1. Does not scale to N.
2. Cloudflare **Workers Builds** binds a project to ONE worker and overrides the
   config's worker name on every build. Deploying `--env preview` from the
   prod-bound project retargeted prod (`Failed to match Worker name ... expected
   transcode-mcp. Overriding`), then failed binding `AudioContainerPreview` on a
   worker whose live migrations only knew `AudioContainer`.
3. A container application is keyed on the **Durable Object class name**, not the
   worker name. Two workers cannot both own a container app for the same class
   (`DURABLE_OBJECT_ALREADY_HAS_APPLICATION`).

## The model

| Tier | Branch | Worker | Container / DO | Bucket |
|------|--------|--------|----------------|--------|
| Production | `production` | `transcode-mcp` | `AudioContainer` (own app) | `transcode-mcp-audio` |
| Staging | `staging` | `transcode-mcp-staging` | `AudioContainerStaging` (own app) | `transcode-mcp-audio-staging` |
| Preview | every PR | `transcode-mcp-pr-<N>` | **none** | **none** |

Key decisions:

- **Prod and staging are full, independent stacks** with **distinct DO classes**
  (`AudioContainer` vs `AudioContainerStaging`, both exported from `src/worker.ts`).
  Distinct classes are required so each gets its own container application. This
  is the one irreducible difference between the two full stacks.
- **Branch previews carry NO container, NO Durable Object, NO migration, NO R2
  bucket.** Consequences: (a) no container application, so no DO-class collision,
  so previews scale to N automatically; (b) the worker already falls back to
  audio passthrough when `AUDIO_CONTAINER`/`AUDIO_BUCKET` are absent
  (`src/worker.ts`), so previews validate everything a PR changes — routes, the
  MCP tool, the image path (account-level `IMAGES` binding, safe to share), demo
  pages, headers — while **live audio transcoding is validated on staging**, not
  per-branch.
- **Deploys go through Cloudflare Workers Builds** (the CF dashboard connected to
  GitHub via githooks) — NOT GitHub Actions. Each tier is its own Workers Builds
  project, one project per worker:
    - prod project    → builds the `production` branch → `wrangler deploy`           → `transcode-mcp`
    - staging project → builds the `staging` branch    → `wrangler deploy --env staging` → `transcode-mcp-staging`
  The earlier failure (#2 above) was caused by pointing `--env preview` at the
  *prod-bound* project; the fix is a SEPARATE project bound to each worker, not
  abandoning Workers Builds.
- **Per-branch previews are still open.** Workers Builds does non-production
  branch builds, but giving each branch its OWN uniquely-named worker via a
  Workers-Builds deploy command (e.g. `--name transcode-mcp-pr-$WORKERS_CI_BRANCH`)
  is unverified and must be confirmed before relying on it. Do NOT solve this with
  GitHub Actions. Until verified, previews are deferred; prod + staging are the
  committed tiers.

## Verified vs. unverified

- **Verified** (Cloudflare docs, 2026-06-02): cross-script Durable Object bindings
  via `script_name` exist; container application is keyed on DO class; a worker
  with no DO binding needs no migration.
- **Unverified, deliberately NOT relied upon:** whether a branch worker can drive
  staging's *container-backed* DO via a cross-script `script_name` binding to get
  live transcoding on previews. Found no explicit confirmation. The passthrough
  model above avoids this dependency entirely. If later verified in isolation,
  previews can be upgraded to bind staging's DO for live audio — a pure
  enhancement, not a prerequisite.
- **To confirm on first run:** that `wrangler deploy --env preview --name X`
  overrides the env's worker name (the per-branch mechanism). If wrangler rejects
  the combination, fall back to a templated preview config or `versions`.

## Operator actions (cannot be done from the sandbox)

Deploys are wired in the Cloudflare dashboard (Workers Builds + githooks); none
of this needs GitHub Actions or repo secrets.

1. Create the `production` and `staging` branches (done from the repo).
2. One-time: create the `transcode-mcp-audio-staging` R2 bucket (the connected
   Cloudflare MCP token is read-only, so this is a dashboard / `wrangler r2
   bucket create` action); give it the same 90-day lifecycle GC as prod.
3. Create a **staging Workers Builds project**: connect the repo, bind it to a
   new worker `transcode-mcp-staging`, build branch `staging`, deploy command
   `npx wrangler deploy --env staging`.
4. Ensure the **prod Workers Builds project** builds the `production` branch with
   deploy command `npx wrangler deploy` (plain — top-level config = prod).
5. Per-branch previews: deferred until the Workers-Builds-native mechanism is
   verified (see "The model"). Do NOT add a GitHub Actions deploy.

## Definition of done

- Pushing to `staging` (via its Workers Builds project) deploys
  `transcode-mcp-staging` with live transcoding against the staging bucket.
- Pushing to `production` deploys `transcode-mcp`; prod is only ever deployed
  from `production`, by the prod Workers Builds project.
- Staging and prod share no state (separate buckets, separate DO classes).
- Per-branch previews (deferred): once the Workers-Builds-native per-branch
  mechanism is verified, each PR branch gets its own container-less worker that
  serves routes/MCP/image path with audio passthrough.
- Prod is only ever deployed from `main`, by exactly one deployer.
