# FIA video cost and rendition decision model

As of 5 October 2026. No media was downloaded or encoded for this estimate. Amounts are USD, one environment and one retained output per source/profile, before shared allowances and invoice rounding.

## Inventory and coverage

The complete 19 English metadata files at [VideoBibleDictionary revision 1c02713](https://github.com/BibleAquifer/VideoBibleDictionary/tree/1c02713d022bd96a29c78f5b75455315d6d35a6e/eng/json) contain **93 unique asset IDs and 93 unique published MP4 URLs**. Root verified every downloaded JSON against its Git blob. Of these, 85 have positive, rounded duration labels totaling **6,252 seconds / 104.2 minutes**. Eight have a zero label: a2218, a2219, a2220, a2297, a2376, a2377, a2378 and a2119. Treat these as unknown, not zero-length. Let their combined actual duration be U minutes.

The local 136 Mark packs contain 172 video placements but only 52 distinct asset IDs; all are in that catalog. Their 49 positive labels total 62.72 minutes, with three unknown durations. Repeated placements and language copies do not each require encoding. This census establishes the pinned English published catalog; it does not establish that every FIA project or other-language source is included. Unacquired media cannot be deduplicated by content SHA, so the current count is source-ID/URL deduplication. Some IDs may contain identical bytes.

## Current prices and resource formula

Cloudflare bills active CPU usage at $0.000020/vCPU-second, provisioned memory at $0.0000025/GiB-second and disk at $0.00000007/GB-second. The deployed standard-4 allocation is 4 vCPU, 12 GiB and 20 GB. Pricing is metered at 10 ms; sleeping stops these resource charges. Workers Paid includes shared CPU, memory and disk allowances. [Official Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)

For measured awake seconds A and actual active CPU-seconds C:

`container cost = 0.000020 × C + 0.0000314 × A`

At full four-core usage this is **$0.0001114/second, $0.006684/minute**. Near-zero CPU idle still costs $0.001884/minute in provisioned memory/disk; one ten-minute idle tail costs about $0.01884 per container. Five available slots are not five permanently running instances. Source transfer, startup, storage work and idle tails extend awake time beyond encoding. The modeled compute below applies full-core billing to observed encode wall time; it is a ceiling for that supplied wall time, not a bound on unknown future runtimes.

R2 Standard storage costs $0.015/GB-month; Class A operations $4.50/million and Class B $0.36/million. Internet egress is free, including reads through Workers. Shared allowances are 10 GB-month, one million A and ten million B operations; billable quantities are rounded, so fractional marginal costs are not literal invoice increments. [Official R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Workers Paid has a $5 monthly minimum, shared included usage and usage-based request/CPU charges. DO requests and active duration also have shared allowances and overage rates. Existing subscriptions should not be counted anew per video. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

## Per-profile variables

All four use H.264, 50 fps and the currently accepted video budgets. Audio is unchanged. Nominal output estimates below include video and audio, then a separate assumed 5% mux allowance in aggregate tables. The assumption is not a guarantee, particularly for very short files.

| Profile | Coded raster | Video / audio kbps | Audio | Nominal MB/min before mux | Timing anchor: encode / source seconds | Evidence limitation |
|---|---|---:|---|---:|---|---|
| 320 | 576×320 | 133.334 / 42.667 | Mono | 1.320 | 17.847 / 39.6 | Current sampled Linux CI; different hardware from CF |
| 480 | 864×480 | 300 / 42.667 | Mono | 2.570 | 62.614 / 79.153 | Current +50% DEV result, 3,556,277 bytes; first HTTP 75.442 s |
| 540 | 960×544 | 379.688 / 54 | Stereo | 3.253 | 36.326 / 79.153 | Historical lower-budget CF timing proxy |
| 720 | 1280×720 | 658.536 / 96 | Stereo | 5.659 | 53.409 / 79.153 | Historical lower-budget CF timing proxy |

Raster/SAR contracts preserve intended display aspect. Dimensions alone do not score visual quality. Encoding time is not cached playback latency or time to first frame. New 540/720 measurements should replace these proxy times when available.

## Worked costs

| Outputs retained | Encode-resource proxy, 104.2 known minutes | Outputs incl. assumed mux | Gross R2/month | Encode-resource proxy per 1,000 minutes | R2/month per 1,000 minutes |
|---|---:|---:|---:|---:|---:|
| 480 / 540 / 720 | $1.34 | 1.26 GB | $0.0188 | $12.86 | $0.1808 |
| 320 / 480 / 720 | $1.33 | 1.04 GB | $0.0157 | $12.81 | $0.1504 |
| 320 / 480 / 540 / 720 | $1.65 | 1.40 GB | $0.0210 | $15.88 | $0.2016 |

For all four, the known catalog plus missing duration is approximately **$0.015877 × (104.2 + U)** encoding resources and **$0.00020163 × (104.2 + U) per month** for outputs. A deliberately broad half-to-double runtime sensitivity gives $0.83–$3.31 for the known-duration portion; this is scenario sensitivity, not a confidence interval or hard bound. Full-catalog runtime has not been measured.

Add actual cold/start/IO/idle resource usage, Worker/DO/log operations, any applicable container transfer, retained originals and historical outputs. For example 372 outputs (93×4), with two Class A writes each, have $0.00335 fractional marginal A cost before allowances/rounding; actual quarantine/copy/delete/read workflows determine the operation count. R2 delivery egress is free, while container regional egress has a separate pricing schedule and must only be applied where that transfer is actually billable. Qualifying three environments can multiply work/storage; production-only estimates do not cover all deployment proofs.

The extra 320 tier above existing three costs roughly $0.31 encoding proxy and $0.00217/month storage for the known 104.2 minutes. The extra 540 above 320/480/720 costs about $0.32 and $0.00534/month. At this scale, product clarity, useful quality separation and maintenance likely outweigh resource dollars; that is an inference, not a measured user preference.

## Deterministic proposed rubric: three versus four

This is a decision procedure, not invented perceptual scoring or a new release gate on the already accepted baseline.

1. Eligibility: fixed source/rights identity, correct codec/aspect/audio, playback/seek/offline behavior and qualified bytes must pass. A profile lacking evidence is unavailable, not assigned a low quality score.
2. Record user quality scores Q from 0–5 at the same player size and representative motion. Until supplied, Q is null. Never substitute bitrate or pixel count for Q.
3. Remove a profile only when another is no worse in observed Q, bytes and encode time, and strictly better in at least one. Unknown Q prevents declaring dominance.
4. Proposed separation threshold: each retained adjacent tier should provide at least 20% smaller files at accepted quality, or at least one Q point of useful improvement. These thresholds are explicit policy proposals, not existing user-approved standards.
5. Keep a fourth tier only if it satisfies a distinct user need, survives the above checks and fits the chosen cost/complexity cap. Otherwise choose the three covering those needs. 320/480/720 favors a low-bandwidth option; 480/540/720 retains a middle compromise. Neither is automatically superior from this cost model.

With quality utility and segment demand still unscored, the deterministic result is **undetermined; retain the current approved three in the release, and use the requested 320 evidence for a later explicit product choice**. No further encoding or perceptual experiment is implied by this report.

Machine-readable inputs and computed scenarios: [model](evidence/fia-video-cost-2026-10-05/model.json). Compact source-ID/URL/duration evidence: [inventory summary](evidence/fia-video-cost-2026-10-05/inventory-summary.json). Raw metadata remains upstream at the pinned revision; it is not duplicated here.

## All 93 planning scenario (eight durations imputed)

Assigning the mean duration of the 85 labeled videos to the eight unknowns gives **114.01 minutes**. This is an imputation, not a measured total.

| Profile | Video + audio Mbps | MB/min with 5% mux | Encode sec/source min proxy | Compute/all 93 proxy | Storage/all 93 | R2/month | Channels | Quality |
|---|---:|---:|---:|---:|---:|---:|---|---|
| 320 | 0.133334 + 0.042667 | 1.386 | 27.04 | $0.343 | 0.158 GB | $0.0024 | Mono | Unscored |
| 480 | 0.300000 + 0.042667 | 2.699 | 47.46 | $0.603 | 0.308 GB | $0.0046 | Mono | Unscored |
| 540 | 0.379688 + 0.054000 | 3.415 | 27.54 | $0.350 | 0.389 GB | $0.0058 | Stereo | Unscored |
| 720 | 0.658536 + 0.096000 | 5.942 | 40.49 | $0.514 | 0.677 GB | $0.0102 | Stereo | Unscored |

All four: **$1.81 encode-resource proxy**, 1.53 GB outputs, $0.0230/month gross storage. Half-to-double runtime sensitivity is **$0.91–$3.62**. A **$5 planning allowance for one batch** leaves about $1.38 above the double-runtime case for modest startup/idle/operation overhead. It is not a guaranteed cap or invoice quote: retries, prolonged idle, source transfer, multiple environments and heavier source content can exceed it. Account subscriptions and shared allowances remain separate.

For a provisional three-tier planning comparison, 320/480/720 costs nearly the same compute as 480/540/720 but stores less and adds a low-bandwidth endpoint. That is a cost/coverage hypothesis, not proof of equivalent quality; the rubric must decide whether the 540 compromise or 320 endpoint serves users better.

## Latest policy caveat

The user now caps current video at a clean divisor no greater than 30 fps (50→25,60→30; ≤30 preserved). The timing and size proxies above were not measured with that cap or the newly proposed larger encoded canvases. They remain historical planning scenarios, not a measured quote for the revised policy. No proportional time/size saving is assumed.
