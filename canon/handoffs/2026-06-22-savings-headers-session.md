---
title: Savings-Headers Session — Verify Before Extend, Reconcile the Header-Family Drift
date: 2026-06-22
status: working
mode: planning
---

# Savings-Headers Session — Verify Before Extend, Reconcile the Header-Family Drift

> A session that started from "add response headers to show file savings" and a consumer-app feature doc, and arrived at a small proxy-side slice: emit `X-Transcode-Source-Bytes` and `X-Transcode-Encoded-Bytes` (both already computed and discarded), and open CORS so a browser can actually read them. The turning point was reading `src/worker.ts`: the session's memory of the transparency-echo contract (`X-Encode-Dimension` / `X-Bound-By` / `X-Quality`) did not match the shipped `X-Transcode-*` family. Code is sovereign; the plan was rebuilt on what ships. Decisions, alternatives, and the two learnings are encoded in `canon/encodings/2026-06-22-response-savings-headers.tsv`; the binding spec is `canon/planning/2026-06-22-response-savings-headers.md`.

---

## Summary — The Numbers Were Already There; the Browser Just Could Not Read Them

The request was to expose source-vs-transcoded file sizes in response headers. A feature doc arrived from the consuming app proposing a two-track plan. The operator's framing was explicit: the doc is a suggestion devoid of proxy-side context, and transcode-mcp should do what is right for itself.

Verification reordered the plan:

- The transcode path **already computes** both numbers — `info.fileSize` (source) from the `env.IMAGES.info()` call it makes for dimensions, and `buf.byteLength` (encoded) of the transformed output — and discards them. Exposing them is free.
- The worker emits **zero CORS**. Even with the byte headers present, a browser cannot read them cross-origin without `Access-Control-Expose-Headers`, and a `fetch()` is blocked without `Access-Control-Allow-Origin`. That missing CORS — not a missing number — is why the dashboard reads 0 B.
- The shipped header family is `X-Transcode-*`, **not** the design-session names. The consuming app already reads `X-Transcode-*`. Extending the shipped vocabulary is the low-risk path; the canon drift is reconciled by a note on the design-session handoff.

The slice that resulted: two byte headers, a DRY CORS+expose helper on every served response, best-effort source bytes on non-transcode paths, and tests. Deferred: the `/stat` endpoint (speculative transcodes, its own slice) and all app-side "Track B" work (a different repo).

---

## The Path — What Was Observed, in Order

1. **Boarded** under the model operating contract; observed the clock; oriented in exploration, then planning.
2. **Read `src/worker.ts`.** Confirmed the transcode response headers, the absence of byte counts, the absence of CORS, the Cache-API HIT path that clones stored headers, and the passthrough/no-binding/audio paths. Confirmed `ImagesBinding.info()` returns `fileSize`.
3. **Searched canon.** Found the design-session handoff (the transparency-echo origin) and the `partial-data-with-transparency-and-background-warm` principle, which the best-effort/cache-warm posture sits under.
4. **Caught the divergence.** Memory said `X-Encode-Dimension` / `X-Bound-By` / `X-Quality`; the code ships `X-Transcode-*`. The design-session handoff is `working` and its code follow-through landed under different names. As-built wins for the new headers; the handoff gets a drift note.
5. **Checked `feat/true-size-render`.** Despite the on-point name, it is ~3,986 deletions behind `main` — a stale branch, not in-flight work. Discarded as a base.
6. **Pressure-tested** the proposal (pattern-coinage / assumption): the header decision is reconciling two existing vocabularies, not coining a new one, and the "consumer reads `X-Transcode-*`" assumption is grounded in both the shipped code and the consumer doc's own expose list.

## The Two Learnings

- **Intent is not as-built.** A decision recorded in a `working` handoff describes what was intended; the code may ship a variant. Verify both the canon intent and the shipped code before extending a contract. (Recurrence of the reconstruction-diverges-from-canon meta-lesson already in the design-session handoff — this time the divergence was in session memory, not a chat reconstruction.)
- **Read a plan's vantage point.** The feature doc framed in-repo proxy work as "Track A — Proxy upgrade request" to hand to `transcode.klappy.dev`. This repo *is* that proxy; a request-to-self is implement-here. Adopting the doc's task taxonomy unexamined would have produced a feature-request-to-self instead of the feature.

## Handoff — What the Fresh Session Does

A fresh session (the context break that makes validation independent) implements the code and tests per `canon/planning/2026-06-22-response-savings-headers.md`: a DRY CORS+expose helper on every served response, the two byte headers on the transcode path, best-effort source bytes on passthrough/no-binding/audio, and unit tests asserting headers and CORS on each path. Then challenge → gate → validate per `canon/constraints/definition-of-done.md`. Deploy is via Cloudflare Workers Builds on push to the scoped branch — never `wrangler deploy`, never GitHub Actions.

## References

- Binding spec: `canon/planning/2026-06-22-response-savings-headers.md`
- Encoded rows: `canon/encodings/2026-06-22-response-savings-headers.tsv`
- Transparency-echo origin and the header-family drift: `canon/handoffs/2026-05-29-design-session.md`
- Applied principle: `klappy://canon/principles/partial-data-with-transparency-and-background-warm`
- Response envelope ownership: `canon/planning/2026-05-26-worker-container-boundary.md`
