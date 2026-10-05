# Aligned video canvases and one optional 320p comparison

2026-10-05. Planning contract; no geometry change or encode is represented by this document. This adds the user’s raster-alignment requirement to the [current quality-budget revision](2026-10-05-video-quality-budget-revision.md). It supersedes the earlier unexecuted 568×320 / 88889-bit/s experiment configuration. That older manual harness must not run unchanged.

## Scope and encoding truth

Use dimensions divisible by 16; prefer divisibility by 32 where it does not unnecessarily alter the existing Large canvas. This is a raster-layout preference, not a claim that H.264 uses 32×32 macroblocks. H.264 defines 16×16 luma macroblocks and supports smaller prediction partitions. Leave the encoder’s adaptive partition decisions intact; do not force the largest partition or infer that alignment alone improves quality or size. [ITU-T H.264 (08/2024)](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-H.264-202408-I%21%21PDF-E&lang=e&type=items).

The three supported offerings remain Small, Medium and Large. The single optional 320p output is a private comparison, not a fourth public preset, arbitrary-resolution API, app download option or automatic showcase addition. No codec, cadence, audio, preset, GOP or safety-bound change is bundled with this alignment revision.

## Exact geometry

| Offering | Encoded raster | Alignment | Sample aspect ratio | Display aspect ratio |
|---|---:|---|---:|---:|
| Optional 320p experiment | 576×320 | Both dimensions divisible by 32 | 80:81 | 16:9 |
| Small, nominal 480p | 864×480 | Both dimensions divisible by 32 | 80:81 | 16:9 |
| Medium, nominal 540p | 960×544 | Both dimensions divisible by 32 | 136:135 | 16:9 |
| Large, 720p | 1280×720 | Both divisible by 16; height not divisible by 32 | 1:1 | 16:9 |

Medium’s actual height is 544; “540p” is its nominal offering label, not a false decoded-raster claim. Do not change Large to 736 just to satisfy the 32 preference.

Resample the complete source image to each encoded raster, then explicitly signal the listed sample aspect ratio. Do not crop the source or add padding. Correct display restores the original 16:9 shape; consumers that ignore non-square pixels can distort it, so browser display acceptance is mandatory. The algebra is exact: `(576/320)*(80/81) = (864/480)*(80/81) = (960/544)*(136/135) = (1280/720)*1 = 16/9`.

Every profile must declare explicit `sar` (FFmpeg's name for pixel/sample aspect ratio, also called PAR) and `dar` contract fields, including Large `sar: "1:1", dar: "16:9"`. Tests must prove coded width/height × SAR = DAR using exact rational arithmetic. The known source SAR is 1:1. No implicit encoder auto-SAR is accepted as the contract. Stream probes must expose the intended SAR and DAR, and the MP4 track display geometry must reconcile to 16:9. If a probe omits a field, record the omission and obtain explicit encoded bitstream/container evidence; do not silently substitute 1:1 or retain the historical unspecified-Large exception. Browser checks must verify the actual displayed picture, not only a CSS box or the coded raster. No crop or visible stretch is authorized.

Use the existing scale/setsar pipeline. Example: `scale=864:480:flags=lanczos,setsar=80/81:max=65535`. The filter expression uses `/` for the ratio; `:` separates filter options. Probe metadata may format the same ratio with a colon. FFmpeg defines display aspect as raster width divided by height, multiplied by sample aspect ratio. [FFmpeg setdar/setsar documentation](https://www.ffmpeg.org/ffmpeg-filters.html#setdar_002c-setsar).

## Budgets remain independent of the alignment adjustment

The +50% change is applied to ORIGINAL video budgets, not compounded with the superseded +20% idea. Do not further increase bitrate in proportion to the few additional raster samples. The declared rates remain:

| Offering | Requested video bits/s | Nominal class bits/s | VBV max bits/s | VBV buffer bits | Audio retained |
|---|---:|---:|---:|---:|---|
| Optional 320p | 133334 | 133334 | 266667 | 533334 | AAC 42667 bits/s, mono, 48kHz |
| Small | 300000 | 300000 | 600000 | 1200000 | AAC 42667 bits/s, mono, 48kHz |
| Medium | 379688 | 379688 | 759375 | 1518750 | AAC 54000 bits/s, stereo, 48kHz |
| Large | 658536 | 675000 | 1350000 | 2700000 | AAC 96000 bits/s, stereo, 48kHz |

Optional 320p derives from its original natural requested rate 88889×1.5=133333.5, rounded to 133334. Its original max 177778×1.5=266667 and buffer 355556×1.5=533334 preserve the original convention. Max differs by one bit/s from twice the rounded request, as explicitly disclosed for Medium in the quality-budget revision. There is no arbitrary target equal to the old file’s size.

All rows retain 50fps, H.264 two-pass ABR, medium encoder preset, existing 30-second GOP and scene-cut behavior. The audio quality floor remains the existing audio-showcase Opus Low reference; AAC 42667 mono is retained rather than reduced without evidence. Equal bitrates across AAC and Opus do not establish equal perceived quality. Listening acceptance must establish that the candidate does not fall below the requested floor; no acoustic acceptance is inferred from the retained numerical rate.

## Bounded implementation and qualification

First update recipe data, exact argument tests, SAR/raster validation and truthful recipe/encoder identities. Preserve old fixed R2 showcase artifacts, measurements and metadata. No old qualification revision may masquerade as qualification of these new bytes. Shared source×size selection remains the only production pipeline.

Qualification order is 320p FIRST: run the single optional candidate below and review its motion, geometry and audio against the retained source and old compact file before encoding any of the three core profiles. If accepted, apply the same shared proportional rules to the three core profiles at their declared +50% budgets. Brief actual validation of each needed size/source still establishes truthful descriptors and compatibility; it is not a repeated tuning matrix. No automatic PR/push encode, retry or rate search. A successful 320p comparison does not prove quality or compatibility at every other size. The later core a13 validation uses at most one output per profile under the existing manual three-target bounds; each other approved source likewise needs its actual outputs qualified before availability is advertised.

The optional 320p comparison is a separate one-candidate manual job using the already retained a13 source: at most 300 seconds for two-pass video, 10 minutes overall, 60MiB output and 384MiB aggregate retained/input/output/temp budget, with bounded cleanup and no network inside the encoder container. Reuse retained old compact and source evidence; do not reacquire or re-encode the old 400×224 file. The existing bounded audio-floor reference may be reused if its identity matches; at most one audio-only Opus Low reference is allowed if absent, under its existing 120-second bound within the same overall ceiling. No second video candidate or automatic retry is authorized by this comparison.

Verify actual source/output hashes; full decode; duration and frame count; emitted video average/max/buffer settings; unchanged audio; raster, SAR and MP4 display dimensions; cleanup and actual resource limits. Require browser playback, seek and correct 16:9 display with these non-square-pixel files. Report encoded raster separately from displayed shape. Mechanical success alone does not establish quality.

Compare source, prior same-size artifact and revised artifact during continuous motion at declared next-larger display dimensions, plus matched decoded frames at 10/40/70 seconds. For optional 320p compare the unchanged compact 400×224 file as well as the source at the same display dimensions. Record actual bytes, video/audio payload and mux overhead, encode time and observed detail/motion separately. “Smaller than the old compact file with better observed quality” is a hypothesis, not a release guarantee. Distracting motion artifacts, geometric distortion or failure to meet the audio floor withhold acceptance. They do not authorize an unbounded tuning loop.

## Discovery and reversal

This document is intended for the existing repository-backed docs search and single-URI retrieval. Verify live discovery after canonical publication. No additional tool, service, binding or bundled catalog is introduced. Git reversal and immutable retained artifacts preserve the prior behavior; new output publication and app catalog binding remain separate reviewed actions.

## Measured sampling-first checkpoint

See [the sampled 320p results](2026-10-05-320-sampled-results.md) for the actual 39.6-second measurement, matched still and geometry review, and remaining motion/listening limits. This evidence does not qualify the complete source or change production availability.

## Subsequent user acceptance

The user accepts the +50% baseline and closes further quality experiments. The [recorded decision](2026-10-05-320-sampled-results.md#user-decision-ship-the-accepted-baseline) supersedes earlier requirements for additional motion or acoustic quality gates in this experiment. Continue mechanical integrity and sequential release verification without another tuning matrix. Reopen tuning only for a concrete use case; do not claim this decision proves all motion artifacts resolved.

## Subsequent planning evidence

See the [catalog cost and rendition rubric](2026-10-05-fia-video-cost-rubric.md) and [proposed Sovee display-resolution mapping](2026-10-05-sovee-display-resolution-mapping.md). The latter records a future source-limited canvas proposal; it does not change this released geometry. Cost proxies predate the newly requested clean-divisor frame-rate cap.
