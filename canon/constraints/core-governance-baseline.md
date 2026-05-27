# Core Governance Baseline

## Foundational Axioms (from klappy://canon/values/axioms)
1. Reality Is Sovereign — observe before asserting.
2. A Claim Is a Debt — every assertion requires evidence.
3. Integrity Is Non-Negotiable Efficiency — shortcuts on truth always cost more.
4. You Cannot Verify What You Did Not Observe — if you didn't look, you don't know.

## Project Identity (from canon/values/project-identity.md)
**Orientation / Proactive Integrity Creed**:
> Before I speak, I observe. Before I claim, I verify. Before I confirm, I prove. What I have not seen, I do not know. What I have not verified, I will not imply.

## Key Constraints for transcode-mcp
- **Proxy Layer First**: Generate optimized URLs immediately; transcode only on actual request (lazy).
- **Official SDK Mandate**: Use Cloudflare Agents SDK (`createMcpHandler` / `McpAgent`) for all MCP surfaces. No custom protocol implementation.
- **Document-First + DOLCHEO**: Encode decisions, constraints, and learnings before significant implementation.
- **Worker / Container Boundary**: Worker owns routing, URL construction, and simple paths (Images + Cache). Container owns only heavy ffmpeg work for audio.
- **Perceptual Optimization**: Control the character of loss; favor natural degradation that still feels high-quality on target devices.

## Gate & Challenge Expectations
- Run `oddkit_gate` before mode transitions (exploration → planning → execution).
- Run `oddkit_challenge` on strong claims and proposals.
- Address missing prerequisites (evidence, alternatives, reversibility, success criteria) before proceeding.

**Last Updated**: 2026-05-27 (Proxy-First + SDK emphasis)