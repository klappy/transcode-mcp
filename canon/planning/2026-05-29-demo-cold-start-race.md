---
title: Three-Lane Race — Surface Proxy Cold-Start (Cold vs Cached)
date: 2026-05-29
status: working
mode: planning
derives_from: canon/constraints/definition-of-done.md
complements:
  - canon/planning/2026-05-29-live-proxy-measurement.md
  - canon/planning/2026-05-29-demo-spa-routing.md
  - canon/values/project-identity.md
---

# Three-Lane Race — Surface Proxy Cold-Start (Cold vs Cached)

> The film demo race previously modelled download speed only (latency +
> bytes/bandwidth) and quietly assumed a warm cache — so the headline "Nx
> faster" verdict was a cached-case number wearing no label. This change makes
> the race run three lanes at once — **RAW** (no transform) / **1ST HIT**
> (cache MISS: cold transform + transfer) / **CACHED** (cache HIT: transfer
> only) — and surfaces the proxy's one-time cold-start transform cost as its
> own lane. Cold-start is server-side, so it is added to the cold lane and is
> NOT scaled by the network slider.

## Decision
Cold-start is measured live, once per session, then cached: time a HEAD to an
already-cached URL (HIT) and a HEAD to a per-session-unique URL (forced MISS →
a real transform); the delta isolates transform cost from network RTT. Falls
back to a measured ~1.2s midpoint if the probe fails. Verdict now reads
"N× when cached · first hit M× vs raw".

## Evidence
- Live `curl` probes: cold transform ≈ 1.0–1.4s vs warm ≈ 90ms (single-sample;
  absolutes include the prober's network path, but the cold−warm delta is
  robust because RTT cancels).
- `HEAD /image/...` returns `content-length` + `X-Transcode-Encode-W/H`
  same-origin → no worker change required.
- The hardcoded byte matrix currently matches the live proxy exactly
  (coast 800/med/webp: 80022 == 80022; 1808×1216 matches).
- Implemented formula simulated across 2G/3G/4G/5G: CACHED wins 25–38×
  everywhere; the cold first-hit degrades as bandwidth rises, reaching a
  ~1.1× near-tie with raw at 5G. The cache is the hero; cold is a one-time tax
  that only bites when bandwidth is cheap. Surfaced, not smoothed.

## Alternatives considered
- Two-pass cold-then-warm on a single proxy lane — rejected (less legible than
  three lanes side by side).
- Warm-only with a "first request" toggle — rejected (hides the cost by default).
- Bake cold-start as a constant — rejected (not self-truthing; measure it live).

## Reversibility
High — additive, one file (`src/demo-film.html`), measurement + third lane are
purely additive. Revert = drop the cold lane and the `measureColdStart` probe.

## Verified
`bun test` 60/60 (incl. film one-script / valid-JS / all-ids guards);
`bun run typecheck` clean; exactly one `<script>`; implemented race formula
simulated to confirm honest verdicts.

## Open (not done)
- Rendered three-phone layout at mobile/desktop widths is **best-effort and
  unverified** — `raceSc` + `lanePush` (in `layoutFor`) and the verdict-below-
  trio offset need a real eyeball. Faithful check requires serving via the
  worker (`wrangler dev` / preview deploy), not `file://`, because the live
  cold-start probe and header reads are same-origin.
