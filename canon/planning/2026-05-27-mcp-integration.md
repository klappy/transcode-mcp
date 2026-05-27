# MCP Integration Plan

## Decision
Use official Cloudflare Agents SDK (`@cloudflare/agents` / `createMcpHandler()`) as the MCP middleware.

No hand-rolling of MCP protocol, transport, or discovery.

## Tool Schema (proposed)
- Tool: `generate_transcode_url`
- Parameters: media_type, options (presets, dimensions, quality), source_url
- Output: Optimized proxy URL

## Worker Integration
- Import from Cloudflare Agents SDK in the main Worker.
- Expose as remote MCP server.

## Next
Audio container recipes and half-class math before full implementation.