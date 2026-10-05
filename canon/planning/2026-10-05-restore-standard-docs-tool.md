---
title: Restore Docs as the Standard Live Canon Proxy
date: 2026-10-05
status: working
mode: planning
derives_from: klappy://canon/constraints/retrieval-disclosure-contract
complements:
  - klappy://canon/patterns/docs-proxy-canon-as-tool
  - canon/governance/oddkit-mcp-clients.md
  - canon/governance/writing-conventions.md
  - canon/planning/2026-10-05-transcode-session-synthesis.md
---

# Restore Docs as the Standard Live Canon Proxy

> Restore `docs` as a live pinned Oddkit proxy under the active retrieval-disclosure contract: search returns cheap caller-selected discovery, while one explicit URI get returns one body. Reject legacy depth2/3 with migration guidance; add no domain ranking, bundled snapshot or automatic body fanout.

## Summary — Restore the Regression Using the Existing Standard

The historical Worker at d7f5331 exposed `docs`; the image-worker rewrite at92f8657 removed it. Current live production advertises only `generate_transcode_url`. Restore `docs` beside that existing tool so users can retrieve the current canonical decisions through one MCP connection. This follows the live active `klappy://canon/patterns/docs-proxy-canon-as-tool` retrieved2026-10-05T05:17:18Z, content_hash `1a6jbq`. The user also explicitly invoked the kitchen hygiene tool-surface standard; retain two tools, within its proposed four-tool ceiling, without redesigning the existing action interface.

## Active Disclosure Contract Takes Precedence

The active `klappy://canon/constraints/retrieval-disclosure-contract`, read2026-10-05T05:23:08Z, governs every retrieval consumer. It takes precedence over the older docs-proxy pattern's depth-based body fanout. Preserve the tool name `docs` and required `query:string`; add an explicit `action` of `search` (default) or `get`. Search query is natural-language text; get query is exactly one source URI. Do not automatically fetch a search result body.

Search declares default `disclosure:[]`: URI/title plus upstream action-native score/snippet, with optional `blockquote`, `metadata`, `summary`. Search `body` is an explicit disclosure error, never silently dropped. Get declares default `["body"]`, accepts one URI and at most one document; caller may request narrower supported disclosure. Forward the standard structural filters and pagination (`limit`, `offset`) to search without local ranking, filtering or taxonomy. Return upstream canonical `data`, total/pagination and filter/disclosure echoes; retain actual governance/provenance metadata. Apply upstream per-flag caps rather than inventing a parallel set.

Legacy `depth:"1"` remains accepted as the search floor. Legacy depth2/3 returns `DEPTH_MIGRATION_REQUIRED` with actionable instructions: search first, choose a returned URI, then call `docs` with action`get` and that URI. Do not silently substitute a summary for a caller's old full-body request. This explicit migration was chosen because the tool is absent from current production and the active contract prohibits query-shaped body retrieval. Preserve the old response envelope only with an explicit `include_legacy_envelope:true` opt-in; that option never permits body fanout or bypasses disclosure rules. If conflicting legacy and explicit disclosure inputs are supplied, reject with migration guidance rather than infer intent.

Accept and forward explicit upstream audience/filter intent. Omitted audience does not become a restrictive `headless` filter: historically that default was accepted but ignored, and silently filtering would hide untagged repository canon. Preserve declared upstream defaults and echoes. Upstream absence/failure degrades gracefully to a bounded minimal-governance error, never fabricated source content.

The proxy knows only `https://github.com/klappy/transcode-mcp` as knowledge_base_url and `https://oddkit.klappy.dev/mcp` as endpoint. Retrieve live canon and preserve upstream ordering/disclosure. No domain parsing, ranking, filtering, scoring, reframing, bundled snapshot, caller-selected endpoint, filesystem access or media action. Protocol-envelope decoding is transport work, not domain interpretation. Use current Oddkit `result.data` body/provenance fields rather than historical response assumptions.

## Narrow Restoration and Validation

Use the existing MCP Client/StreamableHTTP pattern and existing Worker server registration. Apply normal bounded transport lifetime, error handling and finally-close cleanup; no retry loop or new service. Owned code is the docs proxy/helper, existing tool registration, focused contract tests and existing MCP smoke checks. Preserve `generate_transcode_url`, existing authentication, media routes, deployment workflow and telemetry behavior. No new execute tool or action-interface redesign.

Verify exact tool discovery, search floor, optional disclosure, body rejection on search, single-URI get, forwarded filters/pagination, actual canonical envelope/echoes, explicit depth2/3 migration, opt-in legacy envelope, graceful no-hit/failure behavior and transport cleanup. Check the live docs calls retrieve today's session synthesis and H.264-only decision with correct source/status, rather than a stale historical codec proposal presented as active. Preserve source history and all measured limitations. Run the existing canon/oddkit audit and writing-convention checks before publication. Complete existing Cloudflare DEV→staging→production validation; do not claim restoration before actual MCP retrieval succeeds.
