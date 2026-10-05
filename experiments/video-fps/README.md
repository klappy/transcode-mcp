# Private720p frame-rate experiment

Accepted recipe: bb2edd892d04a9c21d5f43c06c932bc50d188c5a. This implements only the first720p25fps/439024bit/s comparison. No lower-rate or480/540job is included. Production runtime, contract, Dockerfile and existing CI paths are untouched.

The manual workflow downloads exact retained artifact11324160558 from run37258408345. Receipt SHA, source SHA/bytes and baseline SHA/bytes are verified before use. Encoder identity must match exactly to reuse50fps bytes; otherwise one matched50fps control is generated. New25fps adds only explicit fps dropping and changes GOP1500→750. AAC remains96k; actual payload SHA/sample count/duration must match for a controlled result.

Root dispatch, only after exact independent review and remote publication:

`gh workflow run video-fps-experiment.yml --repo klappy/transcode-mcp --ref feat/fia-video-fps-experiment`

GitHub may require this workflow to exist on the default branch before dispatch; if so root merges the independently reviewed experiment-only files first and dispatches that exact ref. No encoding triggers on PR or push. Do not use the ordinary video workflow to run this experiment.

The experiment container has networking disabled. The image build can retrieve normal Debian dependencies; actual ffmpeg executable/library identity is measured, never assumed identical. The experiment30-minute clock begins with the script; image preparation is outside that clock and the overall workflow is bounded35minutes. Each complete encode+measurement job is limited300seconds; no start without330seconds remaining. Source/output60MiB, passlogs32MiBperfile/64MiBtotal, aggregate768MiB with preflightreservation and active monitoring. Linux process file-size limits complement monitoring. Files preserve source/output identities and pass args/logs; receipt does not claim visual/motion/browser acceptance.

Run `node --test experiments/video-fps/policy.test.mjs` for non-encoding tests. After actual CI, independently review output bytes, measured frame cadence, matched-pairrate≤1%nominal and identicalAAC. Browser decoded still/motion/seek review remains necessary. A rate-unmatched result stays diagnostic; no automatic correction or retry.
