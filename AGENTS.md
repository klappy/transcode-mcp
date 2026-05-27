# AGENTS.md

## Agent Interaction Guidelines for Klappy/transcode-mcp

This file documents learnings from bootstrapping oddkit into the repo and how AI agents (LLMs) should interact with the canon, governance, and MCP surface.

### Key Learnings from oddkit Bootstrapping
- **Document-first philosophy**: Always encode decisions via DOLCHEO before code changes.
- **Challenge & Gate**: Use oddkit challenge on proposals and gate on mode transitions.
- **With/without kb_url**: Strict mode with knowledge_base_url for repo-specific canon; fallback to baseline.
- **Progressive disclosure & vodka architecture**: Keep canon thin and focused.
- **Evidence-driven**: Require scaffolding (alternatives, risks, disconfirmers) for principles.

### oddkit Tool Usage for Agents
Agents should call oddkit tools via the connected service for:
- `oddkit_challenge`: Pressure-test claims.
- `oddkit_gate`: Check phase transitions.
- `oddkit_encode`: Structure learnings as DOLCHEO.
- `oddkit_audit`: Validate links and governance.
- `oddkit_preflight`: Surface relevant docs.

### MCP Tool Surface for oddkit
The MCP config (see mcp-oddkit-config.json) exposes oddkit actions as LLM-callable tools for intelligent URL generation and canon maintenance.

Refer to canon/governance/writing-conventions.md for authoring rules.
