---
title: Response File-Savings Headers and CORS — Expose the Bytes the Proxy Already Knows
date: 2026-06-22
status: working
mode: planning
derives_from: canon/handoffs/2026-06-22-savings-headers-session.md
applied_canon:
  - klappy://canon/principles/partial-data-with-transparency-and-background-warm
complements:
  - canon/handoffs/2026-05-29-design-session.md
  - canon/planning/2026-05-26-worker-container-boundary.md
  - canon/constraints/definition-of-done.md
---

# Response File-Savings Headers and CORS — Expose the Bytes the Proxy Already Knows

> The proxy already measures the source file size (`env.IMAGES.info().fileSize`) and the encoded output size (the transcoded `ArrayBuffer.byteLength`) on every transcode, then discards both. Emit them as `X-Transcode-Source-Bytes` and `X-Transcode-Encoded-Bytes`, extending the as-built `X-Transcode-*` family rather than the never-shipped design-session names. The headers alone are invisible to a browser, because the worker sends no CORS: add `Access-Control-Allow-Origin: *` and `Access-Control-Expose-Headers` on every served response so JS `fetch()` can read them — that missing CORS, not a missing number, is why the consuming dashboard reads 0 B. Defer the heavier `/stat` endpoint; app-side telemetry is a different repo. Code lands in a fresh session; this session ships the canon.

---

## Summary — Two Numbers Already in Hand, Plus the CORS That Makes Them Readable

The consuming app's savings dashboard shows 0 B because it has no grounded way to read the source and encoded sizes from a cross-origin response. Two things fix that, both in the proxy:

1. **Emit the byte counts.** The transcode path already computes the source bytes (`info.fileSize` from the `env.IMAGES.info()` call it makes to measure source dimensions) and the encoded bytes (`buf.byteLength` of the transformed output). They are thrown away. Surface them as `X-Transcode-Source-Bytes` and `X-Transcode-Encoded-Bytes`. No extra fetch, no extra transcode.
2. **Open CORS.** The worker emits no `Access-Control-*` headers at all, so a browser cannot read any custom header cross-origin even when it is present. Add `Access-Control-Allow-Origin: *` plus an `Access-Control-Expose-Headers` list naming the full `X-Transcode-*` set and `Content-Length`, applied uniformly to every served response through one helper.

The headers extend the **as-built** `X-Transcode-*` family. The design-session handoff (`canon/handoffs/2026-05-29-design-session.md`) named a different family (`X-Encode-Dimension` / `X-Bound-By` / `X-Quality`) that the worker never shipped; the code shipped `X-Transcode-Source-W/H`, `X-Transcode-Encode-W/H`, `X-Transcode-Quality`, `X-Transcode-Format`, `X-Transcode-Binding`, `X-Transcode-Cache` instead. The consuming app already reads `X-Transcode-*`. Extending the shipped vocabulary keeps the consumer and the demo page working; the drift is reconciled by a note on the design-session handoff, not by renaming live headers.

Two things stay out: the `/stat/<source_url>` endpoint (its per-preset `encoded_bytes_for` map needs speculative transcodes — its own slice) and all app-side "Track B" work (a different repository). The proxy's job is to emit honest primitives — source bytes, encoded bytes, cache status — and let the app decide whether to present compression savings, delivery savings, or both.

This is the `partial-data-with-transparency` principle applied to the response envelope: serve best-effort, disclose what was observed, never block the caller. On the cache-HIT path the byte headers ride along for free because HIT clones the stored headers; on passthrough/audio (no transcode) the proxy still emits a best-effort source-bytes from the upstream `Content-Length` so the caller reads an honest zero-savings rather than a measurement gap.

---

## Problem — The Dashboard Reads 0 B, and It Is Not a Math Bug

The consuming app derives "savings" from `PerformanceResourceTiming.transferSize`, which is `0` cross-origin unless the origin sends `Timing-Allow-Origin`, then patches the gap with a same-host heuristic. The proxy, meanwhile, never tells anyone the original byte count, and sends no CORS headers, so even a direct `fetch()` of the proxied URL cannot read what little metadata exists. The result is a savings number with no grounded inputs.

The root cause is two missing pieces in the proxy response contract, both verifiable on `main`:

- **No source-byte header.** `src/worker.ts` emits dimensions, quality, format, binding, and cache status, but never the source or encoded byte counts — even though `env.IMAGES.info()` returns `fileSize` and the encoded buffer's `byteLength` is in hand at response time.
- **No CORS.** A `grep` for `Access-Control-` across `src/` returns nothing. `<img>` rendering does not need CORS, but it also exposes nothing to JS; a `fetch()`-and-read-headers path is blocked without `Access-Control-Allow-Origin`, and the custom headers are unreadable without `Access-Control-Expose-Headers`.

## Decision — Extend the Shipped Header Family and Open CORS Uniformly

The two new headers join the `X-Transcode-*` family on the transcode response:

```
X-Transcode-Source-Bytes:   <integer, source file bytes from info.fileSize>
X-Transcode-Encoded-Bytes:  <integer, transcoded output bytes from buf.byteLength>
```

Every served response — transcode, passthrough, no-binding, audio passthrough, and error — carries CORS through a single helper:

```
Access-Control-Allow-Origin:   *
Access-Control-Expose-Headers: Content-Length, X-Transcode-Source-Bytes,
  X-Transcode-Encoded-Bytes, X-Transcode-Cache, X-Transcode-Format,
  X-Transcode-Quality, X-Transcode-Source-W, X-Transcode-Source-H,
  X-Transcode-Encode-W, X-Transcode-Encode-H, X-Transcode-Binding
```

On non-transcode paths the proxy emits `X-Transcode-Source-Bytes` from the upstream `Content-Length` when present; encoded bytes equal source bytes there by definition.

## Alternatives Considered

- **Migrate the shipped headers to the design-session names** (`X-Encode-Dimension` / `X-Bound-By` / `X-Quality`). Rejected: it breaks the consuming app and the demo page for a cosmetic rename, and the design-session contract is a `working` handoff whose intent (`X-Bound-By` = which constraint bound the output) is already satisfied in substance by the shipped `X-Transcode-Binding`. The drift is reconciled by annotation, not migration.
- **A single combined savings header** (e.g. `X-Transcode-Savings: 812345/91234`). Rejected: two clean integers are easier for callers to read, diff, and chart than a packed field they must parse.
- **Per-origin CORS allowlist** instead of `*`. Rejected: the proxy serves public, read-only images with no credentialed data; `*` is the correct and simpler choice for a CDN-like surface, and the consumer is a separate origin (and others may embed too).
- **Build `/stat` now.** Rejected: speculative per-preset transcodes are real CPU and a separate concern; coupling them to a header-exposure slice breaks vertical-slice discipline.
- **Do nothing in the proxy; fix it app-side with HEAD probes only.** Rejected as the *whole* fix: HEAD probing is the consumer's fallback ladder and starts working the moment CORS lands, but without source-byte truth from the origin it can only ever estimate. The authoritative numbers must come from the proxy.

## Risks and Reversibility

- **Stale cached entries.** The image Cache API key is the full request URL with no version component, stored `immutable` for a year. Already-cached URLs serve without the new headers until eviction. This is graceful — the consumer's fallback ladder handles header absence — and there is no poisoning because output bytes are unchanged. Reversible/forward-only: new transcodes carry the headers immediately; old entries age out.
- **CORS surface.** `Access-Control-Allow-Origin: *` exposes only public image metadata; there is no credentialed or private data on this path. Fully reversible (remove the helper).
- **Header bloat.** Two integer headers and one expose list. Negligible.
- **Overall reversibility:** high. The change is additive headers behind one helper; reverting is deleting the helper call sites.

## Success Criteria

1. A transcode response (cache MISS) returns integer `X-Transcode-Source-Bytes` and `X-Transcode-Encoded-Bytes`, with encoded < source for a normal compressible image, and `X-Transcode-Encoded-Bytes` equal to the response `Content-Length` (proving the reported size is the delivered size, not an internal buffer that diverges from the wire).
2. The same response returns `Access-Control-Allow-Origin: *` and an `Access-Control-Expose-Headers` list containing both byte headers and `Content-Length`.
3. A cache-HIT response carries the same byte headers (proving they were stored, not just computed).
4. Passthrough, no-binding, and audio responses carry CORS, and emit `X-Transcode-Source-Bytes` when the upstream sent `Content-Length`.
5. A browser `fetch(proxyUrl, { mode: "cors" })` in a different origin can read both byte headers (the end-to-end outcome: the dashboard can stop reading 0 B).
6. Unit tests assert headers 1–4 under known inputs; `oddkit audit` clean on the canon changes; type-check and `bun test` green per the Definition of Done.

## Disconfirmers — What Would Retract or Rescope This

- **`info.fileSize` is unavailable for some source.** If the Images binding cannot measure a source format, `X-Transcode-Source-Bytes` is absent on that path; the consumer's fallback ladder must still handle a missing source-bytes header (it does). Scope, not retraction.
- **Encoded `byteLength` ≠ delivered `Content-Length`.** If the runtime re-encodes or chunk-transfers such that the buffer size diverges from the wire bytes, the "encoded bytes = delivered bytes" claim is false and criterion 1 fails. The fresh-session test asserts the equality precisely to catch this; if it fails, the header semantics get renamed (e.g. `X-Transcode-Output-Buffer-Bytes`) before merge.
- **CORS `*` becomes wrong.** Only if this proxy ever begins serving credentialed or private data. It does not today; revisit the wildcard if that changes.
- **Strongest opposing view** — "don't touch the proxy; use `Timing-Allow-Origin` + `transferSize` app-side." Rejected because `transferSize` yields only delivered bytes, never the source bytes, so authoritative savings is impossible without the proxy emitting source bytes — and `Timing-Allow-Origin` is itself a proxy header change.

## Scope Boundary

In scope (this repo, fresh-session code slice): the two byte headers, the CORS helper, best-effort source bytes on non-transcode paths, and their tests. Out of scope: the `/stat` endpoint (deferred, `O-open` P3 in the encoding TSV); all app-side telemetry, components, and pages ("Track B", a different repository); and any change to the proxy URL format.
