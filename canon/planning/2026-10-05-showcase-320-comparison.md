---
title: Current 320p comparison
status: working
date: 2026-10-05
---
# Current 320p comparison

> Add the measured user-requested 320p delivery beside the existing 224p resource, without claiming a perceptual winner.

## Summary

The current DEV 320p file is 1,825,753 bytes (SHA256 `627ac30873371b3c237eead9b582672016da5a3d44c3b420dc0149850bf8003d`), compared with the unchanged 2,547,817-byte compact resource. Show both native players as a pair; retain the 480p/540p pair and source/optimized720p pair. Six options remain visible. No encoder, route, or audio policy changes.

Actual DEV processing took 17.965 seconds (passes7.299/10.663 seconds); the first complete HTTP request took27.058 seconds and cached transfer0.916 seconds. These are distinct measurements, not playback startup promises. Actual R2 encoder revision is `e29c2c9ac5a9493bb324f4c319352f0c6483c5442a97c3bc8c9c6c8dbbcde196`; canonical key is `video-v1/827774d4c3891a7c18974110b082ee4da0b7a18ad7e0587045593925843ba16e.mp4`.

Generate only a matched10-second poster from the retained file, correcting SAR80:81 from576×320 to square-pixel576×324 without cropping. Preserve original224p poster fidelity. Keep allposter bytes under200KB. Qualified DEV data does not establish stage/production readiness. Browser comparison remains the user's judgment; smaller bytes are measured, superior appearance is not asserted.
