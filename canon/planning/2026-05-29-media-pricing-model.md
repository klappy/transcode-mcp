---
title: Media Pricing Model — Unified Credit, Per-Medium Weights, Blended 20–100× Target
date: 2026-05-29
status: working
mode: planning
derives_from: canon/planning/2026-05-27-audio-container-recipes.md
complements:
  - canon/planning/2026-05-26-worker-container-boundary.md
  - canon/planning/2026-05-26-url-vocabulary-and-presets.md
applied_canon:
  - klappy://canon/principles/vodka-architecture
  - klappy://canon/patterns/docs-proxy-canon-as-tool
---

# Media Pricing Model — Unified Credit, Per-Medium Weights, Blended 20–100× Target

> One credit prices image, audio, and video. Per-medium weights hold each operation at or below the incumbent rate it gets benchmarked against; the 20–100× markup target is a blended outcome — image and audio clear 10× to 500× per-unit, video and storage anchor competitiveness at 1.3× to 2.5×. The band lands on the processing line once cache-hit on unique-once-billed transforms exceeds ~75%; pass-through delivery and storage dilute the all-in blend. Audio transcode cost is measured (~1.8 CPU-sec per audio-minute, native ffmpeg), not estimated.

---

## Summary — One Credit, Three Media, A Blended Target That Holds Only On The Processing Line

The commercial agent-facing surface needs a price the buyer can predict and a margin the operator can defend. This document records the model: one billing unit (the credit), three weights per medium so each operation sits at or below the rate it gets compared to, and a markup target framed as a blended portfolio outcome rather than a per-unit rule. Image and audio carry the markup easily because their Cloudflare cost is sub-cent per unit; video and storage are priced as competitive anchors near cost, contributing to the blend without dragging it below the target band. The 20–100× number holds on the processing line — image transforms, audio transcode, transcription, TTS, video transcode and clip — but not on the all-in line when delivery and storage are included. The empirical model in `calculator/markup-instrument.jsx` (also embedded in the admin dashboard at `/admin`) confirms: all-in blends 10–18× at moderate settings, processing-only 20–48× at cache ≥ 75%. The honest claim is the processing-line one.

---

## Problem

The Bible translation use case at `ARCHITECTURE.md` doesn't price — it bundles. The commercial agent-facing surface that runs on the same Worker does. The pricing has to satisfy two constraints at once: stay competitive with the incumbents agents already compare against (Mux $0.0075/min encode, Cloudinary credit-based, Deepgram $0.0052/min STT, AWS MediaConvert $0.0075–0.015/min), and clear a markup target large enough to make the product worth running. A flat per-minute rate cannot do both. Video transcode at incumbent rates pins the ceiling so low that markup never clears 3×. The model below solves it by pricing through a single unit (the credit) with per-medium weights that pull each operation onto the right competitive shelf, and by leaning on Cloudflare's two structural advantages: each unique transform billed once per month, and R2 egress at $0.

## Decision

A unified **credit** is the billing unit. Each operation consumes a fixed weight of credits. The reference list price for the Growth tier is **$0.005 / credit** (other tiers in `data/pricing/credit-tiers.tsv`).

Weights are tuned so the resulting per-unit price sits at or below the incumbent benchmark for that operation:

| Operation | Weight | Price at $0.005/credit | Incumbent benchmark |
| --- | --- | --- | --- |
| Image transform | 1 | $0.005 / transform | Cloudinary 3–5× CF all-in |
| Image deliver | 0.02 | $0.0001 / serve | per-GB CDN bandwidth |
| Video transcode (Stream path) | 3 | $0.015 / min | MediaConvert HD $0.015 |
| Video clip (on-the-fly, ≤1 min) | 6 | $0.030 / min | Mux $0.0075 encode |
| Video deliver | 0.4 | $0.002 / min | Mux 720p $0.0012 |
| Audio transcode (any codec) | 0.5 | $0.0025 / min | MediaConvert audio $0.003 |
| Audio transcription (STT) | 1 | $0.005 / min | Deepgram nova-3 $0.0052 |
| Audio TTS | 0.5 | $0.0025 / min | per audio-min |
| Voice pipeline (Opus + STT bundle) | 1.5 | $0.0075 / min | transcode + STT combined ~$0.0082 |
| Storage (per GB-mo) | 4 | $0.020 | S3 $0.023 + egress |

## Cost Basis (Cloudflare, Verified 2026-05)

| Meter | Rate | Free allocation |
| --- | --- | --- |
| Image transforms (remote) | $0.50 / 1,000 ops, **unique billed once / month** | 5,000 / mo |
| Image hosted store + deliver | $5 / 100k stored + $0.00001 / serve, egress $0 | — |
| Stream — store + deliver | $5 / 1,000 min stored + $1 / 1,000 min delivered, encoding free | — |
| Media Transformations (video clip ≤1 min) | $0.0005 / output-sec = $0.03 / output-min, unique billed once / month | 5,000 ops / mo |
| R2 | $0.015 / GB-mo, Class A $4.50 / M, Class B $0.36 / M, **egress $0** | 10 GB + 10M Class B |
| Workers CPU | $0.00002 / CPU-sec ($0.02 / M CPU-ms) | 30M CPU-ms in $5 Paid base |
| Containers CPU (active usage only since 2025-11) | $0.00002 / vCPU-sec | 375 vCPU-min in $5 Paid base |
| Workers AI — Whisper STT | $0.0005 / audio-min | 10k neurons / day (~240 min/day) |
| Workers AI — Whisper-large-v3-turbo | $0.0005 / audio-min | same |
| Workers AI — MeloTTS | $0.0002 / audio-min | same |

Two cost levers do the heavy lifting. **Unique transforms billed once per month** (Images and Media Transformations) means every repeat serve has zero marginal cost while still being meterable on the price side. **R2 egress at $0** means delivery-heavy workloads pay nothing on bandwidth where incumbents pay $0.085–0.09 / GB.

## Competitive Landscape

| Medium | Incumbent | Their rate |
| --- | --- | --- |
| Image | Cloudinary | credit-based, ~$0.37 / credit (1 credit = 1,000 transforms), $224/mo Advanced entry, 3–5× CF at scale |
| Video | Mux | encode $0.0075 / min; deliver $0.0012 / min (720p) → $0.0048 (4K), first 100k min free |
| Video | AWS MediaConvert | $0.0075 / min SD, $0.015 / min HD; audio-only $0.003 / min |
| Transcription | Deepgram nova-3 | $0.0052 / audio-min |
| Transcription | AssemblyAI | ~$0.004–0.015 / min |

## Audio Codec Lanes — Measured Evidence

Audio targets are three product lanes, not three SKUs. Per-codec CPU measured on native ffmpeg (single core, `getrusage`), source = 180s synthetic music (stereo 44.1k) and voice (mono 16k):

| Lane | Content | Target codec | CPU-sec / min | Cost / min (Container native) | Markup at $0.0025 |
| --- | --- | --- | --- | --- | --- |
| Voice | mono 16k → Opus 24k | Opus | 1.40 | $0.000028 | ~89× |
| Voice | mono 16k → MP3 64k | MP3 | 0.25 | **$0.000005** (cheapest) | ~500× |
| Voice | mono 16k → AAC 64k | AAC | 0.37 | $0.0000074 | ~338× |
| Music | stereo 44.1k → AAC/MP4 192k | AAC | **1.91** (heaviest) | $0.000038 | ~65× |
| Music | stereo 44.1k → MP3 192k | MP3 | 0.90 | $0.000018 | ~139× |
| Music | stereo 44.1k → Opus 128k | Opus | 1.08 | $0.000022 | ~115× |
| Mixed | aac → opus (decode + re-encode) | Opus | 1.08 | $0.000022 | ~115× |

Raw matrix at `data/pricing/audio-codec-matrix.tsv`. Two consequences, neither of which changes price:

- **Codec spread is ~8× on cost, 0× on price.** Every target sits far below the $0.0025/min list at the 0.5 weight, so one flat audio-transcode credit covers MP3, AAC, and Opus across both content classes. Budget capacity on the music → AAC worst case.
- **Architecture routes by codec / duration.** Music → AAC on Workers-WASM is ~5.7 CPU-sec per audio-min (3× native penalty estimate). A long music file would exceed the Workers per-invocation CPU cap. Long music → AAC routes to Containers; short voice / MP3 jobs may stay in Workers. This is a routing rule, not a pricing rule.
- **Voice pipeline is a bundle, not a separate price.** Transcode-to-Opus + Whisper STT in one call: cost $0.000528 / min (transcription-dominated), 1.5 credit weight → $0.0075 / min, under the $0.0082 combined incumbent price for transcode + STT bought separately. Per-unit markup ~14× and competitive.

## Markup Math — Per-Unit and Blended

Per-unit markup at the Growth tier ($0.005 / credit), with cache-hit applied where the operation is cacheable:

| Operation | Cost (cold) | Cost (cached, 75%) | Per-unit markup (cached) |
| --- | --- | --- | --- |
| Image transform | $0.0005 | $0.000125 | **40×** |
| Audio transcode (blended mix) | $0.0000278 | — | **90×** |
| Audio transcription | $0.0005 | — | **10×** (undercuts Deepgram) |
| Voice pipeline | $0.000528 | — | **14×** (undercuts combined) |
| Video transcode (Stream) | $0.006 | — | **2.5×** (matches MediaConvert HD) |
| Video clip (Media Transformations) | $0.03 | $0.0075 | **4×** at 75% cache, **∞** at full fanout |
| Storage | $0.015 | — | **1.3×** (egress-free is the moat) |

Blended over a representative agent workload (image-heavy, audio mixed, video light, decent fanout):

| Scenario | All-in (incl. delivery + storage) | Processing only |
| --- | --- | --- |
| Credit $0.005, cache 50% | ~9.5× | ~12× |
| Credit $0.005, cache 75% | ~13× | **~21×** ✓ |
| Credit $0.005, cache 90% | ~17× | **~35×** ✓ |
| Credit $0.007, cache 90% | ~24× ✓ | **~50×** ✓ |

The honest finding the model surfaces: 20–100× is a processing-line outcome, not an all-in one. To hold it all-in, either exclude pass-through (delivery + storage) from the markup denominator, raise the cache lever, or skew workload toward image / audio.

## Alternatives Considered

- **Flat per-minute rate across media.** Rejected. Setting the rate to clear video transcode markup pushes image and audio far above market; setting it to clear image / audio puts video transcode below cost. The credit unit with per-medium weights solves the multi-axis problem the single-axis rate cannot.
- **Per-codec audio pricing.** Rejected. Measured cost spread is 8× across codecs but every codec sits far below the audio price; codec-specific pricing adds buyer-facing complexity for ~0 capture. One weight covers all.
- **Public canon repo as a sibling.** Rejected for this repo. `klappy/transcode-mcp` is already public, so the same obscurity hygiene (no portal, no inbound links, no profile pin) achieves "publicly accessible, not publicly linked" without a second repo. The canon lives under `canon/` here; the data lives under `data/pricing/`.

## Disconfirmers

- **Image markup goal fails** if an incumbent drops remote-transform pricing below ~$0.0005 / transform with free bandwidth. None today.
- **Audio markup goal fails** if a competitor ships sub-$0.001 / min STT at Whisper-equivalent quality. None today.
- **Video markup goal fails per-unit by design** — the disconfirming case is *cold, long-form, single-use, high-resolution video with zero repeat serves*. There the blend is unreachable and that workload segment should be re-priced per-minute at 2–3× rather than dragging the credit model.

## Success Criteria

- A buyer comparing line-by-line to Mux, MediaConvert, Cloudinary, and Deepgram sees each individual operation at or below their list rate.
- Blended margin over Cloudflare cost across a representative agent workload clears 20× on the processing line at cache-hit ≥ 75%.
- Audio capacity budget covers the measured music → AAC worst case ($0.000038 / min) without surprises.
- The free tier is fully funded by Cloudflare's stacked free allocations (5k image transforms + 10 GB R2 + 10k neurons/day).

## Open Questions

- O-open P1 (priority): Workers-WASM CPU penalty for ffmpeg is currently a ×3 estimate, not a measurement. Resolve by running the same `getrusage` workload inside a Worker before locking the Workers-vs-Containers routing rule.
- O-open P2: video clip transcode breaks even at weight 6 ($0.03/min cold via Media Transformations). The margin is cache-only. Resolve with real cache-hit data from production traffic once it exists.
