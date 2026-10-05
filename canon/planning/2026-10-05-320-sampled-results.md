# Sampled 320p results and review limits

2026-10-05. Follow the user’s sampling-first policy: inspect representative excerpts before spending time on a complete encode or a profile matrix. The authorized single 320p sample is measured; this document does not publish a fourth production target or approve the omitted scenes.

## Actual measurement

[Manual run 37332044552](https://github.com/klappy/transcode-mcp/actions/runs/37332044552), artifact 11353709824, contains the retained-source comparison. Receipt SHA256 `6347bc1bdd5530636d61515ff8c87dfad4f0bc93877e98818169ff0a551fadd4`; output SHA256 `4c1fe0109b8b2e1c6c2bd539bd7c50a0cdfb5b8144494846812e171dc49bc342`.

The sample is 938,862 bytes and 39.6 seconds. Actual video payload is 674,947 bytes, audio 213,927 bytes, and mux 49,988 bytes. Measured video average 136,352.93 bits/s is 2.264% above the requested 133,334 bits/s, within the existing 5% measurement gate. Pass 1 took 7.772 seconds, pass 2 took 10.070 seconds, and combined encoder elapsed time was 17.847 seconds. These are actual CI timings, not Cloudflare latency or a promise of linear full-video encode time.

Independent retained-file decode produced 1,980 video frames at 50 fps, coded 576 × 320 with explicit SAR 80:81 / DAR 16:9; audio contained 1,900,800 samples at 48 kHz mono. Native Chrome reported intrinsic dimensions of 576 × 324, which reconcile to 16:9 independently of the CSS player box. Full source identity remains `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718`, 49,851,846 bytes, 79.153 seconds.

The three original intervals 5–18.2, 35–48.2, and 65–78.2 seconds map to local 0–13.2, 13.2–26.4, and 26.4–39.6 seconds. Comparing the 938,862-byte sample directly with the full 79.2-second compact file would misstate savings. No full-file size is claimed from this sample.

## Independent still and geometry review

Nine decoded PNGs compare original 10/40/70 seconds with candidate local 5/18.2/31.4 seconds at the same 854 × 480 containment size. Actual callback mediaTime matched those exact requested times. Browser comparison receipt SHA256 `0bd76c630bb1a3873bb0f707dd698f756cbb68103da603f17586c26232243d79` binds the captures. The original 400 × 224 compact reference retains its own aspect; it was not stretched to manufacture equality.

At 10 seconds the candidate preserves more distinct tree trunks and palm/frond edges than the compact reference. At 40 seconds reeds, branch edges and the bank are better separated. At 70 seconds dense palm foliage remains more legible than the compact file but visibly loses fine structure and has blocky/smeared areas relative to the 720p source. Across all three scenes the river, trees and bank occupy corresponding positions without visible cropping or stretching. This is a scoped still-detail/geometry observation, not lossless equivalence or universal perceptual acceptance.

Still images cannot establish temporal stability, distracting motion artifacts, audio quality or A/V synchronization. These properties were not established by the still review; the user subsequently accepted the baseline without requiring another quality experiment. Omitted source intervals are unassessed; synthetic sample joins are not evidence about original scene-cut behavior. Desktop playback is not a physical-phone test.

## Useful playback comparison

The original decoded comparison page has independent native players, not synchronized playback. A separate private motion page adds three window choices, shared Play/Pause/Reset, mapped reference/candidate starts, boundary stop and only one audible selected track. It reports clock drift rather than claiming frame lock. This is a review aid, not a deployed service or a quality verdict. Preserve the original receipt/index unchanged; subsequent motion/listening findings must be separately recorded.

## User decision: ship the accepted baseline

The user accepts the +50% video-budget baseline and ends this quality experiment workstream. Proceed with the existing dependency release train; no additional motion or acoustic acceptance gate is required. This is the user’s product decision, not a claim that measurement proved all motion artifacts cured or established universal listening quality.

Keep the existing closed profiles, aligned geometry, 50 fps and retained audio settings. No further tuning encodes, codec or cadence sweeps are part of this decision. Reopen tuning only when a concrete use case demands it. Required source/output identity, mechanical integrity and sequential deployment verification remain in place; they must not be turned into another quality-tuning exercise.
