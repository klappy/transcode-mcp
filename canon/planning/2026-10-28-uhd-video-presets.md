---
title: Additive UHD video targets require genuine master qualification
date: 2026-10-28
status: working
mode: execution
---
# Additive UHD video targets require genuine master qualification

> Add1080p1920×1080,3K3072×1728 and4K3840×2160 to the existing lazy proxy. Preserve old profiles, host policy, master and infrastructure. Unchanged256MiB input/60MiB output ceilings and unchanged300s encode/600s job budgets require Linux measurement of the final master before release.

## Summary — additive target data, pending runtime evidence

Klappy requested these three sizes using the existing proxy.3K is explicitly16:9,3072×1728. The same fit/no-upscale, H264 two-pass, stereoAAC, integer-divisor max30fps, deterministic R2 publication and range delivery methods apply. Prior xlarge1616×912 and closed catalog rows remain unchanged. Source policy remains unchanged; CDN permission belongs to PR108@66481b7, not this patch. PR109 UX remains separate.

## Decision and six constraints

Reuse xlarge bitrate per coded pixel as an initial rate candidate, rounded up to whole kbps, with2× maximum rate and4× buffer. Quality is unqualified until actual motion review. More pixels increase bytes/egress/storage and wall time; no reduction is claimed. Existing60MiB output and256MiB input ceilings remain. The selected efficient4K delivery source fits256MiB; archivalmaster support is excluded from this release. Existing300s encode,120s source and600s job ceilings remain; if measurement fails, select measured budgets through review rather than silently shrinking the master. Simplicity and maintenance use one additive data module and existing dispatcher; no new service/cache/credentials. Source streaming remains disk-backed and byte-bounded; output remains whole-buffered, which must be measured on existing standard-4 resources.

## Open qualification and release gates

Unit tests establish vocabulary, shared contracts, exact raster, no upscale, old limits and cache separation. They do not establish real encode quality or processing viability. No local Docker runtime is available. Existing CI qualification depends on unavailable artifact11321498762/run37253567874. Final master and a working existing qualification path are required before deployment. New module bytes enter lazy encoder identity; old lazy identities therefore change as with other adapter changes, while closed catalog identity is unchanged.

Remote kitchen ticket publication succeeded at9ecd11fc; its subsequent evidence update was denied, recorded in local ../uhd-presets/JOURNAL.md. No denied PR109 review-comment retry, formal approval or host-policy expansion is authorized by this request. Release requires independent review, version/changelog ordering, actual exact-commit development→staging→production Build and runtime proof, and journal/ticket closure.

## Existing workflow UHD qualification mode

The existing video-qualification.yml now has explicit retained(default) and uhd modes. Retained artifact pins and scripts stay unchanged. UHD takes exact reviewed commit and pinned canonical runtime-approved URL/SHA256/bytes/duration; inputs must have positive byte count not exceeding256MiB, duration at most600s, and a real source probe must establish3840×2160/50fps. One120s origin GET is streamed to disk and verified before encoding; no redirects/retry. A CI-only transport serves those verified bytes to each actual lazy handler in an offline existing image, with no production transport option.

Sequential1080p/3k/4k jobs run under4CPUs,8GiB memory/no swap,1408MiB tmpfs and256PIDs; output evidence plus full tmpfs reservation counts toward a4GiB disk ceiling. A26-minute monitor/deadline sits inside the existing30-minute workflow; each target needs650s remaining for admission. Runtime300s encode/600s job/passlog limits remain real gates. Receipts include source/output identity, encoder identity, probes, two-pass timing/statistics, frames, Docker resource samples/OOM state and cleanup. Measured results still require independent motion-quality review and public tier/cache/range/browser proof. Container CPU/memory limits are conservative proof bounds, not asserted identical to deployed resources.

This mode removes the missing historical artifact dependency only for explicitly selected UHD qualification; it does not restore or waive the legacy qualification artifact gate. Final master input remains pending. No actual UHD run has been claimed.


Public source handoff now selects a distinct efficient4K delivery derivative226599540bytes SHA256900cc71230144c1305223e456f6da6e2ef54c73e20abf35b29478a4b1d0ed40a,127.26s3840x2160HEVC50fps. Archival513310509-byte master retains its separate identity. Qualification accepts positive pinned inputs up to256MiB; archival513310509-byte master is intentionally ineligible; genuine4K geometry/hash gates remain. The smaller derivative fits the old256MiB input ceiling; this does not qualify larger-input compatibility or UHD processing. Parent reports localPython sourceGET Cloudflare1010; no client/host/executor workaround attempted.


Release narrowing: preserve all existing xlarge limits for new target data, including60MiB output,256MiB input,32MiB per statistics file and64MiB aggregate statistics. UHD qualification must fail if these budgets are insufficient; no new limit expansion is included. Local existing delivery source independently hashed successfully, but public-source acquisition1010 and realLinux execution remain separate unresolved boundaries.

## Retained local bytes preserve public source identity

UHD_SOURCE_FILE selects consumer-local already-owned bytes, streamed into the evidence directory with exact pinned length/hash verification and zero origin requests. Missing, changed or symlink inputs fail; no URL fallback. The real CDN URL remains the contract identity, and runtime host policy is still required. Reconcile PR108 through ancestry on the feature branch before testing CDN identity; no substitute host or duplicate policy implementation. Linux/Docker/Node22 and the existing container build remain the tools. Offline encoder receipts cannot establish public source access or deployed delivery.
