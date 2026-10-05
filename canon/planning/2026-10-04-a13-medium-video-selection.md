# Proposed a13 medium video recipe — 480-line viewing scope

Status: doc-only proposal for independent review. No runtime preset or deployment change yet. The accepted correction and matched-budget recipes remain authoritative; this is one source-specific qualification, not a universal ladder or bandwidth policy.

## Actual evidence and judgment

The corrected A-only experiment preserved B/C byte identities and passed both actual matched-budget comparisons. Decoded-frame browser receipt SHA256 4f4c0503eeeb2236fb5f31b7bf3e56cf53e8a25446697ef616b871c14f82772a binds the retained source/A/B/C files, actual advancing playback, six seeks per file, and 28 time-qualified canvas captures. At40seconds, continuous playback captured39.98 and seek captured40.00; scene composition agrees within that one-frame difference. The older compositor screenshots are unsuitable for exact-frame comparison and remain diagnostic evidence. The mechanism behind their stale composition is not established by these results.

Author inspection of source/A/B/C decoded captures at10/40/70seconds in the854×480 player finds B retains more branch/foliage structure than the matched-budget360-line A, particularly at10 and40seconds. C is softer than B, with visible smoothing and occasional block artifacts, but preserves the river, banks, trees and contextual scene at this viewing size. For this illustrative a13 resource at480-line viewing, C is an acceptable medium-quality tradeoff in the inspected samples. This is not a lossless claim, textual-detail use case, full motion/acoustic review, or evidence that higher resolution always wins.

At1280×720 viewing, C's foliage loss is obvious; do not market this450kbps class as high-quality720 playback. The existing one-step-above-fit policy can use its encoded720 canvas for480 viewing, but no unmeasured higher rung or live bandwidth adaptation is introduced.

C's six desktop retained-file seeks completed with maximum278.1ms, versus B22.8ms. Both met the existing15second test deadline. These are local Chrome measurements, not network, physical iPhone or native-fullscreen results. The observed scene cut is the end transition to black; it does not qualify general multi-scene cut detection. No independent B-versus-C motion-quality preference is claimed from stills alone.

## Proposed smallest selection and implementation

Select the already measured C settings as the initial source-specific `fia/medium/mp4` candidate: same verified a13 1280×720 source, libx264 medium/yuv420p at original50fps, two-pass requested439024bits/s, nominal450000-bit/s class, VBV900k/buffer1800k, keyint1500/min-keyint1/scenecut60, AAC96k stereo and faststart MP4. Preserve real installed encoder/build identity and current source/provenance binding. This produces the measured retained C artifact5,508,564bytes SHA256 b1e7981d4c5960c0bdb2f8130d25de2fbd970e8486709e9fff05bb7160210372, about9.05× smaller than the49,851,846byte verified source. Do not promise that ratio for other sources.

Implement using the existing container/Worker/R2 path: two-pass statistics job-local, same settings in both passes, no new service or provider. Preserve source/output60MiB bounds, combined five-minute encode deadline,32MiB per stats file/64MiB active stats, cancellation and cleanup, duration/codec validation, finalized-file byte/hash verification, quarantined publication, and actual revision-bound cache identity. No fake minimum bitrate or unsupported scene-window setting. Update recipe revision and tests rather than relabel the old CRF output as optimized.

Before merging a selected runtime recipe, independently review these exact decoded captures and run the actual container implementation once against the retained source, checking applied settings, bytes, duration and source/output identity. It may differ in bytes if orchestration changes: validate rather than assert preexisting output identity. Then require the already agreed actual development Worker/R2 MISS/HIT/range/cancellation and browser playback proof before sequential staging/production. Native iPhone fullscreen remains a separate unresolved client behavior, not solved by encoding.

This selects an initial bounded medium candidate under existing authorization; it does not open a new user permission gate. Any broader source coverage, higher quality class or adaptive rendition ladder requires its own measured extension. Existing evidence and failed attempts remain immutable.
