# Six video options: measured costs and planning estimates

Version 4, 5 October 2026. All four timing anchors below are actual Cloudflare DEV a 13 results at 25 fps. The [earlier report and model](2026-10-05-fia-video-cost-rubric.md) remain historical;320p is no longer represented by its earlier 50 fps CI proxy. These are observations from separate deployment identities, not a controlled speed experiment. No media was encoded for this calculation.

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


## Six-option planning scope

The comparison now plans for 320, 480, 540, 720, 912 and 1080 to cover phone, tablet and laptop viewing. This is a planning expansion, not a claim that every option is implemented or qualified. The four measured rows above are unchanged. 912 encoding time and output size remain unmeasured; 1080 is not implemented. The [prior four-option report](evidence/fia-video-cost-six-planning-2026-10-05/four-current-report-history.md) and its model remain preserved.

| Option | Evidence | Coded raster / SAR assumption | Video / audio kbps | Nominal MB/min before mux | With assumed 5% mux |
|---|---|---|---:|---:|---:|
| 912p | planning-only-unmeasured | 1616×912 / 304:303 | 658.536 / 96 | 5.659 | 5.942 |
| 1080p | planning-only-not-implemented | 1920×1088 / 136:135 | 1481.706 / 216 | 12.733 | 13.369 |

Both modeled options preserve 16:9 and assume 25 fps/AAC stereo. 912 intentionally has the same bitrate as 720, so its nominal file size is the same; higher raster does not automatically add bytes. 1080 assumes both the 720 video request and AAC bitrate multiplied by 2.25, the displayed-area ratio: 1,481,706bps video and 216,000bps stereo AAC. This keeps the planning audio allocation proportional rather than imposing an unapproved 96k cap. Existing measured audio choices and the required quality floor remain unchanged; no cross-codec quality equivalence is inferred. This is an explicit unapproved planning assumption, not a selected production setting. The illustrative 1920×1088 raster and 136:135 SAR preserve 16:9 with 16-pixel alignment. No approved 1080 source, encoder output, browser proof or timing is claimed.

### Transparent compute scenarios

Let T720 be measured 720 encode seconds per source minute, R the new-to-720 coded pixel ratio, and D additional source-processing seconds per minute. Model T=T720×R^p+D. Low uses p=0,D=0; central p=1,D=15; high p=1.5,D=45. These arbitrary, visible sensitivity parameters are not observed scaling laws, confidence bounds or guaranteed limits. The 4K decoder penalty is unknown. T720 already contains source decoding, so D represents an additional penalty, not a second copy of known decoding. No shared-decode savings are assumed.

| Option | Low seconds/source minute | Central | High |
|---|---:|---:|---:|
| 912p | 32.72 | 67.33 | 111.17 |
| 1080p | 32.72 | 89.17 | 156.67 |

For all 93 imputed 114.007 minutes, retaining all six:

| Scenario | Gross encode-resource allocation | Mixed measured/nominal GB | Gross R2/month |
|---|---:|---:|---:|
| low | $2.004 | 3.697 | $0.0555 |
| central | $3.160 | 3.697 | $0.0555 |
| high | $4.574 | 3.697 | $0.0555 |

These totals combine actual four-profile file-rate extrapolation with nominal 912/1080 sizes and explicit compute scenarios. Retain the overhead, shared-allowance, rounding, unknown-duration and English-catalog limitations above. No new encode, infrastructure or app-choice change follows from this model. [Six-option machine-readable model](evidence/fia-video-cost-six-planning-2026-10-05/model.json).
