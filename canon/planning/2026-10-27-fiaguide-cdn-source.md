---
title: FIA Guide CDN video sources use an exact host allowlist
date: 2026-10-27
status: working
---

# Decision — FIA Guide CDN video sources use an exact host allowlist

> Admit canonical assets only under `https://cdn.fiaguide.app/`, preserving URL validation and existing deployment gates. Wildcard FIA Guide access is outside this change.

## Summary — Scope and acceptance

Operator authorization: “Add the cdn subdomain to the allow list. Or the wildcard for all fiaguide.app.”

Decision: add only `https://cdn.fiaguide.app/` to the shared video source prefix list. The wildcard alternative is declined to keep access scoped to the requested CDN. At baseline `6d72b33`, Worker and container share this list and canonical URL validation; preserve that validation and the catalog contracts, recipes and cache keys.

Acceptance: a canonical CDN asset selects the same lazy contract in Worker and container at every supported size. Sibling hosts, nested subdomains, suffix spoofing, credentials, query/fragment and noncanonical spellings stay rejected before encoder allocation. Existing tests and typecheck must pass. Retract this decision if admission extends outside the exact CDN host.

Release: independent exact-commit review, then existing Workers Builds integrations only: main/development → staging → production. Require exact build SHA and runtime smoke plus changed-path evidence at each rung before promotion. No domain, binding, bucket, credential or pipeline changes. Source rollback is a reviewed Git revert; normal runtime verification can create bounded existing cache entries.

Observed rail context: the old broad video ticket remains ordered/deferred and is not authority for unrelated work. This change uses the current explicit CDN instruction. Open PRs #35 and #51 are unrelated and excluded. The repository has no `.agents/` directory.
