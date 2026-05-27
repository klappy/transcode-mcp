---
title: Project Goal — Outcome, Cost Function, and Quality Attributes in Tension
date: 2026-05-27
status: working
mode: planning
derives_from: canon/handoffs/2026-05-26-exploration-journal.md
complements:
  - canon/values/project-identity.md
  - canon/constraints/core-governance-baseline.md
  - canon/planning/2026-05-26-url-vocabulary-and-presets.md
governs: All design and implementation work in klappy/transcode-mcp
promotion_blocked_by: corpus measurement of the three-branch encode rule on real source images; operator confirmation that the six-attribute list is complete; passage of one downstream session that reads this doc first and reports back whether it was the right starting point
---

# Project Goal — Outcome, Cost Function, and Quality Attributes in Tension

> transcode-mcp's outcome is smaller files at acceptable perceived quality, delivered fast and cheap, for offline packaging on constrained devices. The cost function the system minimizes is bytes per delivered asset. The constraints it must hold simultaneously are perceived quality (per the `q=low/med/high` preset), transcode wall time, implementation simplicity, maintainability by a single operator, egress cost, and storage cost. These tension against each other. Every encoder choice — resolution, quality parameter, format, codec, sample rate — is evaluated against all of them at once, not against one in isolation. The art is in holding all of them at once.

---

## Summary — The Goal in One Page

This document names the project's outcome, the cost function it minimizes, and the set of constraints in tension that any rule, heuristic, or implementation must hold simultaneously. It exists because Outcomes-Driven Development means starting every session with the outcome — and the outcome is easy to lose mid-session under the gravitational pull of sub-problems that feel important but don't advance it. The exploration journal at `canon/handoffs/2026-05-26-exploration-journal.md` carries the original framing in prose ("spend nothing on what the human can't perceive; control the character of the loss; the system of constraints is the trick"); this document carries it in operational form, so a session can ask "does this advance the outcome?" and get a non-prose answer.

---

## The Outcome

Smaller files at acceptable perceived quality, delivered fast and cheap, for offline packaging on constrained devices (cheap Android phones, low-bandwidth regions, Bible translation projects).

This is what the system is for. Everything else — URL shape, MCP surface, codec choice, caching strategy — is a means.

---

## The Cost Function

**bytes per delivered asset.**

Every encoder choice is measured against this. A change that reduces bytes is potentially good. A change that increases bytes for invisible quality gain is bad. A change that reduces bytes by destroying perceptible quality is also bad (it violates the floor constraint below, even though it improves the cost function in isolation).

Bytes is the cost function because bytes are what the user pays for in storage on a cheap phone, in bandwidth on a slow connection, and in egress to us. Time-to-deliver and dollars-to-deliver both correlate strongly with bytes once the system is past cold start. Optimizing bytes optimizes the user's experience and our cost simultaneously, which is the rare case where the agent and the principal want the same thing.

---

## The Quality Attributes in Tension

These are held simultaneously. None of them is the objective. None of them is ignored. Every rule the system applies must respect all of them or explicitly name the trade.

This list follows the canonical method at `klappy://canon/methods/quality-attribute-tension-survey` — surfacing the ilities that matter for this project at scope-setting time, ranking them, and naming the sacrifices the project accepts. The principle at `klappy://canon/principles/quality-attributes-are-in-tension` asserts that optimizing one quality attribute reliably degrades at least one other; the matrix below makes the specific pairs explicit for transcode-mcp's six.

### The Tension Matrix — Which Attribute Degrades Which

Reading the table: row "pushed up" against column "tends to push down." This is not exhaustive; it names the dominant pair-wise tensions the agent should watch for. Some pairs are mutual (push perceived quality up → bytes go up → push bytes down → perceived quality at risk); some are asymmetric.

|                          | Perc. quality | Wall time | Simplicity | Maint. | Egress | Storage |
|--------------------------|---------------|-----------|------------|--------|--------|---------|
| **Perc. quality ↑**      | —             | ↑ (compute) | ↑ (more code paths) | — | ↓ (more bytes) | ↓ (more bytes) |
| **Wall time ↓** (faster) | ↓ (less work) | —         | ↓ (simpler = faster) | — | — | — |
| **Simplicity ↑**         | ↓ (one rule fits all → loses tuning) | — | — | ↑ | — | — |
| **Maintainability ↑**    | ↓ (no special cases) | — | ↑ | — | — | — |
| **Egress ↓** (fewer bytes) | ↓ (lower quality target) | — | — | — | — | — |
| **Storage ↓**            | ↓ (smaller variants) | — | — | — | ↓ (correlated) | — |

The dominant tension is **perceived quality vs bytes** (rows 1 and 5/6). The second-order tension is **simplicity vs perceived quality** — adding per-q-preset branches or per-source-class heuristics can buy quality at the cost of code paths a single operator can't keep in their head. The agent's job is to find configurations that don't sit at a corner of the tension space but in a region where small concessions on one axis buy large gains on another.

### 1. Perceived quality floor

**Floor:** ≥ the perceptual quality the request's `q=low/med/high` preset commits to.

The presets are not arbitrary numbers. They are commitments to a class of use: `q=low` is "acceptable on a cheap Android in offline use, thumbnail-class detail"; `q=medium` is "default delivery, clearly recognizable, no obvious artifacts at normal viewing distance"; `q=high` is "detail-view, pinch-zoom expected." A smaller file that drops below this floor is a failure even if it minimizes the cost function. The encoder must clear the floor first, then minimize bytes.

### 2. Transcode wall time

**Ceiling:** Cloudflare Worker CPU budget + Container spawn time for first-request audio. Subsequent requests must hit cache.

A perfectly optimized file the user waited 30 seconds for is a failure. The Worker has a hard CPU budget per request. The Container has a spawn cost on first audio request. Operations that would require per-request content classification (e.g., LLM-based pixel-art-vs-photograph detection) are rejected on this constraint even before they're rejected on simplicity.

### 3. Implementation simplicity

**Ceiling:** one Worker, one Container, presets as data, no per-request classification, no machine learning models, no opaque heuristics.

Sophistication that won't survive a year of solo maintenance is a failure. Every branch in the encoder logic that requires a human to remember a special case is debt. The preferred shape is rules-as-data plus a small dispatcher. If a proposed rule requires a flowchart to explain to the next session, it's too complex.

### 4. Maintainability — one person indefinitely

**Constraint:** one operator must be able to read the canon, the source, and the deployed Worker's behavior, and understand it. Inherited from `klappy://canon/principles/maintainability-one-person-indefinitely`.

Configuration sprawl is a failure. URL parameters that nobody uses but the code still branches on are debt. Codec choices that depend on tribal knowledge are debt. The system should be legible end-to-end from the README to the deployed response.

### 5. Egress cost (Cloudflare bandwidth)

**Constraint:** bytes are paid on every cache miss. R2 reads cost on every hit.

Bytes the user pays for in their bandwidth are also bytes we pay for in our egress. The cost function isn't theoretical; it has a dollar value per delivered byte at scale. This means decisions that double the encoded file size to gain 2% perceptual quality are bad business, not just bad engineering.

### 6. Storage cost (R2)

**Constraint:** content-addressed cache, lifecycle GC, no stored variants that won't be re-read.

R2 is cheap but not free. Variants stored because they might someday be requested are debt. The cache is keyed on `sha256(source + normalized params)` so identical requests hit; non-identical requests miss and re-transcode. No predictive variant generation.

---

## The Decision Protocol

Every encoder choice — resolution, quality, format, codec, sample rate — is made by this protocol:

1. Enumerate candidate configurations for the request `{source, target, q_preset, format}`.
2. Score each candidate against ALL six constraints simultaneously: bytes, quality floor, wall time, simplicity to implement, maintainability, cost.
3. Eliminate any candidate that breaks a constraint.
4. Among survivors, pick the one with smallest bytes.
5. If no candidate survives all constraints, the request specification is the problem — either the floor is too high for the source, or the source is wrong for the target. Return the closest legal candidate and a header explaining the trade, rather than silently degrading.

**This is not optimization with a single objective. This is constrained optimization with multiple constraints, where bytes is the thing being minimized and everything else is a constraint that must be cleared.** The mathematical structure is well-known; the discipline is in not collapsing it into "optimize one thing" because that's easier to reason about.

### Anti-patterns to watch for

- **Picking one constraint as the objective and ignoring the rest.** Example: "minimize pixel averaging" is not the goal; it's at best a contributor to quality, and only when it doesn't blow the byte budget. Whole sessions have been lost to this.
- **Binary framing where multi-objective is required.** "Should we mod-16 align or not?" is the wrong question. The right question is "for this {source, target, q_preset, format}, does mod-16 alignment reduce bytes while holding all other constraints?" The answer is yes for the photo-downsample case and no for the tiny-source case.
- **Engineering purity without production grounding.** "No averaging at the encoder" sounds principled until it costs bytes the user doesn't perceive. Production discipline says: every constraint earns its weight or it's not a constraint.
- **Hidden objective drift.** A session starts with "smaller files" and ends with "preserve dark pixels" without anyone noticing. The drift is gradual, in closing prose, and only obvious in retrospect.
- **Treating "reject as canonical rule" as "delete from candidate set."** When multi-objective replaces a single-objective draft, the draft's content does not vanish — it gets reframed as one candidate technique scored against the full attribute list. Rejected candidates stay in the candidate set; only their *promotion to canonical rule* is rejected. Erasing the candidate is itself binary thinking: the technique may still win on a different request profile or a different q_preset, and erasing it means re-deriving it next session.
- **Editing history without explicit confirmation.** A session journal records the path that produced the destination, not just the destination. When a wrong turn is corrected, both the wrong turn and the correction stay in the record. Rewriting the journal to read as if the mistake never happened erases the lesson the next session needs to learn from. If a handoff revision removes content that records past failure, that revision needs explicit operator confirmation before landing.

---

## How This Document Is Used

Every session that touches encoder logic, URL vocabulary, or codec configuration reads this document first. The first oddkit call in a session should be `get` on this URI:

    klappy://canon/values/project-goal

This is enforced by convention, not by tooling — the same way the creed is enforced. The agent's job is to internalize the goal before proposing changes. The operator's job is to call out when sub-objectives are eclipsing the outcome.

If a proposed change touches encoder parameters, the change description must include a brief multi-constraint trade analysis: "this reduces bytes by X%, holds the quality floor at preset Y, costs Z ms of additional wall time, adds W lines of branching logic." If any constraint isn't named, the analysis is incomplete.

---

## Constraints on This Document

This document is subordinate to `canon/values/project-identity.md` and the parent canon's axioms. If a quality attribute listed here conflicts with the creed or the foundational axioms, the creed and axioms govern.

This document does not replace `canon/handoffs/2026-05-26-exploration-journal.md`. That journal is the prose form of the same reasoning, plus the historical record of how the framing was reached. This document is the operational form. Both exist because both are useful at different points in a session.

## Prior Art and Method

The frame this document uses — multi-objective optimization with a primary cost function and a set of constraints (quality attributes) in tension — is not novel. It is the per-project application of two existing canon docs:

- `klappy://canon/principles/quality-attributes-are-in-tension` — the principle that quality attributes are structurally in tension and cannot all be maximized simultaneously
- `klappy://canon/methods/quality-attribute-tension-survey` — the seven-phase method for surfacing the ilities that matter for a project, ranking them, and naming accepted sacrifices

The six attributes named above are the output of applying that method to transcode-mcp at v1 scope. They are not invented vocabulary; they are the project-specific instance of the canonical method.

## Retraction Conditions

This document is retracted, narrowed, or revised if:

- A production measurement on a real source corpus shows the byte-minimization framing produces visibly worse quality than a quality-first framing at the same byte budget. Bytes-primary is a hypothesis backed by the exploration journal and operator intuition; it has not yet been tested against a real Bible-translation media corpus.
- A constraint listed above turns out to be slack (the system never bumps against it) or strictly dominated by another. Slack constraints add noise without adding information.
- A constraint emerges that the current six don't cover and that genuinely tensions against them. New constraints get added with the same level of operational detail (floor/ceiling, why it tensions, scope).
- The operator names that the framing is still off. The framing is in service of the operator's intent; if the operator says it doesn't match, the operator wins.

## Lineage

The wording "the system of constraints is the trick" comes from the exploration session of 2026-05-26 (`canon/handoffs/2026-05-26-exploration-journal.md`). The multi-objective framing this document operationalizes is a working hypothesis derived from that wording plus the existing canon method at `klappy://canon/methods/quality-attribute-tension-survey`. It has not been validated against a real source corpus yet; that validation is named in the open items of the latest planning journal.
