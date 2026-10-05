# Charter compose notes — transcode-mcp pilot vs. charter draft

**Verifying:** `research/stewardship-charters/transcode-mcp-charter-draft.md` against the live repo, 2026-07-06, session `local_29debdcb-6a3d-47e6-bdfb-6221c074ff7f`.

**Verdict: the charter draft's observations hold up; its ownership GENRE does not.** Every load-bearing repo-state claim I could test reproduced. But the captain issued a ruling during this pilot that reverses the draft's framing — see §0 below, which supersedes the draft's §7 skeleton. The five observational refinements follow after.

## 0. Captain re-ruling — the genre is a FOURTH shape (supersedes draft §7a–7c framing)

Klappy, verbatim intent (2026-07-06, this pilot session): the repo **lives in Klappy's personal GH account with direct write access (no delegation), and ownership at the GH-repo level is Klappy's** — but it is **positioned for the ETEN Innovation Lab as a client-shared-substrate tool** ("for the Lab but will be reused everywhere"). The genre is **"Klappy-owned-substrate-designed-for-client-reuse"** — a fourth genre, distinct from pure Klappy LLC tooling, pure client-owned repos, AND the draft's "client-owned primitive in Klappy custody."

What this changes in the charter draft:

- **Header + §7a:** drop "GitHub custody is klappy-personal, but the IP is the Lab's" and the charter-as-proposal-to-the-client framing. Klappy ratifies, full stop. No Lab acknowledgment gate; the standing-invitation-to-the-Lab clause goes.
- **§3 reserved list:** "License choice and anything Lab-facing… the Lab acknowledges" becomes simply a **captain reservation** — decided by Klappy *in view of* the Lab's use case and cross-client reuse, with no external ratifying party.
- **§7b (license):** still the right decision board, but it's Klappy's call alone. The reuse analysis (self-hosting as a supported path; no partner production depending on personal Cloudflare) survives intact — it's design-for-reuse guidance, not client governance.
- **§7c (succession/hand-off runbook):** survives as a *contingency* runbook rather than an expected transition — the mismatch-watch ("repo in klappy/, Worker on Klappy's CF") stops being a quarterly-reported anomaly and becomes the intended steady state. Keep the runbook; retitle its trigger from "Klappy's transition" to "if Klappy ever rules to transfer."
- **Deployment protections are genre-independent:** they bind the steward identically under any ownership framing (captain's explicit note).

## Confirmed by direct observation

- Repo is `klappy/transcode-mcp`, not a fork, public; `gh` verified owner. ✓
- Production serves MCP v0.3.0 (`/mcp` initialize, with proper `Accept: application/json, text/event-stream` — note the endpoint 406s without both). ✓
- Version drift 0.1.0 (package.json) vs 0.3.0 (production) — root cause found: `worker.ts` hardcoded the version; package.json was never bumped. ✓ (PR #33 fixes and prevents recurrence.)
- No license anywhere (no file, no package.json field). ✓
- No CHANGELOG; stale ARCHITECTURE.md header. ✓ (PR #33.)
- PR #28 open. ✓ — sharpened below.
- Three-tier deploy exactly as described; bindings non-inheritable, per-tier DO classes. ✓

## Proposed observational refinements (unaffected by the genre re-ruling)

1. **§0 "Loose ends" / §2 backlog item "resolve PR #28"** — resolution is now known: the PR is a **net no-op** (its two commits cancel; zero file delta vs main; the mismatch was properly fixed by `[env.staging]` in the three-tier config). Backlog item can read "close PR #28 without merge (captain click)."
2. **§2 backlog** — three of five stabilization items (CHANGELOG, ARCHITECTURE.md, version discipline) are now PRs #32/#33 pending review; if merged before the charter lands, drop them from the standing backlog and keep only PR #28 closure + "deployed version derivable" *verification* (the mechanism now exists; the check remains worth keeping in the weekly probe).
3. **§1/§2 smoke framing** — charter says "smoke tests (`bun smoke-mcp.ts` against production)." As wired today, CI smokes run against **PR preview versions on the development worker**, not production; a production smoke is a manual/steward action. The weekly-cycle probe in §2 already covers this, but the §1 health definition should say "CI green against previews; steward runs the production smoke each cycle" to match reality.
4. **New charter fact worth a sentence (deployment protection):** there are NO GitHub Environments, branch protections, or rulesets — the entire deploy gate is the CF branch→project wiring. The charter's skew-watch is right; consider adding "propose GitHub branch protection on the three deploy branches" as a decision-board item (captain call). This is also the answer to "notice the protection for deployment environments": the protection is *conventional*, not enforced.
5. **§0 addition — stale-branch reaping:** the draft's repo-state survey missed `feat/true-size-render` carrying one unmerged commit (now salvaged as PR #32) and three fully-merged branches awaiting deletion. "Reap stale branches each monthly deep pass" fits §6.

## No conflicts

Nothing this pilot did contradicts the charter: all work rode feature branches → PRs, no deploys triggered, no protected-path writes, reserved decisions (version cut, license, promotion, branch deletion) surfaced instead of taken. The genre re-ruling (§0) changes who ratifies, not what the steward may touch — the pilot's actions are identical under either framing.
