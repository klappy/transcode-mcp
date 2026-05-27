---
title: MCP Integration Plan
date: 2026-05-27
status: working
mode: planning
derives_from: canon/handoffs/2026-05-26-planning-journal.md
complements:
  - canon/planning/2026-05-26-url-vocabulary-and-presets.md
  - canon/planning/2026-05-26-worker-container-boundary.md
applied_canon:
  - klappy://canon/principles/vodka-architecture
---

# MCP Integration Plan

> The MCP surface uses the official Cloudflare Agents SDK (`createMcpHandler` or `McpAgent`). No hand-rolling of protocol, transport, or schema. The only tool in v1 is `generate_transcode_url(media_type, source_url, options) → URL string` — a URL constructor, not a transcoder. The LLM caller is a smart user of the URL vocabulary, identical in privilege to the translation workspace app that is the primary programmatic caller. The MCP layer's role is teaching an LLM to use the proxy well; the proxy itself doesn't distinguish caller types.

---

## Summary — Official SDK, One Tool, URLs Are the Output

The MCP integration is intentionally narrow: one tool that returns URL strings, built on the official Cloudflare Agents SDK. The tool's job is to apply the URL vocabulary in `canon/planning/2026-05-26-url-vocabulary-and-presets.md` consistently — picking the right preset, the right width, and the right format for the caller's context. The LLM does not transcode and does not handle media; it constructs URLs that the caller (browser, app, fetcher) then loads through the proxy. This keeps the MCP surface vodka-thin: the tool is documentation-as-a-tool-surface, teaching the URL convention rather than acting on it.

---

## Decision

Use the official Cloudflare Agents SDK as the MCP middleware. `createMcpHandler` from `agents/mcp` wraps an `McpServer` from `@modelcontextprotocol/sdk` and integrates with the Worker's `fetch` handler. No custom protocol code; no custom transport.

---

## Tool Schema

One tool in v1:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| name | `generate_transcode_url` | yes | Tool identifier |
| `media_type` | enum `image` / `audio` | yes | Routes to image or audio pipeline |
| `source_url` | string | yes | Origin URL of the source media |
| `options.w` | integer | image only | Target display width |
| `options.h` | integer | image only | Target display height |
| `options.q` | enum `low` / `medium` / `high` | optional | Quality preset; defaults to `medium` |
| `options.f` | enum `auto` / `avif` / `webp` / `jpeg` | image only | Output format |
| `options.preset` | enum `voice` / `music` | audio only | Content-type preset |

Return: A single string — the proxy URL — following the format defined in `canon/planning/2026-05-26-url-vocabulary-and-presets.md`.

A second tool (`docs(query, audience?, depth?)`) proxies natural-language canon lookups to oddkit. It is in the Worker source but its inclusion in v1 is operator-decision-open — it duplicates what the canon's own search surface already offers.

---

## Worker Integration

`src/worker.ts` imports `createMcpHandler` from `agents/mcp` and `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`. The handler is mounted at `/mcp` in the `fetch` export. Both packages must be declared as runtime `dependencies` in `package.json` (the current `package.json` declares neither — see Definition of Done; this is part of the queued code-fix pass).

---

## Open Items

- Whether to ship the `docs` tool in v1 or defer it.
- Whether the MCP tool returns just the URL or a small envelope (`{ proxy_url, target_sample_rate, encode_sample_rate }`). The current source returns the envelope; the schema above assumes the simpler URL-string contract per the planning journal. Reconcile before claiming this document `stable`.

---

## Constraints on This Document

This document is subordinate to `canon/planning/2026-05-26-url-vocabulary-and-presets.md` (URL vocabulary) and `canon/planning/2026-05-26-worker-container-boundary.md` (which side of the boundary the MCP surface sits on). It is the binding plan for how the MCP surface gets wired; it does not redefine the URL vocabulary or the boundary.
