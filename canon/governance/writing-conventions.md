---
title: Writing Conventions for Canon Documents
audience: project | agent | operator
exposure: working
voice: neutral
stability: draft
tags: [canon, governance, writing, oddkit]
date: 2026-05-27
canonical_status: working
companion_to: [klappy://canon/constraints/definition-of-done.md]
---

# Canon Writing Conventions for Klappy/transcode-mcp

## What this answers
How to author durable, agent-retrievable canon documents that follow ptxprint-mcp patterns while addressing the challenge on "document-first" governance creation.

## Reframed Plan (Hypothesis)
**Hypothesis**: For MCP-style tools like transcode-mcp (lighter scope than ptxprint-mcp), a document-first approach with upfront governance files will produce higher-quality, more maintainable canon than parallel code+docs or minimal bootstrap. 

**Evidence**: Successful application in Klappy/ptxprint-mcp (one case). 
**Alternatives considered**: Lightweight governance bootstrap → iterative updates → code in parallel.
**Risks / Failure conditions**: Canon becomes outdated faster than we can maintain it; over-documentation delays useful prototypes for Bible translation offline testing.
**Reversibility**: Fully reversible — we can prune or archive governance docs if they prove excessive.
**Disconfirmers**: If after v1 Worker implementation we find canon maintenance cost > value, or if lighter scope makes full governance unnecessary.
**Scoped to**: Canon-heavy MCP repos; transcode-mcp may start lighter and evolve.

We will monitor and reconsider if gate prerequisites remain unmet after initial governance layer.

## Best Practices
- Use required YAML frontmatter (see examples in ptxprint-mcp canon).
- Progressive disclosure: Lead paragraph → details/tables → examples → open items.
- Tables for presets, options, comparisons.
- Explicit DOLCHEO references.
- Run oddkit preflight/audit/gate before commits.
- Mark superseded docs and move to _archive/.

## Next Actions
- Create definition-of-done.md and core-governance-baseline.md.
- Update canon/README.md as index.
- Encode this document as D/L in planning TSV.

