# Definition of Done (DoD)

## Core Principles
- **Evidence-Driven**: Every claim, decision, or completion must be backed by observable evidence (logs, screenshots, test output, metrics).
- **Proxy-First + Lazy Transcoding**: URLs are generated immediately; actual work happens on-demand only.
- **Official SDKs Only**: No hand-rolling of MCP, transport, or protocol layers — use Cloudflare Agents SDK.
- **Document-First**: All significant work is preceded by canon updates (planning docs, DOLCHEO, DoD references).

## For Planning Artifacts
- Clear problem statement
- Alternatives considered (at least 2)
- Risks / reversibility assessed
- Success criteria defined
- Ties to existing canon (cross-references)

## For Code Changes (Worker / Container)
- Passes `oddkit_audit` and link checks
- Includes test output or visual proof where applicable
- Updates relevant planning docs
- References this DoD
- MCP surface uses `createMcpHandler` or `McpAgent` from official SDK

## For Audio Recipes
- ffmpeg commands tested in container context
- Presets match voice/music rules (8k/16k/32k voice, appropriate music)
- Worker → Container boundary respected (preset name only passed)
- Evidence: sample command output + resulting file characteristics

## Evidence Requirements
- Visual proof for UI / perceptual changes
- Test output or logs for logic changes
- Metrics or before/after for optimization claims

**Last Updated**: 2026-05-27 (Proxy-First clarification)