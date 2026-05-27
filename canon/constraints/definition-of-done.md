---
title: Definition of Done
date: 2026-05-27
status: stable
derives_from: canon/constraints/core-governance-baseline.md
complements:
  - canon/governance/writing-conventions.md
governs: canon/, src/, container/, .github/workflows/
---

# Definition of Done

> A change is done when it carries the evidence its type demands: planning docs name alternatives and success criteria; code changes pass type-check, tests, and a smoke verification on the deployed Worker; canon documents pass the five-tier extraction test; audio recipes carry sample output proving the ffmpeg flags do what they claim. Existence is not done. A file in the repo that lacks the required evidence is incomplete regardless of how polished it looks.

---

## Summary — Done Means Evidence, Not Existence

Every change category in this repo has a specific evidence requirement. The Definition of Done is the list of those requirements. It is the contract `oddkit_validate` checks against when a completion claim is made, and it is the gate a PR must pass before merge. The categories are deliberately narrow — planning, canon, code, audio recipe — so that "done" is unambiguous for each. A change that does not fit any category is itself a signal that a category is missing from this document and the document needs an update before the change can be evaluated.

---

## Core Principles

- **Evidence-driven.** Every claim, decision, or completion is backed by an observable artifact: logs, screenshots, test output, metrics, sample command output, or a resolved oddkit URI.
- **Proxy-first + lazy.** URLs are generated immediately; transcoding happens on actual request only. Done means the lazy boundary is respected, not bypassed.
- **Official SDKs only.** No hand-rolled MCP protocol, transport, or schema. Done means imports come from `agents/mcp` and `@modelcontextprotocol/sdk`, declared in `package.json` as runtime dependencies.
- **Document-first.** Significant work is preceded by a canon update (planning doc, DOLCHEO encoding, or DoD reference). Done means the canon record exists before the code is merged, not after.

---

## For Planning Artifacts

A planning document is done when it has:

- Frontmatter conforming to `canon/governance/writing-conventions.md` (`title`, `date`, `status`, `mode: planning`).
- A blockquote that compresses the full planning argument.
- A `## Summary —` section that is self-contained.
- Clear problem statement.
- At least two alternatives considered (and named, not implied).
- Risks and reversibility assessed.
- Success criteria defined explicitly enough that a future reader can tell whether they were met.
- Cross-references to applied parent-canon constraints in `applied_canon:` frontmatter (URIs must resolve via `oddkit_resolve`).

---

## For Canon Documents

A canon document is done when it passes the eight-point checklist in `canon/governance/writing-conventions.md`:

1. Title names the concept and its stance.
2. Blockquote contains the full compressed argument.
3. Frontmatter has `title`, `date`, `status` and any optional fields it cites (`derives_from`, `governs`, etc.).
4. Summary section is self-contained.
5. Header scan tells the document's story.
6. No buried claims (every assertion present in compressed form at a higher tier).
7. Voice check (no clustering of AI-voice patterns per `klappy://canon/constraints/ai-voice-cliches`).
8. `oddkit audit` clean on the file.

---

## For Code Changes (Worker / Container)

A code change is done when it has:

- Source modules exist for every import referenced by tests (no orphan test files).
- `package.json` declares every runtime import — `agents/mcp`, `@modelcontextprotocol/sdk/*`, `zod`, anything else `worker.ts` imports — in `dependencies` (not just `devDependencies`).
- A committed lockfile (`bun.lock` or equivalent) so CI's `--frozen-lockfile` install succeeds.
- A `tsconfig.json` so `tsc --noEmit` runs with the project's actual module-resolution and target settings, not defaults.
- Type check passes (`bun run typecheck` or equivalent).
- Unit tests pass (`bun test`).
- Smoke verification against the deployed Worker (or a preview Worker) for any change that touches request handling. A change to the URL parsing path is not done until a real canon-format request returns the expected response.
- MCP surface uses `createMcpHandler` or `McpAgent` from the official SDK (no custom protocol code).
- If the change touches `canon/`, `oddkit audit` is clean before merge.

---

## For Audio Recipes

An audio recipe is done when it has:

- The ffmpeg command tested in container context (not just written down).
- Preset values matching the rules in `canon/planning/2026-05-26-url-vocabulary-and-presets.md` (voice = 8k / 16k / 32k mono; music = appropriate stereo).
- Evidence: sample command output plus the resulting file's reported duration, bitrate, and sample rate.
- Worker / Container boundary respected — only preset name and source URL pass from Worker to Container.

---

## Evidence Requirements

| Change type | Required evidence |
| --- | --- |
| Planning | Frontmatter, alternatives, success criteria, applied_canon URIs that resolve |
| Canon | Five-tier extraction passes, `oddkit audit` clean |
| Code (logic) | Type check, unit tests, smoke verification on deployed Worker |
| Code (UI / perceptual) | Visual proof — screenshot, recording, or before/after |
| Optimization | Metrics before and after |
| Recipe | Sample command output, file characteristics |

---

## Constraints on This Document

This document is subordinate to `canon/constraints/core-governance-baseline.md`. A category not listed here is a gap to be filled in this file before the change is evaluated, not a license to skip evidence. Adding a new category is itself a canon change subject to the canon-document section above.
