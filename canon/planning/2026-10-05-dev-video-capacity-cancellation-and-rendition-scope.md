---
status: draft
---

# DEV video remediation and initial rendition scope

This cookbook-first combined proposal records three bounded decisions for independent review before implementation: user-selected DEV standard-4 capacity; documented incoming request-signal support; and480/720-only rendition scope. Runtime/configuration changes are not included in this documentation commit. Root is the sole publisher and release executor. The two DEV configuration changes may share one reviewed rollout, but capacity and cancellation require separate actual evidence. Staging/production remain unchanged. Automation stays paused.

Proposed implementation paths: only `wrangler.toml` for the two DEV overrides, plus focused configuration regression checks if needed. No encoder, media identity, audio recipe, DO class, migration, pool size or sleep-policy change. The rendition scope is a documentation constraint and does not itself authorize a new encode or app option.

## DEV video container capacity qualification

Status: private cookbook-first proposal, no infrastructure/configuration change performed. Preserve existing audio+video architecture and sequential DEV→staging→production gates. Latest explicit user choice: test `standard-4` (4vCPU,12GiB) in DEV. This supersedes the earlier1vCPU proposal; it is **not yet proven adequate or the cheapest adequate instance**. The lowest adequate size cannot be inferred from the failed current run or CI wall time alone.

### Observed incident and code

Root's actual Containers application read reports0.0625vCPU/256MiB for the existing DEV application (`a03a549e…`), matching documented `lite`. Stablev18 job3f5cfd56 began03:52:11UTC. Client abort occurred03:52:48; pass1 nevertheless timed out after305026ms at03:57:16, with cleanup at305425ms. No cancellation-observed event was recorded. This establishes a deadline failure and no observed cancellation propagation in that request; it does not identify the exact broken boundary or prove CPU alone caused the timeout. Preserve the job/log receipt as incident evidence.

Current `wrangler.toml` has no explicit `instance_type` in `[[env.development.containers]]`; it names `AudioContainerDevelopment`, image`./container/Dockerfile`, max_instances5. `src/worker.ts` uses the shared audio/video class with `sleepAfter="10m"` and a five-member pool. Capacity change therefore affects every active DEV instance of this shared application, including audio cost/capacity, even though audio recipes/routing remain unchanged.

Actual CI two-pass wall times56–73seconds are successful Linux measurements, **not Cloudflare performance measurements**. CPU allocation, frequency, scheduler, memory pressure and cold-start/source-transfer costs differ. Neither proportional speedup from1/16CPU nor a conversion of CI wall time to CPU-seconds is justified without measured utilization.256MiB also offers little headroom relative to a video process, but no OOM evidence was supplied; do not claim an OOM diagnosis.

### Documented choices and selection rationale

Cloudflare's current [instance-type limits](https://developers.cloudflare.com/containers/platform/limits/) list:

| Type | vCPU | Memory | Disk |
|---|---:|---:|---:|
| lite |0.0625 |256MiB |2GB |
| basic |0.25 |1GiB |4GB |
| standard-1 |0.5 |4GiB |8GB |
| standard-2 |1 |6GiB |12GB |
| standard-3 |2 |8GiB |16GB |
| standard-4 |4 |12GiB |20GB |

`dev`/`standard` are legacy aliases for lite/standard-1. Custom sizing starts at1vCPU with minimum3GiB perCPU, but a custom profile is outside this smallest existing-type change. For default scheduling, Wrangler's `instance_type` controls allocation; verify actual scheduling policy before applying it. [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Cloudflare scheduling policies](https://developers.cloudflare.com/containers/configuration/scheduling-policy/).

The user's latest choice is standard-4. The decision objective is lower user wait at worthwhile total cost, not minimum CPU allocation or a requirement for linear scaling. The user reports previously finding16FFmpeg threads worthwhile despite nonlinear speedup; that is operational context, not a measurement of this deployment. Test whether additional CPU parallelism reduces elapsed time without proportionally increasing active CPU-seconds. Existing encoder code has no explicit thread cap and retained CI x264 settings used6threads; no encoder/thread-setting change is proposed for this capacity test. That is a sound hypothesis under actual-CPU billing, not a guarantee of linear speedup. The smaller predefined profiles remain comparisons, not alternative deployments authorized by this document. This experiment does not establish the lowest adequate instance; after actual throughput/resource/cost evidence, later right-sizing can be separately reviewed. If standard-4 fails, stop and investigate telemetry; do not extend the encode deadline or create a new service.

### Marginal cost estimate, not a bill or latency forecast

Cloudflare currently bills active CPU usage at$0.000020/vCPU-second, provisioned memory at$0.0000025/GiB-second and disk at$0.00000007/GB-second, in10ms increments. Paid-plan allowances are shared account usage, not a per-job entitlement. Worker/DO/logs/egress charges are separate. Charges continue while the container is awake; CPU charge depends on actual utilization. [Official Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/).

The following is our calculation assuming full allocatedCPU use for the stated wall time, excluding allowances and other services. The56–73s columns simply price the **CI-duration scenario**; they do not predict Cloudflare completion time.300s is the encode-phase deadline, not the complete job ceiling: the outer job deadline is600s, including source acquisition and other work. Idle tail assumes zeroCPU for the existing600-second sleep timeout; real backgroundCPU/startup/source/cleanup adds cost.

| Type |56s busy |73s busy |300s busy |600s idle memory+disk |
|---|---:|---:|---:|---:|
| lite |$0.0001128 |$0.0001471 |$0.0006045 |$0.000459 |
| basic |$0.0004357 |$0.0005679 |$0.002334 |$0.001668 |
| standard-1 |$0.0011514 |$0.0015009 |$0.006168 |$0.006336 |
| standard-2 |$0.0020070 |$0.0026163 |$0.010752 |$0.009504 |
| standard-3 |$0.0034227 |$0.0044618 |$0.018336 |$0.012672 |
| standard-4 |$0.0062384 |$0.0081322 |$0.033420 |$0.018840 |

Formula: `busyCost = seconds × (vCPU×0.000020 + GiB×0.0000025 + GB×0.00000007)`; idle excludesCPU term. For standard-4,56–73seconds at saturatedCPU plus the existing600second idle tail models$0.02508–$0.02697;300seconds of saturated encode-phase scenario plus tail is$0.05226. A600second saturated outer-job scenario plus tail is$0.08568. These are duration scenarios, not measured billing; startup/source/cleanup and tail resets change actual costs. Crucially, equal work need not cost four times as much CPU: idealized60CPU-seconds could run as1CPU×60seconds or4CPU×15seconds, both$0.0012 CPU. Linear speedup is not assumed: serial work, CPU frequency, I/O, scheduling and memory affect both time and CPU-seconds. Provisioned memory/disk and the unchanged10minute idle tail remain additional costs, so actual whole-job economics must be measured. Multiple requests can amortize a shared tail, or keep instances awake longer. Five awake instances can multiply provisioned resource costs; max_instances5 is not five continuously charged instances. No concurrency increase or sleep-policy change is proposed. Actual usage measurements supersede these estimates.

### Exact proposed DEV-only change and gates

After independent cookbook/server-canon acceptance, change only this existing block in `wrangler.toml`:

```toml
[[env.development.containers]]
class_name = "AudioContainerDevelopment"
image = "./container/Dockerfile"
max_instances = 5
instance_type = "standard-4"
```

No top-level, staging, production, pool, migration, bucket, source allowlist, encoding, timeout, audio recipe or image processing changes. Do not introduce a new service or container class. Root alone publishes/deploys the reviewed config through the existing DEV full-deploy path.

A completed Wrangler command or Worker response is insufficient: Cloudflare notes that deployment starts a container rollout and may return before every instance has changed. [Official deployment guide](https://developers.cloudflare.com/containers/guides/deploy/). Gate the probe on actual application configuration showing the accepted size/image, rollout completion/stability, healthy target-version instances, and absence of an old-version active job. Bind Worker commit/version, container application/version, image digest and actual reported resources in the receipt. Do not infer a stable container from only the Worker commit or preview URL.

Once stable, one bounded actual a13 MISS qualification may run with a caller deadline long enough to observe the unchanged backend300second encode limit plus known source/cleanup bounds. Do not abort the main completion probe at37seconds and call that a capacity test. Use existing exactsource/recipe and actual encoder identity; no URL cache-busting or fabricated source identity. If canonical cache already exists, a HIT does not test encoding: declare that limitation and obtain an approved controlled MISS through existing qualification mechanics, without deleting shared objects casually.

Capture source verification, pass1/pass2 start/exit timestamps, actual resource metrics if available, output bytes/hash/codec/duration, canonical publication only after verification, cleanup and R2HIT/range checks. Require full encode within the existing300000ms contract, no partial readiness, exact output qualification and stable-version identity. Keep audio path regression evidence: an existing approved audio request and cached behavior still work, with unchanged recipe/source/output identity semantics; do not generate new speech.

Cancellation is a separate blocking release gate: the observed clientabort failed to produce a backend cancellation event. A larger instance must not be presented as its fix. After the cancellation boundary is repaired/qualified in its own reviewed slice, a bounded actual in-flight cancel must show observed propagation, process termination, cleanup, and no canonical publication. This proposal does not authorize speculative cancellation code or new cancellation endpoints.

No staging/production promotion until DEV capacity, integrity, audio compatibility and cancellation gates pass independently. Later tier capacity changes require explicit same-setting qualification and stable rollout evidence in sequence. Rollback restores this DEV block to its prior configuration and verifies the prior stable application; it preserves accepted cached media and records that video capacity remains unqualified. Automation remains paused.

## Incoming cancellation: bounded diagnosis and proposed first repair

Status: cookbook proposal only. No runtime/configuration changes or repeat requests performed by this author. Root owns the stable development execution window; no publication or rollout during an active qualification job.

### Observed failure and limits

Root's stable version18 job3f5cfd56 began03:52:11, reported actual positive-frame progress at5.157seconds, and the client aborted03:52:48. No cancellation-observed event followed. Pass1 exited with cancel at305026ms and cleanup at305425ms, consistent with the existing300-second encode deadline rather than client disconnect. Container version remained18 with no rollout. Empty R2 establishes no published result; it does not establish prompt cancellation. This is a concrete failed cancellation observation in this topology, not proof that Cloudflare cancellation is universally unsupported. The earlier SIG143 rollout-interrupted attempt remains inconclusive and separate.

### Local seam and documented missing capability

`wrangler.toml` has compatibility_date2025-05-01 and only nodejs_compat. The Worker in `src/lib/video.ts` already combines request.signal with its job deadline and passes the resulting signal into both container information and transcode fetches. Installed @cloudflare/containers0.3.5 `dist/lib/container.js` forwards the request signal during startAndWaitForPorts and passes the Request to tcpPort.fetch. The Node handler aborts its controller on premature response close; its encoder waits for process termination and cleanup. No explicit signal discard was identified in these inspected seams; actual propagation still requires platform evidence.

Cloudflare documents incoming client-disconnect notification as requiring the enable_request_signal compatibility flag. This is a specific missing configuration prerequisite and the smallest first repair hypothesis, not sufficient evidence that every downstream hop will then cancel correctly. [Official Request API](https://developers.cloudflare.com/workers/runtime-apis/request/) and [May22 cancellation announcement](https://developers.cloudflare.com/changelog/post/2025-05-22-handle-request-cancellation/).

### Proposed cookbook-first change

Set only the existing `[env.development]` override to `compatibility_flags = ["nodejs_compat", "enable_request_signal"]`, retaining compatibility_date2025-05-01 and all audio/image/video contracts. Do not change top-level, staging, or production flags. Reuse current container cancellation-observed, encode-exited and cleanup-complete phase events; no new instrumentation or operation registry is required for this first repair. Root's retained server evidence is `cold-cancel-stable-v18/server-evidence.json`. No new service, public cancel endpoint, automatic retries, or longer encode deadline. This may share one development release with the independently accepted resource-capacity correction while keeping each change's acceptance evidence distinct.

Before execution: retain existing merged-signal/cancellation regression checks and verify the deployed development flags and exact build. After all rollouts settle, make one bounded cold request to the approved source, observe positive-frame progress, abort the client, and correlate the recorded client abort with existing container cancellation-observed, termination and cleanup. Require observed completion within10seconds of the recorded abort as the proposed prompt-cancel acceptance bound, distinctly before the300-second encode deadline. Verify no pending/canonical R2 publication and no residual running job. Record clock uncertainty and actual elapsed values; a missing event or deadline-only exit is HOLD, not success. The resource-capacity proposal is separate and must not disguise cancellation evidence.

If this documented flag is verified active but downstream cancellation still fails, retain this evidence and stop before implementing a different mechanism. The next narrowly reviewed option is an internal, bounded active-operation cancellation command to the same selected container: exact unpredictable operation token, compare-and-cancel current owner atomically, idempotent acknowledgement, no cancellation of a later reused slot, no public unauthenticated surface, no whole-container kill. That option is not yet selected or authorized by this document's existence; prepare its cookbook contract only if measured propagation failure establishes the need. Existing user authorization permits continuing the bounded repair workflow without a new permission question.

Reversal: revert the development-only compatibility override if it regresses existing behavior; preserve failure/success evidence. No staging/production promotion or app availability follows until actual development cancellation and the existing success/cache/range/browser gates pass.

## Rendition ROI decision

Status: user-directed scope correction, 2026-10-05. Documentation only; no runtime, application, encoding, or deployment changes. This decision supersedes the active 540p and lower-rate 720p experiment branches in the natural-budget/frame-rate proposal. Preserve their historical documents, receipts, outputs, and rejected or unqualified results unchanged.

The initial scope is **480p and 720p only**. 540p adds another rendition, encode/storage cost, compatibility matrix, and quality-review burden without enough expected benefit to justify that complexity. Do not introduce a replacement intermediate ladder or additional presets.

- **720p:** retain the current full source frame rate (50 fps for the verified sources) and nominal 450 kbps video class. The completed corrected25fps comparison remains diagnostic evidence only: actual output5,470,751bytes versus retained50fps5,509,355bytes (0.700699%smaller), with matched video-payload gap0.0196176%of nominal. It does not authorize selecting 25 fps, a lower-rate 720p follow-up, or changing the current delivery recipe. Cancel planned lower-rate 720p encodes.
- **480p:** retain the proposed nominal 200 kbps video budget as an experimental application of the two-rungs-down policy, not an established production-quality threshold or a newly proven historical ladder. Start from the full-frame-rate 50 fps baseline for these sources. Compare 25 fps only within a separately bounded controlled experiment, and select it only if measured quality and size benefit justify the motion tradeoff. Frame-rate sacrifice is principally worth investigating at 480p or below; this does not authorize new below-480 renditions.

The 480p/200 kbps and 720p/450 kbps pair remains the proposed two-rung budget interpretation. The 200 kbps value remains the previously disclosed provisional interpolation, B240 = 450 × (240/360)²; it is not a historical numeric ladder. Do not claim the budgets prove acceptable quality or infer that halving frame rate halves file size. Existing matched-budget and GOP evidence remains useful within its actual source and measurement scope.

Qualify proportional audio bitrate and mono/stereo decisions separately, using original source content and the accepted audio experiment contract. Keep audio identical during video/frame-rate comparisons. A smaller rendition is not permission to discard meaningful stereo, music, ambience, or intelligibility. Combine independently accepted video and audio settings only after final size, synchronization, decode, seek, and target playback checks.

Opportunity cost is part of acceptance: each additional rendition or experiment consumes encoder time, storage, cache variants, download selection complexity, and recurring testing and review effort. Prefer the smallest supported set whose measured benefit warrants those costs. No automatic scaling logic, new application options, production defaults, or additional encodes follow merely from this document. Continue bounded preparation and independent review under the existing authorization; this scope correction creates no new user-permission gate.

