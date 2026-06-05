# Handoff — Deploy Architecture Session (2026-05-29 → 2026-06-02)

Owner: Claude (paired with klappy)
Outcome: locked a three-tier deploy model (prod / staging / dev + per-branch
previews) on Cloudflare Workers Builds. Canon: `canon/governance/deploy-architecture.md`
(strict how-to), `canon/planning/2026-06-02-three-tier-deploy.md` (decision),
`canon/encodings/2026-06-02-three-tier-deploy.tsv`.

## Why this journal exists

This took far too many iterations and several failed Cloudflare builds. The pain
was caused by (a) guessing about Cloudflare platform behavior instead of reading
docs, and (b) repeatedly forgetting the operator's deploy model. The governance
article exists so we never re-derive this. This journal records HOW we learned it
so the reasoning isn't lost.

## The saga (each step taught something now encoded)

1. **Single `[env.preview]` worker.** Tried one preview worker. Realized it can't
   scale — PR2 overwrites PR1.
2. **Workers Builds name override.** `wrangler deploy --env preview` run inside
   the prod-bound Workers Builds project was force-retargeted to `transcode-mcp`
   (the log: "expected transcode-mcp. Overriding"). Lesson: a Workers Builds
   project is pinned to ONE worker and overrides the config name.
3. **DO-class collision.** Preview tried to bind `AudioContainerPreview` and then
   the same `AudioContainer` as prod → `DURABLE_OBJECT_ALREADY_HAS_APPLICATION`.
   Lesson: a container application is keyed on the DO CLASS, not the worker name.
4. **Retry trap.** After each fix was pushed, the build failed identically —
   because clicking Retry re-runs the ORIGINAL commit, not the latest. Lesson:
   trigger a NEW build; never Retry.
5. **Wrong execution surface.** I built a GitHub Actions deploy workflow. The
   operator deploys ONLY via Workers Builds (dashboard + githooks); there were
   never any Cloudflare GitHub secrets because Workers Builds authenticates on
   Cloudflare's side. Removed the workflow. Recorded in memory + governance.
6. **RTFM — previews were always native.** Cloudflare Workers Builds has had
   per-branch preview deployments since 2025-07: enable non-production branch
   builds and each PR gets `<branch>-<worker>.<subdomain>.workers.dev`
   automatically. There is a SEPARATE non-production-branch deploy command, which
   is where `wrangler versions upload` belongs.
7. **The migration rule.** `versions upload` cannot carry a NEW migration. So the
   shared dev worker's DO/migration is created once by a full dev-branch deploy;
   code-only PR versions upload fine; a PR that changes the DO shape is the one
   edge case (deferred — handle by deploying that branch to the `dev` branch).

## Verified vs. deferred

- Verified from CF docs (2026-06-02): three wrangler envs in one config; native
  per-branch preview URLs; separate non-prod-branch deploy command; versions
  upload cannot carry a new migration; container app keyed on DO class.
- Deferred (accepted): a PR that changes the DO shape can't be previewed as a
  version; cross-script binding a branch worker to staging's container-backed DO
  is unverified and intentionally unused.

## State at handoff

- `wrangler.toml`: top-level prod + `[env.staging]` + `[env.dev]`, three DO
  classes, three buckets. `[env.preview]` removed. Parses; 86 tests pass.
- `src/worker.ts`: exports `AudioContainer`, `AudioContainerStaging`,
  `AudioContainerDev`.
- GitHub Actions deploy workflow removed; `ci.yml` (tests/smoke) remains.
- Branches `production`, `staging` exist; `dev` to be created.

## Next actions (operator)

1. Create the `dev` branch; create R2 bucket `transcode-mcp-audio-dev`.
2. Create the `transcode-mcp-staging` and `transcode-mcp-dev` Workers Builds
   projects per `canon/governance/deploy-architecture.md`; set the dev project's
   non-production branch deploy command to `npx wrangler versions upload --env dev`.
3. First full deploy of staging and dev (creates their DO classes/migrations).
4. Repoint `ci.yml` smoke at the dev preview URL (currently uses the old slug).
