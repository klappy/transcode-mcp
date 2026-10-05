---
title: Promote the verified H264 owner through existing isolated tiers
date: 2026-10-05
status: working
mode: planning
derives_from: canon/governance/deploy-architecture.md
governs: wrangler.toml staging and production video capacity and lifecycle flags
---

# Promote the verified H264 owner through existing isolated tiers

> Mirror the verified development standard-4 capacity and three compatibility flags into the existing staging and production stacks. Promote sequentially through Git-connected Workers Builds, accepting actual deployment, health, MCP/docs and media evidence at each tier before advancing. Preserve separate buckets/classes, five-instance cap and H264 baseline; development evidence is not production or physical-iPhone proof.

## Summary — Four config lines, two sequential environment gates

The existing user-authorized release needs the same capacity and owner lifecycle support already observed in development. After independent acceptance of this addendum, add explicit `compatibility_flags = ["nodejs_compat", "enable_request_signal", "durable_object_io_tasks_prevent_eviction"]` under both `[env.staging]` and `[env.production]`, and `instance_type = "standard-4"` under each existing container block. These are four added config lines. Do not deploy either tier directly: reviewed changes land on main first, then staging, then production through their existing Git-connected projects. Each tier requires its own exact build/version/image and stable health, real protocol/docs/media probes, verified cache completion and independent acceptance. Any failed gate holds the next tier. This extends the earlier DEV-only scope; it changes no encoder, source, cache identity, pool cap or media selection.

## Decision and evidence — Reuse the observed baseline

The installation already has isolated development, staging and production Workers, Durable Object classes and R2 buckets. Main `c8fcc7b7fa95a5c146f7728f5610ee4995bdcfe9` retains accepted video work in its existing DO owner. On stable DEV application version27, two external a184 requests disconnected after five seconds; one observed server job finished its two passes and container cleanup, then canonical R2 publication occurred39.214seconds after disconnect. A subsequent200HIT returned3,959,488bytes with SHA256 `1eab7e84a782a0681746ad60af822d089f801ec7d2a17dc825f45764ad391caf`. Independent evidence receipt SHA256 `440abafc061c2081b6d80e0e359d4365da0ac3c396aeb9cb6281f0f800558527` binds baseline, client, server/publication and full-HIT receipts. Two attempts and one logged encode are not explicit admission/join telemetry or an exactly-once guarantee.

Earlier actual a13 DEV MISS/HIT/range/HEAD/browser evidence established the H264/AAC path separately. A single successful deployment is sufficient to attempt the same bounded configuration in staging, not to presume universal reliability. Different tier builds may produce different valid derivative bytes; independently pin their outputs before FIA content publication.

This supersedes only the DEV-only restriction for the four stated fields in `canon/planning/2026-10-05-dev-video-capacity-cancellation-and-rendition-scope.md`. The accepted disconnected-work policy replaces the historical client-disconnect-cancellation promotion condition: stopping a viewer must not abandon verified cache completion. No explicit job-cancel endpoint is added. The reviewed storage-deadline settlement semantics remain unchanged; do not claim600seconds forcibly cancels R2 or guarantees cleanup through crashes.

## Change boundary — Preserve all existing stack identities

Keep compatibility_date2025-05-01, worker names, Git branches/triggers, DO class names/bindings/migrations, bucket names, images binding, container Dockerfile, max_instances5, existing10minute sleep policy and all source/encoder contracts unchanged. Standard-4 means4vCPU,12GiB memory and20GB disk, not five permanently running instances. Provisioned memory/disk idle cost remains material; no linear speedup or equal total charge is promised. Warm admission, shorter idle policy and cache-HIT wakeup optimization are separate work.

No alternate codec experiment, new service, public route, shared bucket, preview alias or GitHub Actions deployment belongs in this change. The top-level legacy config remains untouched. Existing observability must be checked per tier; DEV container logging enabled through its application configuration must not be assumed to propagate. If existing logs cannot supply required evidence, hold that gate and prepare a separately reviewed minimal observability change rather than weakening proof.

## Acceptance — Actual evidence before each next branch

1. Independently review the exact config diff and effective per-environment values. Required CI and applicable existing Linux/runtime tests must pass at the exact candidate. Main receives the reviewed config through the ordinary PR path; require its connected development full build and current health before promotion. A version upload alone is not a deployment.
2. Promote main to staging through a reviewed exact-tree PR. Require the existing staging Workers Builds project to complete for that merge SHA with `npx wrangler deploy --env staging`. Record build UUID, Worker version, container image/application version, effective4CPU/12GiB/20GB and all three flags. Wait for stable rollout/health; do not use another tier's resources.
3. Run both existing HTTP/image and MCP smoke scripts against that tier. Verify actual audio source conversion/cache behavior, not a placeholder-error response. Verify the expected tool catalog and live docs progressive disclosure/search and single-URI get behavior from the accepted docs implementation; a missing or failed docs surface remains a release hold, not permission to add a stub in this config patch.
4. Prove video against that tier: accepted-source MISS where genuinely absent, verified canonical output then full HIT/hash, GET/HEAD/ranges and bounded errors, actual browser decode/play/seek. Exercise disconnected-client completion on a genuinely absent qualified source and verify later canonical bytes/HIT; record actual observed phase/log and deployment identities. Never delete a valid cache merely to manufacture a MISS, or infer join telemetry from request count. Preserve failed attempts. Check existing audio/image regressions. No physical-iPhone playback/fullscreen equivalence follows from desktop evidence.
5. Obtain independent acceptance of staging's exact records before opening/merging the production promotion. Repeat steps2–4 on the existing production project using `npx wrangler deploy --env production` and its own resources. Record production-specific hashes and URLs. FIA app readiness requires its separate source/output binding and client gates after this service train.

## Alternatives, disconfirmers and reversal

Leaving staging/production on unspecified small capacity risks repeating the observed DEV timeout; promoting runtime without its DO lifecycle flag weakens the accepted ownership behavior. Creating another stack or deploying from Actions conflicts with existing governance. The smallest chosen change mirrors four proven settings while retaining all current infrastructure.

Failed exact-build identity, rollout health, cache integrity, disconnected completion, protocol/docs retrieval or existing audio/image behavior disconfirms readiness and stops the next promotion. Revert only the four config additions through the same reviewed Git-connected path if necessary, then observe actual rollout and prior behavior. Do not delete cached artifacts or promise that reverting capacity removes already-created data. Keep failure evidence and label video unqualified on a tier whose rollback no longer supports it.
