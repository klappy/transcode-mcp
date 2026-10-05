# Four current capped video costs

Version 3, 5 October 2026. All four timing anchors below are actual Cloudflare DEV a 13 results at 25 fps. The [earlier report and model](2026-10-05-fia-video-cost-rubric.md) remain historical;320p is no longer represented by its earlier 50 fps CI proxy. These are observations from separate deployment identities, not a controlled speed experiment. No media was encoded for this calculation.

| Comparison | Actual bytes | File MB/min | Nominal MB/min before mux | Encode seconds | Pass seconds |
|---|---:|---:|---:|---:|---|
| 320p | 1,825,753 | 1.384 | 1.320 | 17.965 | 7.299/10.663 |
| 480p | 3,493,851 | 2.648 | 2.570 | 30.393 | see bound receipt |
| 540p | 4,386,076 | 3.324 | 3.253 | 30.284 | see bound receipt |
| 720p | 7,598,950 | 5.759 | 5.659 | 43.168 | see bound receipt |

File rates use 79.168-second outputs and include actual audio/mux; compute rates use the 79.153-second source. Do not add mux twice. Budgets/audio remain the approved settings. Size does not establish perceived quality.912p and the 4K-source decode penalty are unmeasured.

## Corpus extrapolation

The pinned English catalog has 93 source IDs/URLs, not all FIA worldwide and not content-hash deduplication. 85 positive metadata labels total 104.2 minutes; imputing their mean for eight unknowns gives 114.007 minutes.

| Outputs | Gross encode-resource proxy / 114.01 min | Output GB | Gross R2/month |
|---|---:|---:|---:|
| 480 / 540 / 720 | $1.000 | 1.337 | $0.0201 |
| 320 / 480 / 720 | $0.881 | 1.116 | $0.0167 |
| 320 / 480 / 540 / 720 | $1.173 | 1.495 | $0.0224 |

These use full 4-CPU allocation during measured encode wall time plus provisioned memory/disk, then extrapolate one source across the catalog. Actual CPU utilization and corpus runtimes are unknown. Startup, source transfer, storage work, idle tails, Worker/DO operations, originals and old outputs are additional. R2 uses the earlier dated $0.015/GB-month rate; allowances/invoice rounding excluded.

## Container and Durable Object overhead

Standard-4 memory/disk idle allocation is 12 GiB×$0.0000025  + 20 GB×$0.00000007 = $0.0000314/second; a ten-minute tail is $0.01884 before CPU and shared allowances. CPU is billed for actual use, not an assumption that all four cores remain busy. [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)

Paid SQLite DO storage includes 50 million written rows/month, then $1/million; requests include 1 million/month, then $0.15/million. Duration includes 400,000 GB-s/month, then $12.50/millionGB-s. Allocated 128 MB = .128 GB implies a gross $0.0000016 per active second. Monthly excess is rounded up to billable units; per-job allocations are not literal invoices. Each setAlarm is a written row and alarm invocations are requests. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

Current AudioContainer sleepAfter is 10m. The application has no direct DO storage writes for video content; the SDK performs lifecycle/alarm work whose actual row/request count is unmeasured. Its active alarm/lifecycle loop prevents assuming zero DO duration. One continuously active 600-second DO allocation would add $0.00096 gross duration, before requests/writes and allowances; this is a scenario, not measured billing. Duration is shared among simultaneous requests on one object, so do not multiply that interval by overlapping clients.

Machine-readable rows, source receipts/hashes, rates and 104.2/114.01/1,000-minute scenarios: [current model](evidence/fia-video-cost-four-current-2026-10-05/model.json). No additional quality gate or infrastructure change is proposed.
