---
title: Enable existing tier container logs before phase-dependent acceptance
date: 2026-10-05
status: working
mode: planning
derives_from: canon/planning/2026-10-05-proven-video-tier-promotion.md
governs: Existing staging and production container application observability
---

# Enable existing tier container logs before phase-dependent acceptance

> Before a tier's cold video proof, inspect its existing container application's current observability configuration. If logs are absent or disabled, enable only that application's logs through the existing Cloudflare application configuration, preserve every other setting, and wait for stable health. Use the already bounded phase events; do not invent phase evidence from HTTP status, add a service, or assume DEV logging propagates.

## Summary — One conditional setting per existing application

The promotion recipe requires actual correlated phase evidence. Root's read-only application list showed DEV logs enabled, while staging application `a03f72bf-0bb4-4038-b092-72974dcb196f` version4 and production `a03e7b44-dbbd-41cb-b654-7a927d788a72` version2 omitted observability. A list omission is a reason to inspect the current application GET, not authority to overwrite its configuration. After independent acceptance, root may set only `observability.logs.enabled` to `true` on each existing application when its fresh GET confirms absent/disabled logs. Staging precedes production; each must supply its own phase and media evidence. No API mutation or deployment is claimed by this document.

## Decision and boundary — Preserve the application, expose existing events

Root verified the current Cloudflare schema for `PATCH /accounts/{account_id}/containers/applications/{application_id}`. For a Durable Object-managed application, the supported update here is only top-level observability; submit exactly `{"observability":{"logs":{"enabled":true}}}`. Other application fields are scheduler-only and must not be included. The current PATCH schema has no concurrency/version field: do not invent one, send a full replacement configuration, or replay a stale list response. Obtain a fresh application GET immediately before this minimal PATCH and another afterward; verify logs enabled and all unrelated configuration unchanged.

This operation publishes runtime observability metadata without a Worker deployment or container rollout under the verified current API semantics. Record actual readback application/version/health rather than attributing an unrelated concurrent rollout to this PATCH. Worker/container code and image promotion still occur only through the existing Git-connected Workers Builds projects. Preserve class names, buckets, max_instances5, standard-4 qualification and existing retention policy. Do not add Logpush, a custom sink, a new dataset/service, secrets, public debug endpoints, extra log events or a retention extension.

The existing runtime emits at most16 bounded1KiB phase records per job with job/asset/recipe identity, phase, timing and limited outcome fields. Reuse them. Operator receipts retain only the required phase correlation and deployment identities; do not dump client IPs, authorization headers, source query secrets or unrelated request metadata. Existing platform retention and sampling limitations must remain explicit. An empty query does not prove no work occurred; require actual positive events for the job being accepted.

## Acceptance — Observe before claiming

Record pre-change application identity/configuration, exact mutation delta, post-change readback and stable health. Verify that the existing telemetry query path can retrieve container events for this tier. During its already authorized cold media proof, bind observed source verification, both encode exits and cleanup to the same job; separately verify canonical R2 publication and a full byte-verified HIT after disconnected clients. Do not equate container cleanup with an R2 quarantine inventory audit, nor two external attempts with explicit join telemetry. If phase data remains unavailable, preserve the failed observation and hold phase-dependent acceptance; no synthetic PASS or repeated encoding merely to search for logs.

This addendum changes no media recipe, ownership/deadline semantics, app readiness, codec policy or physical-device claim. The existing promotion recipe's docs/MCP/audio/image/video and exact-build gates remain required. Evidence from DEV can establish prior behavior; it does not replace actual staging/production verification.

## Risks and reversal — Logging is evidence support, not a reliability guarantee

Logging incurs existing-platform ingestion/storage costs and does not guarantee delivery of every event or job survival. The verified logs-only PATCH does not create a rollout; nevertheless, no proof may span an unrecorded independent deployment change. If enabling logs causes an observed regression, restore only its previous value through the same fresh-read/update/readback process; preserve receipts and keep the affected phase gate unqualified. Do not revert images, delete caches, shorten deadlines or create replacement infrastructure as part of reversal.
