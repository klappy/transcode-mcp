# Manual modern-codec strategy comparison

Accepted recipe:9792d4711c82b56c3a12fe86f3d7cc8dbeca2be2, canon/planning/2026-10-05-modern-codec-comparison.md. Two sequential same-runner jobs only: existing H264 two-pass, one HEVC Main8/hvc1 single-pass ABR fast. No production settings, audio strategy, FPS, origin request or fallback codec changes.

Manual workflow downloads pinned retained artifact, builds unchanged image, checks actual libx265 support, then runs network-disabled2CPU/2GiB container.300s per encode+measurement,30minshared/330sstartreserve,60MiBfile,32/64MiBstats,384MiBaggregate; OS/prlimit and disk monitoring. Actual encoder identity checked before each job. Failed/partial evidence remains unqualified, no retries. NormalCI never encodes this experiment.

`node --test experiments/video-codec/policy.test.mjs` runs nonencoding tests. Root alone publishes/dispatches after independent review.

Receipt includes actual applied log evidence, source/build/library/args identity, full decode, sizes/sample payload accounting and same-runner timings. Numerical mismatch remains diagnostic. TTFF and live public seeks are explicitly unmeasured by this encoder job; local decode/encode times cannot explain network seek latency. Independent actual browser first-decoded-frame, motion/seek and rolling-three-year hardware/browser capability proof remain required. H264 fallback stays unchanged.
