# Success Criteria & Irreversibility Assessment

## Success Criteria for Initial Worker Skeleton
- MCP endpoint responds with valid tool list via official `createMcpHandler`
- `generate_transcode_url` tool accepts media_type, preset, quality, source_url and returns a well-formed proxy URL
- Image path uses Cloudflare Images binding or Cache API without container call
- Audio path correctly delegates to container only on first request (lazy)
- All routes pass basic smoke test (curl or browser)
- Updates to canon/ and src/ pass `oddkit_audit`
- Evidence: logs + sample URL output + screenshot of MCP inspector

## Irreversibility Assessment
- **Reversible until**: Full audio container recipes are locked and deployed
- **One-way door risk**: None in current skeleton (pure URL generation + routing)
- **Borrow Evaluation already applied**: Official SDK + existing planning artifacts
- **Rollback plan**: Revert to static URL construction if SDK integration shows friction (low risk)

## Gate Closure Plan
- Once success criteria met and evidence provided → re-run `oddkit_gate` (planning → execution)
- Address any remaining challenge feedback in the next borrow-evaluation iteration

**Ties to**: definition-of-done.md, core-governance-baseline.md, mcp-integration.md, worker-container-boundary.md