---
title: "Audio Bench Parity — Duration Header, No-Store Cache Fix, Shared Nav, Parallel Bench"
date: 2026-05-29
status: working
mode: handoff
derives_from: canon/planning/2026-05-29-audio-worker-path.md
complements:
  - canon/planning/2026-05-29-demo-spa-routing.md
  - canon/planning/2026-05-27-audio-container-recipes.md
---

# Audio Bench Parity — Duration Header, No-Store Cache Fix, Shared Nav, Parallel Bench

> A follow-on session after audio Slice 1 (voice+opus) landed. It built the
> `/bench/audio` measurement page, debugged a Cloudflare deploy failure, fixed a
> deceptive cache display bug, added the q→target mapping the page was missing,
> and brought the page to image-bench parity (shared nav, parallel fetch, source
> rendered as a size-sorted tile, source metadata, and per-tile length). One
> server change came out of it — the Worker now forwards the container's
> duration as `X-Transcode-Duration`. The structured rows live in
> `canon/encodings/2026-05-29-audio-bench-parity.tsv`. Everything is shipped on
> PR #25 (`feat/audio-voice-opus-slice1`) and needs a redeploy to be visible.

---

## Summary — What Carried Through

The audio path reached image parity at the proxy in Slice 1; this session made
the *demo* match too, and corrected two things that were quietly wrong.

The bench at `/bench/audio` fetches `/audio/...` variants, reads the live
`X-Transcode-*` headers, and shows byte savings, cache state, and a player per
variant — the audio analogue of the image bench. Bringing it to parity meant:
one shared four-link nav across every page, all probes fired in parallel instead
of chained, the source rendered as a tile in the same size-sorted grid as the
variants, a source-info summary, and the file's length shown per tile.

Two corrections matter more than the features. First, the bench's "low quality
is always a cache MISS and suspiciously fast" report was **not** a cache bug —
it was the browser replaying a frozen header from its own disk cache, because
`/audio` responses are `immutable`. Second, the page never said what `low`/
`medium`/`high` *mean* the way the image bench shows `q=20/50/80`; now it does,
as recipe targets shown next to each tile's measured bitrate.

---

## What Happened, In Order

- **Built `/bench/audio`** as a separate single-`<script>` page + thin `.ts`
  loader, on the demo-SPA pattern, added to the `demo-page.test.ts` guard array.
  Sourced public-domain audio Bible / LibriVox samples (BSB Psalms narrated by
  Bob Souer; Poe and Twain from LibriVox) and verified their durations and sizes
  with ffprobe.
- **Deploy failure (resolved).** A versioned upload (`wrangler versions upload`)
  cannot apply the `AudioContainer` Durable Object migration (error 10211). The
  fix is not scope-conditional CI commands (rejected as unmaintainable) but a
  one-time full `wrangler deploy` to apply the migration, after which ordinary
  `versions upload` works. Operator ran it; the worker is live.
- **Cache display bug (diagnosed, fixed).** See the Learning row: `immutable`
  responses froze the browser-cached `X-Transcode-Cache` header, so a server-side
  HIT still displayed as the first-fetch MISS, served instantly from disk cache.
  curl proved the server caches `low` correctly (HIT every request). Fix: the
  bench's measurement fetch uses `cache: 'no-store'`. The immutable header is
  correct for real consumers and was left untouched.
- **q→target mapping.** Added the recipe targets to the quality labels and a
  legend (low 8 kbps @ 8 kHz, medium 16 @ 16, high 32 @ 24, mono), mirroring the
  image bench's `q=20/50/80`. Each tile shows the live *measured* bitrate next to
  the target so drift from the recipes is visible. Per-tile sample rate was
  dropped because Opus reports 48 kHz decode regardless of coded rate, which
  would contradict the legend (Constraint row).
- **Parity upgrade.** Shared four-link nav on all pages (only `aria-current`
  differs), guard test extended to require `/bench/audio` everywhere; Run button
  removed and the bench now runs on change + on load; all probes fire via
  `Promise.all` with a run-generation guard; the source renders as a size-sorted
  tile alongside the variants; source-info summary added; dropdown durations
  corrected from ffprobe; per-tile length surfaced.
- **Duration header.** To surface length truthfully (from the proxy, not the
  client), the Worker now forwards the container's `X-Audio-Duration` as
  `X-Transcode-Duration` (Decision row).

---

## Why It Matters

The proxy's whole pitch is "we tell you the truth about the bytes." A bench that
*looks* like it's lying — a permanent MISS that's actually a HIT — undermines
that more than a missing feature would. The no-store fix and the target-vs-
measured display both serve the same value the project optimizes for:
self-truthing output a skeptical caller can verify.

## Open / Next

- **Redeploy** to make the bench changes and `X-Transcode-Duration` live. The DO
  migration is already applied, and duration is an additive header, so a
  `versions upload` suffices this time.
- **Optional `X-Transcode-CodedRate`** from OpusHead so the bench can build the
  q→rate map from live data instead of a static legend, and show a truthful
  per-tile coded rate (closes the sample-rate Constraint). Carried as a Handoff
  row, not yet scheduled.
- **Mirror bench samples to R2** for production (O-open, P3): the defaults
  hotlink community hosts (openbible.com, archive.org); both are public domain
  but a controlled mirror avoids upstream churn.

## Canon Reconciliation Done This Session

- `canon/planning/2026-05-29-audio-worker-path.md`: added `X-Transcode-Duration`
  to the response-contract header set.
- `canon/planning/2026-05-29-demo-spa-routing.md`: appended an update noting the
  fourth route (`/bench/audio`), the shared-nav-as-enforced-invariant, and the
  no-store measurement insight.
