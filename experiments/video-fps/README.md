# One private720p25fps rate correction

Accepted correction recipe: c3f2053063b05efb45f3f84fdd3c6bc535df7586. Exactly one444000bit/s two-pass25fps encode, unchanged900k/1800kVBV,750-frameGOP,AAC96k and all other settings. Nominal pair gate remains439024bit/s,≤1%payload difference, identicalAAC. No lower-rate encode,50fps regeneration, audio experiment or production selection.

Manual workflow downloads original source/baseline artifact11324160558 (run37258408345) plus unmatched experiment11323239996 (run37260050319). Pins verify both receipts, source/output SHA/bytes and encoder identity. The correction ratio is rederived from the pinned first measurements and rounded to444000. Exact actual encoder identity must match the retained50fps baseline or execution stops; there is no fallback control. Original artifacts remain read-only.

Root dispatch after independent exact review/publication:

`gh workflow run video-fps-experiment.yml --repo klappy/transcode-mcp --ref feat/fia-fps-rate-correction`

The workflow must exist on the default branch for GitHub dispatch; root resolves publication in the sequential train. No encoding on PR/push. Networking disabled inside the experiment container. Image build is outside the30-minute experiment clock and retains actual ffmpeg/library identity checks. Workflow maximum35minutes; one complete encode+measurement job300seconds,330seconds remaining required before starting; source/output60MiB, passlogs32/64MiB,768MiBaggregate with reservation and monitoring. No automatic retry.

Run `node --test experiments/video-fps/policy.test.mjs`. Actual CI measurement, independent decoded-frame/motion/seek review remain outstanding. A failed match stays diagnostic. Current50fps production default is unchanged.
