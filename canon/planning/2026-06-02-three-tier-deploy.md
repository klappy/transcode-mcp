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
| Production | `main` | `transcode-mcp` | `AudioContainer` (own app) | `transcode-mcp-audio` |
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
- **GitHub Actions, not Workers Builds, owns the deploys** (`.github/workflows/
  deploy.yml`). A push to `main`/`staging` deploys that tier; a PR deploys
  `transcode-mcp-pr-<N>` via `wrangler deploy --env preview --name <that>`; a
  closed PR deletes it. Workers Builds is per-project/manual and cannot scale to
  N branches, which is the whole requirement.

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

1. Repo secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + R2 for the
   staging bucket) and `CLOUDFLARE_ACCOUNT_ID`.
2. One-time: `wrangler r2 bucket create transcode-mcp-audio-staging`; give it the
   same 90-day lifecycle GC as prod.
3. Create the `staging` branch.
4. **Prod deployer cutover:** pick ONE deployer for prod. If keeping Workers
   Builds for prod, delete the `deploy-production` job; if moving prod to GitHub
   Actions, disable Workers Builds auto-deploy so `main` doesn't deploy twice.
5. Repoint CI smoke (`ci.yml`) at the deployed preview URL
   (`transcode-mcp-pr-<N>.<subdomain>.workers.dev`) instead of the old
   Workers-Builds slug — a follow-up to this change.

## Definition of done

- A PR opens → `transcode-mcp-pr-<N>` deploys and its URL is commented on the PR.
- The PR's worker serves routes/MCP/image path; audio passthroughs.
- Pushing to `staging` updates `transcode-mcp-staging` with live transcoding.
- Closing the PR deletes its worker.
- Prod is only ever deployed from `main`, by exactly one deployer.
