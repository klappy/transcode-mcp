---
title: Canon Writing Conventions
date: 2026-05-27
status: stable
derives_from: klappy://canon/meta/writing-canon
governs: All files under canon/ in klappy/transcode-mcp
complements:
  - canon/constraints/definition-of-done.md
  - canon/values/project-identity.md
---

# Canon Writing Conventions

> Every canon document in this repo must pass extraction at five depths — title alone, title + blockquote, title + blockquote + frontmatter, Summary section, full body — and use the simplified frontmatter schema below. Three fields are required (`title`, `date`, `status`); the rest are optional and added only when load-bearing. This schema is deliberately smaller than the parent canon at klappy.dev because transcode-mcp is one Cloudflare Worker, not a multi-epoch knowledge base, and ceremony without signal is bulk that crowds out the axioms.

---

## Summary — One Schema, Three Required Fields, Five Extraction Tiers

Every file under `canon/` follows progressive disclosure. A librarian-style extractor must be able to act correctly given the title alone, title + blockquote, title + blockquote + frontmatter, Summary section, or the full document. The frontmatter has three required fields and a small optional set. There are six document types (values, constraints, governance, planning, handoff, encoding); each has a worked skeleton in this document. The schema deliberately omits the parent canon's `epoch`, `audience`, `exposure`, `voice`, and `tier` fields — those serve a corpus of hundreds of documents and several years of evolution; this repo has neither, and the fields would be ceremony, not signal. This document supersedes the earlier draft and is the single source of truth for canon authoring in this repository.

---

## The Five Extraction Tiers

A canon document gets consumed in fragments more often than it gets read whole. Each tier must be independently actionable.

### Tier 1 — Title

Names the concept and signals the stance. A reader scanning a file listing must be able to decide whether to open it.

- Good: `Worker / Container Boundary — What the Worker Knows, Doesn't Know, and Is Not`
- Bad: `Boundary Notes`, `Architecture Doc`, `Final Plan`

### Tier 2 — Title + Blockquote

The blockquote immediately after the H1 carries the document's full compressed argument. Many extraction paths return only title + blockquote, and the reader must be able to act on that pair.

- Good: `> Audio uses Container + ffmpeg + R2 because the Cloudflare Media binding emits AAC/M4A with no bitrate, sample-rate, or channel controls. Images use the env.IMAGES binding + Cache API only; no Container, no R2, no Durable Objects.`
- Bad: `> This document covers the worker / container boundary.`

The first tells an agent what to do. The second tells the agent the document exists.

### Tier 3 — Title + Blockquote + Frontmatter

Frontmatter orients the document in the project: when it was written, what it derives from, what it governs, what other documents it reads with. Required fields are listed below. Use file paths or `klappy://` URIs for cross-references — never floating names like "the boundary doc."

### Tier 4 — Summary Section

A `## Summary — <descriptive subtitle>` section that is self-contained. Everything below the Summary is elaboration, rationale, and worked detail. Read only title + blockquote + frontmatter + Summary and you have the full argument.

### Tier 5 — Full Document

The body sections provide depth: examples, derivation, edge cases, history. Body sections do not introduce claims that are absent from the higher tiers; they elaborate claims already present.

---

## Required Frontmatter

Three fields. Every canon document. No exceptions.

| Field | Type | Purpose |
| --- | --- | --- |
| `title` | string | Tier 1 content. Names concept and stance. |
| `date` | YYYY-MM-DD | Date of last meaningful change. |
| `status` | enum below | Maturity level. |

### Status vocabulary

| Status | Meaning | Other docs may cite? |
| --- | --- | --- |
| `draft` | Early thinking, not committed. | No. |
| `working` | Actively iterated, currently in use, expected to move. | Yes, with awareness it may change. |
| `stable` | Committed. Changes require an explicit gate. | Yes. |
| `superseded` | Replaced by another doc. Kept for history. | No — cite the replacement. |

A `superseded` doc must carry a `superseded_by:` field pointing to its replacement. The replacement should carry `supersedes:` pointing back. This is how the canon's history stays walkable instead of being lost to a `git rm`.

---

## Optional Frontmatter

Add only when the field carries real signal. An empty optional field is noise.

| Field | Type | When to use |
| --- | --- | --- |
| `derives_from` | path or `klappy://` URI | This doc is grounded in another. Cite it. |
| `governs` | path, glob, or list | This doc constrains other files. Name them. |
| `complements` | list of paths or URIs | Sibling docs read together. |
| `mode` | `exploration` / `planning` / `execution` | Handoff and planning docs only. |
| `supersedes` | URI or path | This doc replaces an older one. |
| `superseded_by` | URI or path | Required when `status: superseded`. |
| `applied_canon` | list of `klappy://` URIs | Planning docs that apply parent-canon principles. |

**Fields we deliberately do not use:** `epoch`, `audience`, `exposure`, `voice`, `tier`. The parent canon at klappy.dev uses these to navigate a much larger corpus across multiple evolutionary epochs. This project has one audience (operator + agents working on this repo), one exposure (everything in canon is canon), one voice (operator-direct), and no epoch history. Adding those fields here would invite the kind of drift the writing canon was designed to prevent.

---

## Headers Are the Document's Spine

Section headers serve two readers simultaneously: tooling that extracts by header, and humans who scan before reading. Headers that are extraction targets keep a stable structural prefix with a descriptive subtitle appended. Other headers are descriptive only.

- Good: `## Summary — Documents Are Read in Fragments`
- Good: `## What This Server Does NOT Know`
- Bad: `## Background`, `## Discussion`, `## Details`

### Header scan test

Print only the `#` lines from a document. If they tell the document's story when read in sequence, the headers pass. If they read like a generic form ("Summary, Background, Discussion, Conclusion"), they fail.

---

## Document Types — Where They Live and What They Look Like

The repo has six document types. Each has a fixed location, a naming rule, and a frontmatter shape.

### Values — `canon/values/*.md`

What the project believes. Tier-stable. Rare to add, rarer to change.

Filename: `kebab-slug.md`, no date prefix.

```yaml
---
title: Project Identity
date: 2026-05-27
status: stable
derives_from: klappy://canon/values/orientation
complements:
  - canon/constraints/core-governance-baseline.md
---
```

### Constraints — `canon/constraints/*.md`

Hard rules the project commits to. Cited from planning docs and the Definition of Done.

Filename: `kebab-slug.md`, no date prefix.

```yaml
---
title: Definition of Done
date: 2026-05-27
status: stable
derives_from: klappy://canon/constraints/definition-of-done
governs: canon/, src/, container/
---
```

### Governance — `canon/governance/*.md`

Meta-documents about how the project itself runs. This file is one. The MCP config snippet is one.

Filename: `kebab-slug.md`, no date prefix.

```yaml
---
title: Canon Writing Conventions
date: 2026-05-27
status: stable
derives_from: klappy://canon/meta/writing-canon
governs: All files under canon/ in klappy/transcode-mcp
---
```

### Planning — `canon/planning/YYYY-MM-DD-slug.md`

Design decisions captured at the time they were made. Dated because they're a record, not a current-state spec — the current-state spec lives in `ARCHITECTURE.md` and the values/constraints docs.

Filename: `YYYY-MM-DD-kebab-slug.md`. Date is when the decision was made, not when the file was last touched.

```yaml
---
title: Worker / Container Boundary
date: 2026-05-26
status: working
mode: planning
derives_from: canon/handoffs/2026-05-26-exploration-journal.md
applied_canon:
  - klappy://canon/principles/vodka-architecture
  - klappy://docs/promotions/P0006-vodka-boundary-enumeration-as-spec-convention
  - klappy://odd/constraints/anti-cache-lying
---
```

Note the third `applied_canon` URI: `klappy://odd/constraints/anti-cache-lying`, not `klappy://canon/constraints/anti-cache-lying`. The anti-cache-lying constraint lives under `odd/`, not `canon/`. Cross-references that don't resolve are dead claims; the audit will catch them.

### Handoff / Journal — `canon/handoffs/YYYY-MM-DD-slug.md`

Session journals. Append-only history. The decisions get encoded into TSV; the journal preserves the path that produced them.

Filename: `YYYY-MM-DD-kebab-slug.md`.

```yaml
---
title: Exploration Session — Media Transcoding Proxy
date: 2026-05-26
status: stable
mode: exploration
---
```

A journal's status moves from `working` (during the session) to `stable` (once the session has closed and decisions have been encoded). Journals do not get superseded — later sessions produce new journals; the old ones stand.

### Encoding TSV — `canon/encodings/YYYY-MM-DD-slug.tsv`

DOLCHEO+ structured decisions. Each row is a Decision, Observation, Learning, Constraint, Handoff, or Open item. Machine-readable.

Filename: `YYYY-MM-DD-kebab-slug.tsv`.

The TSV schema must be declared. Two options, pick one and be consistent across the file:

1. A header comment line at the top: `# type<TAB>title<TAB>body<TAB>evidence<TAB>alternatives<TAB>status`
2. A sibling `YYYY-MM-DD-slug.schema.md` that documents the columns.

**Schema for D, O, L, C rows (6 columns):**

| Col | Field |
| --- | --- |
| 1 | type — `D`, `O`, `L`, `C` |
| 2 | title |
| 3 | body |
| 4 | evidence |
| 5 | alternatives |
| 6 | status |

**Schema for H rows (handoff, 4 columns):**

| Col | Field |
| --- | --- |
| 1 | `H` |
| 2 | title |
| 3 | body |
| 4 | owner (`operator`, `next session`, name) |

**Schema for O-open rows (open item, 5 columns):**

| Col | Field |
| --- | --- |
| 1 | `O` |
| 2 | `open` |
| 3 | priority — `P1` / `P2` / `P3` / `--` |
| 4 | title |
| 5 | body |

If a TSV mixes row shapes, that mixing is part of the format and the schema file must name it. The current `2026-05-26-exploration-session.tsv` does this without declaring the schema; backfilling its schema header is part of the cleanup pass.

---

## File Naming

| Document type | Pattern | Date represents |
| --- | --- | --- |
| Values, constraints, governance | `kebab-slug.md` | n/a |
| Planning | `YYYY-MM-DD-kebab-slug.md` | When the decision was made |
| Handoff | `YYYY-MM-DD-kebab-slug.md` | Session date |
| Encoding | `YYYY-MM-DD-kebab-slug.tsv` | Session date |
| Superseded archive | `_archive/<original-path>` | Path preserved |

Slugs are lowercase, hyphen-separated, descriptive enough that the slug alone hints at the content. `worker-container-boundary` passes; `notes` does not.

---

## Voice — Operator-Direct

The voice model is the exploration journal at `canon/handoffs/2026-05-26-exploration-journal.md`. Direct, technical, willing to self-correct in place, specific about what was observed versus what is being assumed. The journals openly say things like *"the assistant initially mischaracterized this"* and *"operator correction"*. That voice is what canon should sound like when an AI helped draft it.

When AI helps draft, the patterns from `klappy://canon/constraints/ai-voice-cliches` to avoid clustering are: negation parallelism (*"It's not X. It's Y."*), formulaic transitions, em-dash overuse, generic descriptors, uniform pacing. One occurrence is a non-issue. Three in a paragraph is the ghost writer showing through, and the document needs an operator pass before it lands.

---

## Checklist — Before Committing Any Canon Document

1. **Title test.** Does the title name the concept and its stance? Could a reader decide relevance from the title alone?
2. **Blockquote test.** Does the blockquote contain the full compressed argument? Could an agent act on title + blockquote alone?
3. **Frontmatter test.** Are `title`, `date`, `status` all present? Are cross-references full paths or `klappy://` URIs (not floating names)? Do any cited URIs actually resolve? Run `oddkit_resolve` to confirm.
4. **Summary test.** Is the Summary section self-contained? Could a reader skip everything below and still act correctly?
5. **Header scan test.** Print only the `#` lines. Do they tell the document's story?
6. **No buried claims.** Every key assertion appears in compressed form at a higher tier before being elaborated.
7. **Voice check.** Read it aloud. If three or more AI-voice patterns cluster in a paragraph, the operator rewrites that paragraph.
8. **Audit.** Run `oddkit audit` on the repo before opening the PR. Dead references and broken frontmatter are blocking.

---

## Enforcement

This checklist is part of the Definition of Done. A document that exists but does not pass these tiers is not done.

The repository's CI workflow should run `oddkit audit` on every PR touching `canon/`. Until that CI step is added (it is not in `.github/workflows/ci.yml` as of this writing), enforcement falls to whoever opens the PR. Access to this document is not the same as enforcement of it — the Progressive Disclosure Failure incident at `klappy://docs/incidents/progressive-disclosure-failure-2026-02` is the precedent this project is committed to not repeating.

---

## What This Document Replaces

This file supersedes the prior `canon/governance/writing-conventions.md` (`status: draft`, dated 2026-05-27 earlier the same day), which stubbed out best practices without enumerating required fields, controlled vocabulary, or worked examples. The prior document is not archived because it never had load-bearing citations from elsewhere in the canon — the inbound references all point at this path.

The immediate follow-up after this lands is backfilling frontmatter, blockquote, and Summary section onto the canon documents that pre-date this convention: `canon/values/project-identity.md`, `canon/constraints/definition-of-done.md`, `canon/constraints/core-governance-baseline.md`, and the three frontmatter-less planning docs from 2026-05-27. That work is mechanical against this spec.
