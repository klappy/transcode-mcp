# transcode-mcp — Fly Pilot Inventory of Uncompleted Work

**Session:** `local_29debdcb-6a3d-47e6-bdfb-6221c074ff7f` (Fable pilot, 2026-07-06)
**Repo:** `klappy/transcode-mcp` (verified: owner `klappy`, not a fork, public; `etenlab` org holds no copy)
**Charter:** composes with `research/stewardship-charters/transcode-mcp-charter-draft.md` — verification notes in `charter-notes.md` alongside this file.

## Deployment-protection findings (read FIRST — Klappy's explicit callout)

The protection is **structural, not configured on GitHub**:

- **Zero GitHub Environments** (`GET /repos/klappy/transcode-mcp/environments` → `total_count: 0`).
- **Zero branch protection** on `main`, `staging`, `production`, `preview` (all 404 "Branch not protected"); **zero rulesets**.
- The real protection boundary is Cloudflare Workers Builds wiring: three CF projects each watch one branch and auto-deploy it — `production` branch → `transcode-mcp-production` (serves transcode.klappy.dev), `staging` → `transcode-mcp-staging`, `main` → `transcode-mcp-development`. **A push to any of those three branches IS a deployment.**
- PR/feature branches build only as preview *versions* on the development worker — the designed CI flow (`.github/workflows/ci.yml` smoke-tests against those previews).

**Pilot discipline derived:** never push to `main`/`staging`/`production`; feature branches + PRs only. Honored throughout this session.

**Gap worth captain attention:** with no GitHub-side protection, any write-access account (or leaked token) pushing to `production` triggers an instant unreviewed prod deploy. See needs-captain item 5.

## Can-finish-here — DONE this session

1. **Salvage of `feat/true-size-render`'s unmerged commit** → [PR #32](https://github.com/klappy/transcode-mcp/pull/32). The branch's single unmerged commit (d57ffdd, copyable proxy-URL row on every explorer result) was 105 commits behind; feature absent from main. Re-resolved against today's `demo-page.html` (two conflicts: render row, warn-palette styles). Tests 94/94, typecheck clean.
2. **Version discipline + doc hygiene** → [PR #33](https://github.com/klappy/transcode-mcp/pull/33). package.json 0.1.0 → 0.3.0 (reconciles to what production reports — NOT a release bump); worker.ts single-sources version from package.json; CHANGELOG.md bootstrapped from PR history + traced bump commits (92f8657 → 0.2.0, d5da6e3 → 0.3.0); ARCHITECTURE.md "Planning in progress (2026-05-26)" header unstaled. Tests 94/94.
3. **PR #28 analysis** (below). Note: posting the analysis as a PR comment was denied by this session's permission layer; it lives here instead.

## Needs-captain-ratification (batched per escalation rule — 7 items)

1. **Close PR #28 without merge.** Cloudflare auto-opened it; its two commits cancel (rename → restore), file delta vs main is **zero**, and the mismatch was properly fixed by the three-tier config (`[env.staging] name = "transcode-mcp-staging"`, PRs #29/#31). Merging changes nothing; closing loses nothing.
2. **Delete stale branches** (after their PRs resolve): `feat/demo-cold-start-race` (0 ahead), `feat/repoint-prod-domain` (0 ahead), `preview` (0 ahead; tier retired by PR #31 — but confirm no CF project still watches it before deleting), `update_worker_name_to_transcode-mcp-staging` (once #28 closes), `feat/true-size-render` (once #32 merges).
3. **Promote main → staging → production.** Both `staging` and `production` are 2 commits behind main (the development-tier work). Pushing those branches deploys — captain-only by definition.
4. **Cut the next version** for the CHANGELOG "Unreleased" items already live on production (audio slice 1 #25, savings headers + CORS #27, three-tier deploy #29/#31, domain repoint #30). PR #33 deliberately does not decide this.
5. **Consider GitHub branch protection** on `production`/`staging`/`main` (require PR, restrict pushers). Today the deploy path is one unreviewed `git push` away for any write-access credential. Cheap insurance; captain's call on strictness.
6. **License** — repo has NO license (no LICENSE file, no package.json field). All-rights-reserved by default blocks the "reused everywhere" intent. Lab-level decision per charter §7b (MPL-2.0 / Apache-2.0 candidates).
7. **wrangler.toml legacy top-level config** — in-file TODO(cleanup) to retire/repoint the base `name = "transcode-mcp"` config and its `transcode-mcp-audio` bucket, gated on confirming the old CF project teardown. Needs CF dashboard eyes (blocked-external for this session).

## Blocked-external

- **Cloudflare dashboard state** — Workers Builds project configs, old-project teardown confirmation, R2 lifecycle/GC verification. No CF access from this session.
- **Mirror bench samples to R2 for production** (canon O-open, P3, `2026-05-29-audio-bench-parity`) — needs R2 write against production resources.

## Out-of-scope (per charter)

- **Growth features** (Poured Ink M5/M6 media demand) — captain-sequenced, decision board first.
- **Canon O-open design items** (e.g., P1 source-identity cost for large audio sources) — design judgment queued in canon, not pilot chores.
- **Stale "Next actions" in `canon/handoffs/2026-06-02-deploy-architecture-session.md`** — superseded by PR #31's development tier; canon handoffs are append-only journals, so correcting them is a canon-convention question, not a quick fix.
