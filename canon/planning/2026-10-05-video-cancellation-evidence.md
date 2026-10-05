# Minimal correlated video cancellation evidence

Status: proposed doc-only amendment. Existing container/Worker/R2 architecture, media behavior and deadlines remain unchanged. No instrumentation code or deployment is authorized by this draft alone; exact independent review precedes code. Existing user authorization covers the bounded work.

The current service does not expose a reliable video encode phase. An elapsed-time abort and empty R2 listing cannot establish that encoding began, nor that a child process stopped. Production cancellation acceptance must not infer either from timing.

## Existing log path and bounded enablement

Root's actual dry telemetry queries succeeded but returned no startup events; the current Worker configuration contains no observability setting. Official Cloudflare documentation states container stdout/stderr is available through Worker observability when observability.enabled=true, with seven-day retention: https://developers.cloudflare.com/containers/faq/ . The correlated Worker/Durable Object log model is documented at https://developers.cloudflare.com/changelog/post/2026-04-21-correlated-worker-durable-object-logs/ . The existing authenticated POST /accounts/{account_id}/workers/observability/telemetry/query path is callable with dry=true, view=events and bounded time/limit.

Enable the existing development Worker's observability alongside the bounded phase events below. No new logging service, public diagnostic endpoint or synthetic timing delay is introduced. Do not require events from a disabled log configuration before making this authorized configuration correction. Review the exact config diff and deployment identity; leave staging/production configuration for the normal subsequent promotion decision. Document that platform request logs can include existing request metadata even though new custom events contain no URLs or sensitive values.

After deployment, retrieve an actual startup or benign request event from the container before spending a cold encode attempt on cancellation. Then retrieve the actual phase events for the controlled request. Save redacted receipts identifying deployment, service/dataset, time range, query method and event identity. If events remain unavailable, report the concrete retrieval failure and hold the cancellation claim; successful API calls or Worker-only request logs are not proof of container phase visibility.

## Minimal correlated events

Emit one bounded JSON line per transition from the existing container console. Fields: schema1, event=fia-video-phase, generated job UUID, assetId=a13, recipe revision, phase, elapsedMs, and optional pass number. No source URLs, input text, tokens, environment variables, raw request bodies or ffmpeg stderr. At most16 lines/job, each at most1KiB. Log errors as fixed classifications only.

Transitions: job-start after accepted source/recipe; source-verified after exact source hash; encode-spawned after the actual ffmpeg child emits spawn, with pass1/2; encode-exited after child close, with success/cancel/failure classification; cancellation-observed when the job signal aborts; cleanup-complete only after child close and successful removal of the job directory. Cleanup failure emits cleanup-failed, never cleanup-complete. A single server-generated UUID correlates these events; logging does not alter process control or expose a new client knob.

Use the existing bounded process helper's optional callbacks for actual spawn/close, not a log immediately before calling spawn. Preserve combined two-pass deadline, SIGKILL on abort, close-before-cleanup ordering and capacity release. Unit tests verify event ordering, bounded safe fields and no success/cleanup claim on failure. Actual Docker evidence verifies correlated events from a real child; platform evidence remains separate.

## Actual development acceptance

Use one authorized cold source-specific request in an otherwise idle bounded test window. Observe its real encode-spawned event before aborting the request; abort while the process is still active, not after completion. Capture cancellation-observed, encode-exited with cancellation, and cleanup-complete for the same job UUID. Check the canonical and pending R2 state using the independently reviewed storage inspection. No canonical output or orphan pending object may remain from the cancelled attempt. Then a separately authorized successful request proves capacity recovery, verified publication and normal playback.

If logging arrives only after completion, if encoding finishes before the abort, or if source acquisition never reaches encode-spawned, label the attempt inconclusive for in-flight encode cancellation. Preserve it and do not silently retry. Account/container sampling or missing events cannot be interpreted as absence of a process. No new source acquisition is performed merely to test this draft.

6B: Borrow existing logging/process controls; Bend only phase visibility; Break elapsed-time inference; Beget correlated evidence; Bide unavailable retrieval; Build the smallest observable transition hooks. Logs cannot be un-emitted, so fields and volume are deliberately bounded; code is reversible, and existing failed evidence is retained.
