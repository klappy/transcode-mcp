---
title: Core Governance Baseline
date: 2026-05-27
status: stable
derives_from: canon/values/project-identity.md
complements:
  - canon/constraints/definition-of-done.md
  - canon/governance/writing-conventions.md
governs: All work in klappy/transcode-mcp
---

# Core Governance Baseline

> Five constraints that every decision in this repo is measured against: the Proactive Integrity creed and four axioms (the values layer), proxy-first lazy transcoding (the architecture layer), official SDK only for MCP (no hand-rolled protocol), document-first via DOLCHEO (decisions encoded before code), and the Worker / Container boundary (Worker owns routing and simple paths, Container owns ffmpeg). Every challenge, gate, and audit in this project enforces some subset of these. If a proposal violates any of them, the proposal is reframed or rejected — not the constraint.

---

## Summary — Five Constraints, One Source of Truth

This document is the minimal set of constraints every other canon document, planning decision, and code change in the repo must be consistent with. It collapses the values layer (creed + axioms, lifted from `canon/values/project-identity.md`) with the architecture and process layer (proxy-first, official SDK, document-first, Worker/Container boundary) into one reference. When `oddkit_challenge` or `oddkit_gate` fires in this project, this is the file it is checking against. The set is intentionally small — five entries — so it stays present in working memory rather than fading into a checklist nobody reads.

---

## The Creed (Proactive Integrity)

> Before I speak, I observe. Before I claim, I verify. Before I confirm, I prove. What I have not seen, I do not know. What I have not verified, I will not imply.

Full text and per-line axiom mapping live in `canon/values/project-identity.md`.

---

## The Four Foundational Axioms

1. **Reality Is Sovereign** — observe before asserting.
2. **A Claim Is a Debt** — every assertion requires evidence.
3. **Integrity Is Non-Negotiable Efficiency** — shortcuts on truth always cost more.
4. **You Cannot Verify What You Did Not Observe** — if you didn't look, you don't know.

Authoritative source: `klappy://canon/values/axioms`. In-repo reference: `canon/values/project-identity.md`.

---

## The Five Project Constraints

### 1. Proxy-First + Lazy Transcoding

Generate optimized URLs immediately; do the actual transcode work only on first request. URLs are deterministic from inputs, so the URL itself becomes the cache key — repeat requests fetch from cache without recomputing. This is the load-bearing performance and architecture decision; it is what makes the proxy stateless for images and content-addressable for audio.

Authority: `canon/handoffs/2026-05-26-planning-journal.md` (architecture pivot to stateless HTTP proxy); `canon/encodings/2026-05-26-planning-session.tsv` (D rows on stateless proxy and pure-function transcoding).

### 2. Official SDK Only (Cloudflare Agents)

The MCP surface uses `createMcpHandler` or `McpAgent` from the Cloudflare Agents SDK. No hand-rolling of MCP protocol, transport, tool discovery, or schema. The SDK is the borrowed primitive; anything custom in those layers is reinventing what an official maintained library already does correctly.

Authority: `canon/planning/2026-05-27-mcp-integration.md`.

### 3. Document-First via DOLCHEO

Significant decisions, observations, learnings, and constraints are encoded into the project's DOLCHEO+ TSV record before being implemented in code. The TSV is the durable record; the journal is the path that produced it; the code is the consequence. This sequencing is what makes the project legible to future agents (and to the operator after a context break).

Authority: `canon/governance/writing-conventions.md` (TSV document type and schema); `canon/encodings/` (existing records).

### 4. Worker / Container Boundary

The Worker owns routing, URL parsing, validation, half-class arithmetic, Cache API lookups for images, and the env.IMAGES binding for image transforms. The Container owns ffmpeg, codec recipes, and content-class detection for audio. The Worker never holds an ffmpeg flag; the Container never knows about the URL vocabulary. The boundary is enumerated explicitly in the planning doc — implicit boundaries produce sprawl.

Authority: `canon/planning/2026-05-26-worker-container-boundary.md`; parent canon `klappy://canon/principles/vodka-architecture`; promotion `klappy://docs/promotions/P0006-vodka-boundary-enumeration-as-spec-convention`.

### 5. Anti-Cache Lying

TTL caching of derived or mutable content is forbidden — it serves a past observation as current truth. Content-addressed storage (R2 keyed by sha256 of canonical input) is the only acceptable cache for audio outputs. ETag fast-paths on source identity are acceptable only because they sit on top of a sha-ground-truth (download-and-hash on first encounter, ETag confirms on subsequent requests).

Authority: parent canon `klappy://odd/constraints/anti-cache-lying` (note: under `odd/`, not `canon/`); `klappy://docs/incidents/oddkit-stale-cache-2026-02` (the precedent incident); in-repo planning at `canon/planning/2026-05-26-worker-container-boundary.md`.

---

## Gate and Challenge Expectations

- Run `oddkit gate` before mode transitions (exploration → planning → execution and back).
- Run `oddkit challenge` on strong claims and proposals before encoding them.
- Run `oddkit preflight` before any execution that produces an artifact.
- Run `oddkit audit` on PRs touching `canon/` (CI integration is a queued handoff, not yet wired).
- Address missing prerequisites (evidence, alternatives, reversibility, success criteria) before proceeding when challenge fires `block_until_addressed`.

---

## Constraints on This Document

This document is subordinate to the parent canon. Where this baseline and the parent canon disagree, the parent canon governs. Where this baseline and another in-repo document disagree, this baseline governs.
