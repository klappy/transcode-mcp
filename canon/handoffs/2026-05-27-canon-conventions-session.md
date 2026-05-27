---
title: Canon Conventions Session — Simplified Frontmatter Schema and Backfill Plan
date: 2026-05-27
status: stable
mode: planning
prior_session: canon/handoffs/2026-05-26-planning-journal.md
---

# Canon Conventions Session — Simplified Frontmatter Schema and Backfill Plan

> Audited the repo's canon against the parent Writing Canon at klappy://canon/meta/writing-canon and the project's own writing-conventions.md draft. Found that the draft never enumerated required fields or worked examples, that three planning docs written 24 hours after the convention launched already had no frontmatter, and that project-identity.md lists three axioms where the parent canon and the project's own core-governance-baseline.md list four. Rewrote writing-conventions.md from scratch with a simplified schema (three required fields, small optional set, six document types each with a worked skeleton) and queued the mechanical backfill of the docs that pre-date it. Captured every decision as DOLCHEO+ in canon/encodings/2026-05-27-canon-conventions-session.tsv.

---

## Summary — What Happened and Why

The operator asked for canon and governance to be written well before any code is fixed. An audit of the existing canon turned up the patterns that motivate the rewrite: foundational docs (project-identity, definition-of-done, core-governance-baseline) had no frontmatter and no blockquote; planning docs split across two days showed the older ones with frontmatter and the newer ones without; the existing writing-conventions.md was a draft stub that pointed at ptxprint-mcp examples instead of enumerating the rules; a `klappy://canon/constraints/anti-cache-lying` URI cited in planning frontmatter didn't resolve (correct namespace is `odd/`, not `canon/`); the oddkit-mcp-config.json file looked like machine-readable config but used an envelope no MCP client actually consumes.

The operator authorized a from-scratch rewrite of writing-conventions.md and selected a simplified frontmatter schema. The new doc was drafted to itself pass the Writing Canon's five-tier extraction test, with worked skeletons for all six document types in this repo (values, constraints, governance, planning, handoff, encoding). The TSV encoding records the decisions, the constraints, and the backfill work queued for the next pass.

---

## What This Session Decided

1. **Frontmatter schema.** Three required fields (`title`, `date`, `status`) plus a small optional set (`derives_from`, `governs`, `complements`, `mode`, `supersedes`, `superseded_by`, `applied_canon`). The parent canon's `epoch`, `audience`, `exposure`, `voice`, and `tier` fields are explicitly not adopted — they would be ceremony for a single Worker.
2. **Status vocabulary.** `draft` → `working` → `stable` is the maturity ladder; `superseded` is terminal and pairs with `superseded_by`.
3. **Six document types in fixed locations.** Values, constraints, governance use undated `kebab-slug.md`. Planning, handoffs, encodings use `YYYY-MM-DD-kebab-slug.{md,tsv}`. Superseded files move to `_archive/<original-path>`.
4. **TSV encodings declare their schema.** Either a `#` header comment or a sibling `.schema.md`. Mixing row shapes without a declaration is not acceptable — the existing two TSVs both do this and are queued for fix.
5. **In-place rewrite of writing-conventions.md.** The prior draft had no inbound citations, so the cheapest fix was replacement rather than archive-plus-new-file.

---

## What This Session Did Not Decide

- **Whether to keep `oddkit-mcp-config.json` at all.** The file is non-functional config-shaped documentation; the handoff is "replace with real MCP client snippet or rename to indicate documentation-only." Operator preference is open.
- **README "Execution phase" claim.** The README declares the project is in execution mode but no ledger records the planning → execution gate. Either backfill the gate-closure ledger entry or walk the README back. Logged as P2 open in the TSV.
- **CI enforcement of oddkit audit.** Definition of Done requires it; `.github/workflows/ci.yml` does not run it. Queued as a handoff but a CI change is operator-authorized work, not a canon-pass auto-fix.

---

## What Comes Next

The mechanical backfill — bringing the pre-convention docs onto the new schema — runs from the handoffs queued in `canon/encodings/2026-05-27-canon-conventions-session.tsv`. Each handoff is a single-file change with a clear definition of done (frontmatter present, blockquote present, Summary section present, header scan passes). Once backfill closes, the canon is ready for the code-fix pass the operator originally proposed.
