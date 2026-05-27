---
title: Success Criteria and Irreversibility Assessment
date: 2026-05-27
status: working
mode: planning
derives_from: canon/handoffs/2026-05-26-planning-journal.md
complements:
  - canon/constraints/definition-of-done.md
  - canon/planning/2026-05-27-mcp-integration.md
---

# Success Criteria and Irreversibility Assessment

> The Worker skeleton is done when the MCP endpoint responds with a valid tool list, `generate_transcode_url` returns well-formed canon-format URLs, the image path uses the env.IMAGES binding or Cache API without a Container call, the audio path lazily delegates to the Container only on first request, all routes pass smoke verification against the deployed Worker, and `oddkit audit` is clean on the repo. No part of this skeleton is a one-way door — the URL construction and routing are pure logic, fully reversible until the audio Container recipes are locked and deployed.

---

## Summary — What "Done" Looks Like for the v1 Skeleton, and What It Costs to Roll Back

This document is the success contract for the initial Worker skeleton. It enumerates the artifacts and behaviors that must be present before the project can claim it has transitioned from `planning` to `execution`. It also assesses how much of the work is reversible — answer: most of it, until audio Container recipes are locked and the v1 deploy is publicly cited. Until both this document and the underlying changes pass `oddkit_validate`, the project's README should not claim "execution phase." The current README does claim it; that claim is unpaid and is an open item below.

---

## Success Criteria for the v1 Worker Skeleton

A change is done when every item below has a captured artifact:

1. **MCP endpoint responds with a valid tool list** via `createMcpHandler`. Artifact: response capture from `POST /mcp` showing the tool schema.
2. **`generate_transcode_url`** accepts `media_type`, `source_url`, and `options` and returns a canon-format URL string. Artifact: example call and response.
3. **Image path** uses the env.IMAGES binding and the Cache API; no Container is invoked. Artifact: log line or trace showing the binding call.
4. **Audio path** lazily delegates to the Container only on first request; subsequent identical requests hit R2 without a Container spawn. Artifact: log lines for first request (Container spawn) and second request (cache hit).
5. **All routes pass a smoke test** — a script in `smoke-test.ts` issues real requests to a deployed Worker (preview or production) and asserts 200 plus the expected `Content-Type`. Artifact: smoke-test output checked in.
6. **`oddkit audit`** is clean on the repo. Artifact: audit output showing zero error-level findings.
7. **Evidence captured** per the Definition of Done: logs, sample URL output, screenshot or recording of the MCP inspector for the tool list.

---

## Irreversibility Assessment

- **Reversible until** the audio Container recipes are locked and a v1 deploy has been publicly cited from a downstream project. Before that, every part of the skeleton is pure logic plus configuration — rollback is a code revert.
- **One-way door risk in v1:** none. URL construction is deterministic; routing is reversible; image transforms are stateless; audio transforms are content-addressed (so superseded outputs are eventually GC'd without breaking older citations).
- **Borrow evaluation already applied:** official SDK chosen over custom protocol; env.IMAGES binding chosen over Container for images; libopus chosen over alternative codecs at this bitrate range. All three have evidence in prior planning docs.
- **Rollback plan if the Cloudflare Agents SDK proves friction:** revert to static URL construction (the URL vocabulary stays the same; the MCP tool surface goes away or moves behind a custom handler). Low risk because the URL is the product, not the MCP layer.

---

## Gate Closure Plan

Once every success criterion is met and the artifacts are captured:

1. Run `oddkit_validate` with the artifact list.
2. If `VERIFIED`, run `oddkit_gate` with input "moving from planning to execution" and the captured artifacts as context.
3. If the gate returns READY, commit a handoff entry in `canon/handoffs/YYYY-MM-DD-execution-gate-closure.md` recording the transition and the artifacts.
4. Update `README.md` "Status" section to reference the gate-closure handoff.

---

## Open Items

- The README currently states *"Execution phase — Core functionality live"* (`P2`). No handoff or ledger entry records the gate closure. Either backfill the gate-closure record (with the artifacts above), or walk the README back to "Planning — Skeleton in progress." This is logged in `canon/encodings/2026-05-27-canon-conventions-session.tsv`. Closes when either action lands.

---

## Constraints on This Document

This document is subordinate to `canon/constraints/definition-of-done.md`. The success criteria here are the v1-skeleton-specific application of the DoD; if the two disagree, the DoD governs.
