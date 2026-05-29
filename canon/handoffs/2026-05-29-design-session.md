---
title: "Design Session — Numeric Quality, Transparency Echo, Parked Video Model"
date: 2026-05-29
status: working
mode: handoff
derives_from: canon/planning/2026-05-26-url-vocabulary-and-presets.md
---

# Design Session — Numeric Quality, Transparency Echo, Parked Video Model

> A design conversation that started from the homepage's "one URL, three
> devices" promise and ended with three items encoded into canon: a numeric
> override for the `q` knob, a transparency-echo response contract, and a
> parked forward-exploration of the Sovee adaptive-streaming model for when
> video un-defers. Also a clear meta-lesson recorded as `L`: an assistant
> designing from chat alone reproduced the exact source-as-ceiling error
> canon already warns about, until oddkit was pointed at the repo. The
> reconstruction was wrong in specific, instructive ways; canon was right.
> The structured rows live in `canon/encodings/2026-05-29-design-session.tsv`.

---

## Summary — What Carried Through

The conversation arrived with a marketing puzzle: the homepage promises one
URL for three devices, but the implementation served three URLs. The honest
path is not to rewrite the copy — it is to make the claim real. From that
opening, the session unfolded the mechanics that would make it real:
auto-resolve what the proxy can, expose explicit overrides for what it
cannot, and declare which constraint bound the output so the caller knows
which lever to pull.

Two clean decisions came out of it (numeric `q`, transparency echo). One
forward direction was captured but explicitly parked as conflicting with v1
scope. And the session itself produced a meta-lesson worth recording: the
assistant's first artifacts reconstructed a design that already existed in
canon, including reproducing the exact bug `encode-resolution-arithmetic.md`
meta-lesson 6 (the bugbot incident) describes.

---

## What Got Decided

### Numeric quality override

`q` accepts an arbitrary integer 0–100 as the source of truth. The named
presets `low` / `medium` / `high` are sugar pinned to fixed points (images
20/50/80). A caller may pass `q=33` to sit between `low` and `medium`.
Presets remain the documented default; numeric is the power-user and agent
override.

This extends `canon/planning/2026-05-26-url-vocabulary-and-presets.md`
without conflicting. The current vocabulary documents presets only; this
opens arbitrary integers as a valid value while keeping presets as the
recommended surface for casual callers and the MCP tool.

Worker work: clamp `q` to 0–100, validate, treat numeric and preset as
equivalent inputs that produce equivalent byte-budget targets.

### Transparency echo

Every response carries headers declaring what was resolved and which
constraint bound it:

```
X-Encode-Dimension: 1200x912
X-Bound-By:         byte-budget | display-target | source-guard
X-Quality:          webp:q=33
```

The proxy never blocks on resolution, serves best-effort, discloses what it
assumed, and makes the override discoverable from the echo. The principle
is "partial data with transparency": return what was observed, name the
assumption, let the caller correct it. This is the keystone — without it,
"automagic" is opaque magic.

Additive. Nothing in canon contradicts it. Worker work: emit these on every
image and audio response.

---

## What Got Parked (Not a v1 Decision)

A forward exploration borrowed from Sovee adaptive-streaming days:
resolution as a single output lever driven by three triggers — screen
(Client Hints), bandwidth, and compute/stutter as runtime insurance — with
agents acting as thin couriers that forward the **end user's** request
signals (never the agent runtime's own User-Agent).

This **conflicts with v1 canon**, where the caller specifies width and
quality explicitly and the proxy does not sniff the device. It is recorded
as `O-open` at priority `P3`, parked until video scope opens. The Sovee
mechanism is not lost; it is held in suspense until the project decides to
implement adaptive delivery rather than offline packaging.

The full forward model also assumes a streaming/playback context where
bandwidth drifts mid-session — a problem v1 (offline packaging on
constrained devices) does not pose. Closing the open requires a
video-scope decision and a separate planning doc; a gate should sit
between.

---

## What's Already Canon (So We Did Not Re-Encode It)

Several things this conversation rediscovered are already canon, and the
discipline is not to duplicate. Listed so the next session sees the survey:

- **Patent US9565430B1 status, ownership, and IP framing.** Lapsed
  2021-02-07, public domain, assigned to Kingdom Site Ministries;
  protection is execution and AI-era framing, not IP; the overshoot trick
  was operator know-how never claimed in the patent. Captured in
  `canon/handoffs/2026-05-26-exploration-journal.md` and the matching
  encoding TSV.
- **The half-class overshoot and the byte-budget framing.** Fully canon in
  `canon/planning/2026-05-27-encode-resolution-arithmetic.md`. The rule is
  `ceil_to_mod16(min(target × 1.5, source × 1.5))` and the `source × 1.5`
  term is a runaway guard, not a source-as-ceiling invariant.
- **Per-axis perceptual leash.** Chroma long, color depth short (banding
  wall), resolution half-step ceiling, audio bit budget long, sample rate
  short. Encoded in `canon/encodings/2026-05-26-exploration-session.tsv`.
- **The video GOP/scene-detection triangle and scrub-snapping.** Operator
  know-how kept out of the original patent and now captured as Sovee
  learnings in the same encoding file. When video un-defers, this is
  prior art the project owns.

---

## Meta-Lesson — Reconstruction Diverges From Canon Until The Repo Is Read

An assistant designing from chat alone reproduced three specific
divergences from documented canon:

1. **Source-as-ceiling.** The first artifact treated source resolution as
   a clamping cap on the output rung. Canon explicitly rejects this: the
   byte budget is the ceiling, not source. This is the exact framing
   `encode-resolution-arithmetic.md` spends a section warning against,
   and matches bugbot's prior wrong "fix" in meta-lesson 6.
2. **Discrete resolution ladder.** The artifact used a fixed
   360/480/720/1080/1440/2160 ladder with a "bump one class" overshoot
   operation. Canon's rule is continuous arithmetic:
   `target × 1.5`, mod-16 ceil.
3. **Invented device/bandwidth/stutter triggers.** The artifact built
   feed-forward and runtime adaptation absent from v1, which is offline
   packaging, not adaptive streaming.

All three were corrected only after pointing oddkit at the repo.
Mechanism: pattern-matching backfills gaps with plausible-but-wrong
priors. Canon is the ground truth; reconstruction is a hypothesis at
best. The meta-lesson is identical to the bugbot one: external
pattern-matchers (including an LLM assistant operating without canon in
context) should verify against canon before encoding consequential
decisions.

Recorded as `L` in the encoding TSV.

---

## Handoff

The encoded `D`s require code follow-through:

1. **URL vocabulary update.** Document the numeric-`q` override in
   `canon/planning/2026-05-26-url-vocabulary-and-presets.md`, keeping
   presets as the named default. Worker: clamp 0–100, validate, map
   presets to numeric points (20/50/80 for images; audio already maps
   presets to bitrate/sample-rate combinations).
2. **Worker response contract.** Add the transparency echo headers
   (`X-Encode-Dimension`, `X-Bound-By`, `X-Quality`) to the image and
   audio response paths.
3. **Tests.** Add fixtures asserting `X-Bound-By` is correct under known
   inputs (byte-budget binding vs display-target binding vs source-guard
   binding).

The O-open is parked, not blocked. It does not require action this epoch.

---

## References

- Encoded rows for this session: `canon/encodings/2026-05-29-design-session.tsv`
- URL vocabulary and presets: `canon/planning/2026-05-26-url-vocabulary-and-presets.md`
- Encode resolution arithmetic: `canon/planning/2026-05-27-encode-resolution-arithmetic.md`
- Bugbot meta-lesson (companion to the `L` above): `canon/handoffs/2026-05-27-encode-arithmetic-wrong-turn.md`
- Exploration journal (the spine): `canon/handoffs/2026-05-26-exploration-journal.md`
