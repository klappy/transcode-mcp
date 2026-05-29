---
title: Canon Index
date: 2026-05-27
status: stable
complements:
  - canon/governance/writing-conventions.md
---

# Canon Index

> Entry point into klappy/transcode-mcp's canon. Six document types, six directories. Read in order: values (what the project believes), constraints (rules the project commits to), governance (how the project itself runs), planning (dated design decisions), handoffs (session journals), encodings (DOLCHEO+ structured records). The writing conventions are themselves a canon document under governance; everything else is measured against them.

---

## Summary — Where Each Kind of Document Lives

This index is the human entry point into the canon. Six directories under `canon/`, each containing one document type per `canon/governance/writing-conventions.md`. The directories below are listed in the order an agent or operator should read them when first orienting to the repo. Within each directory, this index lists the current contents with one-line summaries so that scanning this file alone gives a complete view of what the project has committed to.

---

## canon/values/ — What the Project Believes

| File | Status | Summary |
| --- | --- | --- |
| `project-identity.md` | stable | The Proactive Integrity creed and the four Foundational Axioms, in-repo reference for the parent canon's values layer |

## canon/constraints/ — Rules the Project Commits To

| File | Status | Summary |
| --- | --- | --- |
| `core-governance-baseline.md` | stable | The five load-bearing constraints (creed, axioms, proxy-first, official SDK, document-first, Worker/Container boundary, anti-cache-lying) |
| `definition-of-done.md` | stable | Per-artifact-type evidence requirements that `oddkit_validate` checks against |

## canon/governance/ — How the Project Itself Runs

| File | Status | Summary |
| --- | --- | --- |
| `writing-conventions.md` | stable | Frontmatter schema, five-tier extraction test, document-type skeletons — the spec every canon document is measured against |
| `oddkit-mcp-clients.md` | stable | How to wire MCP clients (Claude, Cursor, agent code) to oddkit pointing at this repo's knowledge base |

## canon/planning/ — Dated Design Decisions

| File | Status | Mode | Summary |
| --- | --- | --- | --- |
| `2026-05-26-url-vocabulary-and-presets.md` | working | planning | URL convention `/{media_type}/{options}/{source_url}`, image and audio option grammar, quality preset tables |
| `2026-05-26-worker-container-boundary.md` | working | planning | What the Worker knows, doesn't know, and is not; what the Container owns |
| `2026-05-27-audio-container-recipes.md` | working | planning | Six ffmpeg recipes (three voice, three music), libopus, evidence-pending |
| `2026-05-27-mcp-integration.md` | working | planning | Official Cloudflare Agents SDK; one tool `generate_transcode_url` |
| `2026-05-27-success-criteria-and-irreversibility.md` | working | planning | The v1 skeleton's success contract and gate-closure plan |
| `2026-05-29-media-pricing-model.md` | working | planning | Unified credit unit with per-medium weights; 20–100× target is a processing-line blended outcome; audio transcode cost measured per codec |

## canon/handoffs/ — Session Journals

| File | Status | Mode | Summary |
| --- | --- | --- | --- |
| `2026-05-26-exploration-journal.md` | stable | exploration | Session 1: the spine of the product (perceptual axes, half-class overshoot, audio method, IP status, content-addressed storage) |
| `2026-05-26-planning-journal.md` | stable | planning | Session 2: architecture pivots from ptxprint-mcp clone to stateless HTTP proxy |
| `2026-05-27-canon-conventions-session.md` | stable | planning | Session 3 (this batch): canon audit, simplified frontmatter schema, backfill |

## canon/encodings/ — DOLCHEO+ Structured Records

| File | Schema | Summary |
| --- | --- | --- |
| `2026-05-26-exploration-session.tsv` | 6/4/5-col mixed (declared in header) | Exploration session decisions, observations, learnings, constraints, handoffs, open items |
| `2026-05-26-planning-session.tsv` | 6/4/5-col mixed (declared in header) | Planning session: 8 decisions, 3 learnings, 1 constraint, 1 handoff, 5 open items |
| `2026-05-27-canon-conventions-session.tsv` | 6/4/5-col mixed (declared in header) | Today's canon-conventions decisions and the backfill handoff queue |
| `2026-05-29-pricing-session.tsv` | 6/4/5-col mixed (declared in header) | Pricing-model session: 6 decisions, 2 observations, 3 learnings, 3 constraints, 3 open items |

---

## How to Read This Canon

For a first-time visit, the read order is:

1. `canon/values/project-identity.md` — the creed and axioms; everything else is downstream
2. `canon/constraints/core-governance-baseline.md` — the five constraints every decision must respect
3. `canon/constraints/definition-of-done.md` — what "done" means for each artifact type
4. `canon/governance/writing-conventions.md` — how to author and modify canon documents
5. Most recent handoff in `canon/handoffs/` — the path the project is currently on
6. `canon/planning/` — current open design decisions, by date

For a focused task, use `oddkit search` or `oddkit get` with `knowledge_base_url: "https://github.com/klappy/transcode-mcp"` — see `canon/governance/oddkit-mcp-clients.md` for wiring details.
