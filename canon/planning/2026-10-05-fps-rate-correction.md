# One measured 25 fps rate correction

Status: proposed bounded experiment; no implementation, encoding, or production change. Preserve the original unmatched attempt and its diagnostic visual evidence.

## Observed result

CI run 37260050319, artifact 11323239996, ZIP SHA256 af5a5910b498d372a5bf8a29a5dd0e9bb56e11b484bd4ce649576c79386e4982. Receipt SHA256 83847f8ed2ca9acf382344bc2464a7e6a99685853def3f90b03c650bad5379b0. Independent local rehash and MP4 sample-table measurement agree exactly with both receipt records.

| Measurement | Retained 50 fps | First 25 fps |
|---|---:|---:|
| Full file bytes | 5,509,355 | 5,421,828 |
| Video payload bytes | 4,453,068 | 4,403,293 |
| Video track duration | 79.14 s | 79.16 s |
| Actual video payload rate | 450,145.868 bit/s | 445,001.819 bit/s |
| Video samples | 3,957 | 1,979 |
| AAC payload bytes | 957,197 | 957,197 |
| Mux bytes | 99,090 | 61,338 |

The 87,527-byte full-file reduction is 1.58870%: 49,775 fewer video payload bytes plus 37,752 fewer mux bytes, with identical audio. It is not an established quality-equivalent saving. The fixed pair gate divides the 49,775-byte difference by nominal video bytes 4,343,044.92; 1.146085% exceeds the unchanged 1% threshold. Status remains measured-rate-unmatched, not accepted.

Both AAC tracks have 3,712 samples, duration 79.18933333333334 s, and concatenated decode-order payload SHA256 b9df934587bba4c5fcf1ad541861946e9d1754725b698eb910efc8fcb4f8b50b. Container duration is 79.168 s in both. Timestamp-grid correspondence is not proof of decoded frame identity or motion quality.

## Exactly one correction

Reuse the exact retained HQ source, 49,851,846 bytes, SHA256 257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718. Reuse the exact retained 50 fps baseline, SHA256 b48729c4de2bbea42ad0efab778ae758381bc135ead32cc1bed9573837b0808e. Preserve the first 25 fps output SHA256 5349ea8bdcb160e645b7d40fac41640b7592e05b15e4eecb61f94d7976b80c39 and receipt unchanged.

The proportional estimate is 439024 × 4453068 / 4403293 = 443986.7448 bit/s. Request **444000 bit/s** for one new 25 fps two-pass encode, rounding to integer kilobits as actually supported by x264. This is an encoder-request correction to match the existing baseline, not a new nominal budget or relaxed tolerance. No further automatic adjustment or retry follows failure.

Keep all other experiment settings unchanged: 1280×720, fps=fps=25:round=near, libx264 medium, yuv420p, 30-second maximum GOP (750 frames), existing scenecut/min-keyint and VBV settings, and the identical existing AAC payload. Do not combine the separate proportional audio/mono-stereo experiment with this controlled FPS comparison. Do not regenerate the 50 fps baseline. Require exact equality of the recorded actual encoder identity (executable, libraries, adapter identity) before encoding; otherwise stop as non-comparable.

Zero source network requests: use hash-verified retained files, with no origin fallback. One two-pass encode plus measurement job only, at most 300 seconds, within a five-minute job budget and the existing 30-minute experiment window; reserve 30 seconds for cleanup before starting (at least 330 seconds of window capacity). Preserve existing 60 MiB source/output limits, 32 MiB per stats file / 64 MiB combined stats, 768 MiB aggregate disk cap, preflight reservation, active monitoring, Linux file-size limits, process cancellation and cleanup. The workflow remains at most 35 minutes including image preparation. New output directory and incremental failure receipt; no overwrite or automatic loop.

## Acceptance and reversal

Run the unchanged pair qualification against nominal target **439024 bit/s**, not the corrected encoder request: each actual video rate within 5% of nominal, video duration difference at most 0.05 s, video payload difference at most 1% of nominal bytes computed from the shorter duration, and exact AAC payload SHA/sample count/duration equality. Rehash actual files, remeasure sample tables, retain pass arguments and logs, actual encoder identity and source-request count. An encode success alone is not pair acceptance.

Only a numerically matched pair advances to independently reviewed decoded stills, real playback/motion and seek comparison. No lower-rate encode, claim of quality-equivalent savings, production preset change, or universal 25 fps recommendation follows automatically. On any mismatch retain the result and stop. Reversal is simply retaining the existing 50 fps production recipe; this experiment changes no deployed service or application.
