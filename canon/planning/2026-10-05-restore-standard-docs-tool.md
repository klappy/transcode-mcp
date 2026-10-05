---
title: Restore Docs as the Standard Live Canon Proxy
date: 2026-10-05
status: working
mode: planning
derives_from: klappy://canon/patterns/docs-proxy-canon-as-tool
complements:
  - canon/governance/oddkit-mcp-clients.md
  - canon/governance/writing-conventions.md
  - canon/planning/2026-10-05-transcode-session-synthesis.md
---

# Restore Docs as the Standard Live Canon Proxy

> Restore the existing `docs(query, audience?, depth?)` tool using the kitchen's live Oddkit proxy pattern. Keep exactly the repository and Oddkit endpoint pinned, preserve the response envelope, and add no domain taxonomy, bundled snapshot, new tool name or media action.

## Summary — Restore the Regression Using the Existing Standard

The historical Worker at d7f5331 exposed `docs`; the image-worker rewrite at92f8657 removed it. Current live production advertises only `generate_transcode_url`. Restore `docs` beside that existing tool so users can retrieve the current canonical decisions through one MCP connection. This follows the live active `klappy://canon/patterns/docs-proxy-canon-as-tool` retrieved2026-10-05T05:17:18Z, content_hash `1a6jbq`. The user also explicitly invoked the kitchen hygiene tool-surface standard; retain two tools, within its proposed four-tool ceiling, without redesigning the existing action interface.

## Standard Binding and Compatibility

Preserve the tool name and historical arguments: required `query:string`, optional `audience:string`, optional `depth` string enum `"1"|"2"|"3"`; defaults `headless` and`"1"`. Follow the active standard's disclosure semantics: depth1 snippet, depth2 full top document, depth3 top plus next two. The old implementation treated2/3 identically; correcting depth3 to the invoked standard is explicit, not an accidental compatibility claim.

Return `{answer,sources:[],deeper:[],governance_source}`. Unreachable or failed retrieval gracefully returns null answer, empty sources, minimal governance and a bounded error. Preserve actual provenance/governance-source from Oddkit instead of falsely labeling parent/bundled fallback as repository authority. Historical audience was accepted but ignored; preserve accepted callers and use the current Oddkit-supported audience semantics without inventing a server-specific audience taxonomy or silently excluding the repo's canon.

The proxy knows only `https://github.com/klappy/transcode-mcp` as knowledge_base_url and `https://oddkit.klappy.dev/mcp` as the retrieval endpoint. Retrieve live canon. Preserve upstream ordering/disclosure; do not add domain parsing, ranking, filtering, scoring or reframing. Protocol-envelope decoding is necessary transport work, not permission to reinterpret domain answers. Use current Oddkit schemas and body/provenance fields, not stale assumptions that historical `result.content` still holds the document. No caller-controlled endpoint, runtime filesystem, bundled docs snapshot, automatic link crawl, container call, encode or storage mutation.

## Narrow Restoration and Validation

Use the existing MCP Client/StreamableHTTP pattern and existing Worker server registration. Apply normal bounded transport lifetime, error handling and finally-close cleanup; no retry loop or new service. Owned code is the docs proxy/helper, existing tool registration, focused contract tests and existing MCP smoke checks. Preserve `generate_transcode_url`, existing authentication, media routes, deployment workflow and telemetry behavior. No new execute tool or action-interface redesign.

Verify exact tool discovery, historical input/default compatibility, all three disclosure depths, real upstream response parsing, graceful no-hit/failure behavior and transport cleanup. Check the live docs calls retrieve today's session synthesis and H.264-only decision with correct source/status, rather than a stale historical codec proposal presented as active. Preserve source history and all measured limitations. Run the existing canon/oddkit audit and writing-convention checks before publication. Complete existing Cloudflare DEV→staging→production validation; do not claim restoration before actual MCP retrieval succeeds.
