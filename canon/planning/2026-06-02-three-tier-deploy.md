# Three-Tier Deploy: prod / staging / preview + per-branch previews

Date: 2026-06-02
Status: LOCKED
Supersedes `canon/planning/2026-05-29-preview-environment.md` (single preview worker).
Strict how-to: `canon/governance/deploy-architecture.md`. This doc records the
DECISION and the reasoning; the governance article is the operating manual.

## Requirement

- Production is never endangered by un-validated code.
- A constant staging URL for stable pre-merge validation (own `staging` branch).
- Every PR branch gets its own live preview automatically — N branches, no manual
  per-branch setup.
- Deploys go through Cloudflare Workers Builds (dashboard + githooks), never
  GitHub Actions.

## Decision

One `wrangler.toml`, three environments, three Workers Builds projects:

| Tier | Branch | Worker | DO class | Bucket |
|------|--------|--------|----------|--------|
| prod | `production` | `transcode-mcp` | `AudioContainer` | `transcode-mcp-audio` |
| staging | `staging` | `transcode-mcp-staging` | `AudioContainerStaging` | `transcode-mcp-audio-staging` |
| preview | `preview` | `transcode-mcp-preview` | `AudioContainerPreview` | `transcode-mcp-audio-preview` |

- **preview is the single shared preview backend.** Each PR branch is a *version* of
  `transcode-mcp-preview` (Workers Builds non-production branch build →
  `wrangler versions upload`), with its own stable preview URL, all sharing the
  one preview container/DO/bucket. Last-build-wins on shared state; each version
  previews its own code. Code-only PRs are effectively parallel-safe.
- Three distinct DO classes because a container application is keyed on the DO
  class name — two workers cannot share a class. Prod and staging are single
  stable workers; they never race and never share state.

## Why earlier approaches failed (now invariants in governance)

1. Single preview worker — one worker, PR2 overwrites PR1.
2. Workers Builds pins a project to one worker and overrides the config name —
   running `--env preview` in the prod project retargeted prod.
3. Container app keyed on DO class — shared class →
   `DURABLE_OBJECT_ALREADY_HAS_APPLICATION`.
4. Retry re-runs the original commit — fixes appeared not to take.
5. GitHub Actions is the wrong surface — deploys are Workers Builds only.

## Verified (CF docs, 2026-06-02)

Three wrangler envs in one config; native per-branch preview URLs via
non-production branch builds; a SEPARATE non-production-branch deploy command
(where `wrangler versions upload` belongs); `versions upload` cannot carry a NEW
migration.

## Open / deferred

- A PR that changes the DO shape (new migration) cannot be previewed as a preview
  version (`versions upload` rejects new migrations). Handle by deploying that
  branch to the `preview` branch (full deploy). Accepted; fix when hit.
- Cross-script binding a branch worker to a container-backed DO is unverified and
  intentionally unused.

## Definition of done

- Push `production` → `transcode-mcp`; push `staging` → `transcode-mcp-staging`;
  push `preview` → `transcode-mcp-preview` (each full stack, own bucket/class).
- A PR opens → a `<branch>-transcode-mcp-preview...` preview URL is commented; prod
  and staging untouched.
- Prod deployed only from `production`, only by the prod Workers Builds project.
