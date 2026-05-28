---
title: "MCP Tool Simplification, `s=` Shortest-Side Grammar, Demo Polish, and CI"
date: 2026-05-28
status: working
mode: handoff
derives_from: canon/handoffs/2026-05-27-demo-build-journey.md
---

# MCP Tool Simplification, `s=` Shortest-Side Grammar, Demo Polish, and CI

> A session that moved the project from "demo works, MCP server unverified" to
> "MCP server works end-to-end on every PR." Shipped three merged PRs (#14
> closed yesterday's work; #15 added the `s=` URL grammar key and rewrote the
> MCP tool as a pure URL builder; #16 added layered testing and per-branch
> smoke jobs in CI). Along the way: rewrote the render/peep matrix to be
> honest about source-bound encodes, paired stats to surface render
> resolution next to encode, and tightened the demo's defaults to one useful
> comparison instead of an overwhelming matrix. Bugbot caught two real bugs
> mid-flight; both are documented below as part of "what got right" because
> the system that caught them is now standing CI.

---

## Summary — From Working Demo to Verified MCP

Yesterday's handoff closed with a working demo and an MCP tool that nobody
had ever spoken JSON-RPC to. Today closes with the MCP server proven
end-to-end against a live preview on every PR, the proxy URL grammar
extended to carry the operator's actual mental model (`s=` shortest side),
and a render matrix that no longer lies about source-bound encodes.

Three PRs merged to main:

- **PR #15 — `feat(proxy+mcp): shortest-side s= sizing + simplify MCP tool to
  a URL builder`** — added the `s=` key to the URL grammar (canon followed),
  rewrote the MCP tool as a pure URL constructor with `viewport` as the
  primary input, made the demo dogfood `s=`, fixed the render-size bug that
  had `intendedDisplayBox` and the stat row computing different things, made
  pixel-peep mean "full encoded resolution" (no DPR math), extended the
  pixel toggle to Fit as a 2×2 matrix, and trimmed demo defaults to one
  useful comparison (320 shortest, webp, low + medium, true-size rendered,
  size-smallest sort).

- **PR #16 — `test(mcp): layered testing — unit + live smoke + client docs`**
  — extracted the MCP tool handler into a pure `buildToolResponse()` with 12
  unit tests, wrote `smoke-mcp.ts` as a no-mocks JSON-RPC client that hits
  `/mcp` over Streamable HTTP, added README docs for the MCP Inspector and
  Claude Desktop / Cursor / Claude Code, and rewrote `.github/workflows/ci.yml`
  to run typecheck + unit tests + two parallel smoke jobs (proxy + MCP)
  against the per-branch Cloudflare preview on every PR.

- Two Bugbot follow-ups merged with #15/#16: `fix(url): embed source URL raw
  so worker parser can recover it` (a real bug — the MCP tool was producing
  URLs the proxy's parser couldn't handle, because `generateTranscodeUrl`
  was percent-encoding the source URL into a form the parser's literal
  `http://` lookup couldn't find) and `smoke-mcp: derive preview URL from
  current branch` (polish — `bun smoke-mcp.ts preview` now reads the current
  git branch instead of being hardcoded).

The first end-to-end MCP verification this whole project has ever had
happened mid-session against the live preview deploy: `initialize`,
`tools/list`, `tools/call` for both image and audio all passed. That same
script now runs in CI on every PR.

---

## What Landed in Main

### `s=` (Shortest Side) Joined the URL Grammar

The proxy URL options now include `s` as the preferred sizing input. Because
phones rotate, a literal `w=` names an arbitrary axis — the stable "resolution
class" of an image is its **shortest side**. `s=720` carries the same
per-pixel quality whether shown 720 wide (portrait) or 720 tall (landscape).

The worker resolves `s` to a target width at request time using the measured
source orientation:

```
portrait or square (sourceW <= sourceH):  width = s
landscape          (sourceW >  sourceH):  width = round(s * sourceW / sourceH)
```

That width then feeds the existing half-class overshoot. Callers never
compute encode resolution — only the worker knows the true orientation at
request time, so the mapping lives there. `w=` remains available as an
advanced escape hatch and overrides `s=` when both are present.

Canon updated: `canon/planning/2026-05-26-url-vocabulary-and-presets.md`
gained an `s=` row in the image-options table and a new
"Shortest-Side Sizing (`s`)" subsection above the half-class section,
documenting the rotation rationale, the resolution formula, and the
`w` overrides `s` precedence.

Implementation:

- `src/lib/parse-proxy-path.ts`: accepts and validates `s=` (1..8192)
- `src/worker.ts`: resolves `s` via `shortestSideToWidth()` before
  `encodeDimension`. Bugbot caught that the passthrough guard also needs
  to include `!options.s` — an `s=`-only request was wrongly hitting the
  no-transform passthrough.
- `src/lib/generate-transcode-url.ts`: `s` in `ImageOptions`, plus a pure
  `shortestSideToWidth()` exported for the worker (and demo, as a
  display-only helper).

### MCP Tool Rewritten as a Pure URL Builder + Guidance

The previous version of the tool fetched the image through the proxy and
recomputed dimensions client-side. That was scope creep — the operator
called the smell ("doing new maths and stuff") and the draft got thrown away
uncommitted.

The shipped tool (`src/lib/mcp-tool.ts` + handler in `src/worker.ts`):

- Inputs: `source_url` (required), `media_type` (default `image`),
  `viewport` (primary — emitted as `s=`), `q`, `f` (no `avif` — gone from
  the product UI; the proxy grammar still accepts `f=avif` for direct
  callers), `w` and `h` (advanced escape hatch — `w` overrides `viewport`),
  `preset` (audio).
- Output: a JSON object with `proxy_path`, `full_url` (the worker uses
  `request.url.origin`), `embed` (`<img>` or `<audio>` snippet), `request`
  (echo of the inputs with defaults), and `guidance` (a substantial string
  explaining `s=`, the half-class overshoot, and embedding — folded in, no
  separate teach tool).
- No fetching. No client-side math. No async. The tool's job is to produce
  a correct URL and explain how to use it.

### Render-Size Math Got a Single Source of Truth

A latent bug shipped in the PR that added the "render" stat row:
`intendedDisplayBox` (which sizes the actual `<img>` and the corner note)
and `statRowsHtml` (the row beneath it) had **two different definitions of
"rendered" size**. The stat row capped at `encode / overshoot` (honest for
source-bound encodes); the display box scaled the encode up to the requested
`target`. For a source-bound encode (target 3840 off a 1024 source) the
display rendered the image at 4496×3840 — massively zoomed into a tiny
blurry slice — while the stat row correctly said 1024×875.

Fix: extracted `renderSize(e)` as a single shared function. Both consumers
call it. The image, the corner note, and the stat row now always agree.
This is the kind of duplication that wants a unit test, but the math lives
in the demo HTML which the test harness can't import as a module. Worth
hoisting to `src/lib/display-math.ts` next session so it can be guarded.

### Pixel-Peep Now Means Full Encoded Resolution

The previous peep mode divided the box by `devicePixelRatio`, making peep
*smaller* than rendered on retina screens — and whether that read as bigger
or smaller flipped around the 1.5× overshoot ratio, so it felt backwards
inconsistently across target sizes.

The shipped behavior (option A from the orient): peep shows the encode at
its **full encoded resolution** (1 encoded px = 1 CSS px) — always larger
than rendered by the overshoot factor, at every target size. No DPR math
anywhere in the box. Internal mode values renamed `css → rendered` and
`physical → peep` so the code stops lying about what it does; `?px=physical`
on legacy shared links still maps to peep on read.

### Pixel Mode Extended to Fit — Full 2×2 Matrix

The pixel toggle previously only applied in true-size mode. It now applies
in Fit too, with the text-locked invariant preserved across all images
within a mode:

- **Fit + Rendered** (unchanged): whole image scaled to fit a uniform card
  (`object-fit: contain`). All images identical on-screen size.
- **Fit + Pixel peep** (new): a uniform fixed window (`FIT_BOX`, 260×195,
  identical for every tile) crops the image shown at its full encoded
  resolution (1:1 encoded pixels). Same window + same pixel scale across
  every tile means on-screen text size stays locked regardless of the
  image's resolution. A higher-res encode just reveals a smaller fraction
  of itself; a lower-res shows more. The zoom is locked.

The compare popup honors the same matrix (full-encode 1:1 inside the fixed
`cmp-viewport` for fit-peep, with lockstep pan across panels).

### Demo Defaults Got Opinionated

A fresh load now shows a tight, useful comparison instead of an overwhelming
matrix. Defaults:

- Quality: **low + medium** (was all three) — side-by-side aggressive vs
  balanced compression at the same size
- Format: **webp only** (was webp + jpeg)
- Target: **320 shortest only** (was six targets)
- Render: **true size**, Display: **rendered** (unchanged)
- Sort: **file size, smallest first** (was bytes/pixel) — "which is
  lightest" reads instantly

Added `DEFAULT_QUALITIES = ['low', 'medium']` and `DEFAULT_FORMATS =
['webp']` constants and pointed the URL-state writer at them (rather than
"all checked"), so the common case still produces a short shareable URL —
params only appear in the URL when they deviate from the default.

### Stats Below a Photo Now Show Render and Encode

Showing only encode resolution was confusing — it's the ~1.5× overshoot the
proxy stores, not what the image displays at. Per-photo stats (grid tiles
+ compare panels, via shared `statRowsHtml`) now show a `render` row above
the `encode` row. Render size is derived from `encode / overshoot` so it
stays honest for source-bound encodes (target 3840 off a 1024 source shows
render 1024×875, not a fictional 3840×anything).

Scope kept to the per-photo stats per request; the dense sortable table
still has only its `encode` column.

### Layered Testing + Per-Branch CI

Before this session: 32 unit tests on the pure libs. Zero direct tests on
the MCP handler. Zero verification the MCP server actually spoke the
protocol.

After this session, every PR to main runs:

1. **`test`** — `bun install --frozen-lockfile` + `tsc --noEmit` +
   `bun test` (52 unit tests across 6 files, including the new
   `src/lib/mcp-tool.test.ts` with 12 cases on the handler — viewport →
   `s=` mapping, `w` overrides viewport, raw `w/h` without viewport, q/f
   passthrough, bare path, full response shape, audio passthrough, origin
   trailing-slash normalization, guidance content invariants).

2. **`resolve-preview`** — derives the per-branch Cloudflare preview URL
   from `github.head_ref` (slug rule: `/` → `-`, confirmed against
   Cloudflare's docs), then polls `/` until HTTP 200 so smoke jobs don't
   race the auto-deploy. 5-minute cap with 5s intervals.

3. **`smoke-proxy`** (parallel) — runs `smoke-test.ts` against the live
   per-branch preview, verifying canon worked examples (encode dimensions,
   bindings, file-size envelopes).

4. **`smoke-mcp`** (parallel) — runs `smoke-mcp.ts` against the same
   preview, exercising the real MCP JSON-RPC protocol over Streamable HTTP:
   `initialize` handshake, `tools/list` (schema advertises `viewport` +
   `q/f/w/h`), `tools/call` for image (viewport → `s`, `w` overrides),
   `tools/call` for audio. Now also fetches the constructed `full_url` and
   asserts the proxy doesn't 400/404 it — closes the gap that let Bugbot's
   URL-encoding bug ship.

Two parallel smoke jobs so a proxy regression vs a protocol regression
surface independently.

`smoke-mcp.ts` can also be run locally:

```sh
bun smoke-mcp.ts                 # production
bun smoke-mcp.ts preview         # current git branch (post-Bugbot polish)
bun smoke-mcp.ts <base-url>      # any deploy
```

README `## Testing` section documents the four layers, plus how to point
the MCP Inspector or Claude Desktop / Cursor / Claude Code at the deployed
`/mcp` endpoint.

---

## The Specific Things That Went Wrong

### 1. The Overcomplicated MCP Tool Draft

After locking three design decisions (viewport-primary, full URL + JSON,
fold guidance in), the first implementation **fetched the image through the
proxy and recomputed dimensions client-side**. The operator called the
smell ("doing new maths and stuff") and the draft got thrown away
uncommitted before any PR opened.

Lesson reinforced: a URL-builder tool that makes network calls is doing the
proxy's job for it. The proxy already owns the math by canon. The tool's
job is a string and an explanation. The cleanest sign of scope creep was
that the tool became `async` and started caring about response headers.

### 2. Pixel-Peep Felt Backwards — The DPR Trap

The first pixel-peep behavior divided the box by `devicePixelRatio`, which
made peep *smaller* than rendered on retina — but whether that read as
"smaller" or "bigger" relative to rendered flipped around the 1.5× overshoot
ratio. So peep felt wrong inconsistently across target sizes, and I
initially talked myself into a defense of the math before just trusting the
operator's eyes. Fix removed DPR from the box math entirely. The geometry
is now stable: peep is always bigger than rendered by the overshoot factor,
at every target size.

### 3. Two Copies of the Render-Size Math Drifted

When I added the "render" stat row, I duplicated the math from
`intendedDisplayBox` into `statRowsHtml`. Later, when I made the stat row
honest about source-bound encodes (`min(target, encode/1.5)` instead of
just `target`), I forgot to apply the same fix to `intendedDisplayBox`. The
two diverged and produced different numbers for the same entry: stat row
correctly said 1024×875 while the image rendered at 4496×3840 and the
corner note matched the wrong size. The operator caught it from a screenshot.

Fix: extracted `renderSize(e)` as the single source of truth. Standing
followup: hoist demo display math to `src/lib/display-math.ts` so this
class of "two copies drifted" bug becomes catchable by `bun test`.

### 4. The MCP Tool Was Generating Unservable URLs (Bugbot Catch)

`generateTranscodeUrl` was calling `encodeURIComponent` on the source URL,
producing paths like `/image/s=720/https%3A%2F%2F...`. But the worker's
`parseProxyPath` finds the source URL by searching for a literal `http://`
or `https://` prefix — the encoded form contains neither, so every URL the
MCP tool produced would 400. Unit tests asserted the encoded string form
directly, so they "passed" while testing a broken contract. The smoke test
only checked the string contents of `proxy_path`, never actually fetched
the URL. Bugbot caught it.

Fix (Bugbot's commit, accepted): drop the `encodeURIComponent`, update
tests to assert the raw form, which matches the demo's `buildProxyPath`
and the parser's documented contract. Follow-up I added: the MCP smoke
test now `fetch`es the constructed `full_url` and asserts non-400/404, so
this class of "tool grammar drifts from parser grammar" can't recur
silently.

### 5. Default Sort and Defaults Went Through Two Iterations

Initial default was a single tile (just medium). The operator said low +
medium would be more useful for comparison — correct, that's what the
default became. Sort default changed from bytes/pixel to file-size-smallest
in a separate small commit. Both were the right calls; the pattern is that
"one perfect default" is usually wrong because the demo's purpose IS
comparison — defaults should support that, not flatten it.

---

## What Got Right

### Three User-Decided Forks Got Asked, Not Assumed

Three places where the next move was genuinely ambiguous became
`ask_user_input_v0` calls instead of guesses:

1. **Pixel-peep behavior choice** — full encode resolution vs DPR-magnified
   vs simple 2× scale. Asking surfaced "try A, if I don't like it we can
   change it" — a real authorization with a real fallback.
2. **Fit-peep design** — same-box-with-zoomed-crop vs larger-uniform-box
   vs crisp-pixel-scaling. The "same box, locked zoom" answer drove a
   clean 2×2 matrix design with the text-locked invariant.
3. **Shortest-side binding location** — proxy grammar key vs tooling math
   vs defer entirely. The "add it to the proxy grammar" answer kept the
   math where canon says it belongs.

The cost of asking is one user turn. The cost of guessing wrong on a
geometry feature has been demonstrated repeatedly in the prior session.

### Throwing Away the Bad Draft Cleanly

When the operator said the MCP tool "smells bad," the response was `git
checkout` on the modified files, `rm` on the new file, and a clean
recompute from main. Zero attempt to salvage the work-in-progress. The
overcomplicated version had nothing worth keeping.

### Bugbot as Standing Reviewer

Bugbot caught two real bugs in this session — the passthrough guard
missing `!options.s` and the source-URL encoding mismatch. Both were
classes of bug my unit tests passed through. Both got fixed by Bugbot
pushing commits directly to the branch. The workflow of "rebase onto
Bugbot, verify, push" is now habitual. Standing CI from PR #16 means
Bugbot has a stable test suite to validate its fixes against.

### Live Smoke Test Caught the Test Gap That Let Bugbot Win

When Bugbot caught the source-URL encoding bug, the immediate question
was: why didn't my smoke test catch this? Answer: it checked the string
contents of `proxy_path`, not whether the URL was actually servable. Added
a `fetch(full_url)` assertion before pushing the rebase, so the test
suite now closes the gap that let the bug ship. Bugbot's catch became a
permanent improvement to the regression net.

### Canon-First Sizing for `s=`

The orient before adding `s=` flagged that callers do not specify encode
resolution (per the URL-vocabulary canon). That kept the design honest:
the new key is interpreted by the worker, with the existing `encodeDimension`
arithmetic feeding off the worker-resolved width. No new math anywhere —
just a pre-step that resolves the operator's mental model into the encoder
pipeline's expected input.

---

## Meta-Lessons for the Next Session

1. **A URL builder tool that makes network calls is wrong.** It's doing the
   proxy's job. If a tool becomes `async` and starts reading response
   headers, look for the scope creep before going further. The proxy's
   contract — measured-at-request-time, ~1.5× overshoot, mod-16, source
   cap — is the source of truth; tools point at it, they don't reimplement
   it.

2. **Unit tests on string contents miss "is this URL actually servable?"**
   The fetchability assertion in `smoke-mcp.ts` is a model: where a tool
   produces a wire format, the smoke test should exercise the wire, not
   just the format string. If the parser and the builder disagree, unit
   tests on either side can both pass while the system is broken.

3. **Duplicated math wants extraction immediately, not later.** Both the
   `intendedDisplayBox` / `statRowsHtml` drift and the demo's
   `shortestSideToWidth` / proxy's `s=` resolution were "two copies of the
   same idea." One drifted and shipped a bug; the other was caught only
   because the demo got moved to `s=`. Standing rule: when the same math
   appears in two files, the second one is a refactor.

4. **Trust the operator's eyes over the model's reasoning about geometry.**
   The pixel-peep "felt backwards" report was right. I burned two
   exchanges defending the math before just changing the behavior. The
   visual-truth-vs-model-truth gap is a real bottleneck — when the user
   is looking at the screen and saying "this is wrong," that's the
   strongest signal in the room.

5. **Standing CI lets Bugbot work.** Without `bun test` on every PR,
   Bugbot's fixes would be unreviewable — was the fix the actual fix?
   With the 52-test suite running automatically, Bugbot's commits can be
   trusted (and rebased onto) with confidence. The test suite is
   infrastructure for the reviewer.

6. **Opinionated defaults are about the demo's job, not about minimizing
   choices.** "One default" was wrong because the demo's job IS comparison.
   "Two defaults that compare against each other" is right. The constraint
   isn't "make it smaller" — it's "make the first thing the user sees
   demonstrate the actual point."

---

## Open Items at Session Close

These are things the operator flagged or that surfaced during the session
but were explicitly out of scope. None are blockers; they're standing
observations for the next agent.

- **Audio container path** — still passthrough. Worker accepts `preset` /
  `q` for audio and the MCP tool emits them, but the transformation
  doesn't run. Canon doc
  `canon/planning/2026-05-27-audio-container-recipes.md` is marked
  unverified.

- **Demo display math not unit-testable** — `renderSize`,
  `intendedDisplayBox`, `shortestSideToWidth` (display copy) all live in
  `src/demo-page.html` inside a `<script>` block. The parse-guard test
  ensures the script parses, but the math itself can't be unit-tested
  without hoisting it to `src/lib/display-math.ts`. The `renderSize`
  drift bug would have been caught by such tests.

- **Source-domain allowlist** — there is no allowlist on the public
  deploy. The proxy will currently transcode any URL. Fine for the
  current Bible-translation use case; worth thinking about before
  broader exposure.

- **Cache TTL** — proxy emits `Cache-Control: public, max-age=31536000,
  immutable`. Wrong for signed/expiring source URLs; probably fine for
  the offline-packaging use case but worth knowing.

- **Real MCP client not yet exercised against the deploy** — the smoke
  test exercises the same wire protocol Claude Desktop / Cursor / the
  Inspector use, but no human has pointed an actual client at `/mcp`
  end-to-end. README documents how when ready.

- **Dense sortable table doesn't show render** — by explicit scope. The
  per-photo stats show `render` and `encode`; the table view shows only
  `encode`. Easy to extend if the operator wants it later.

- **Aquifer integration** — `transcode-mcp` `?source=` URLs feeding the
  Aquifer image window (https://aquifer.klappy.dev/mcp,
  https://aquifer-window.klappy.dev/resource/UBSImages) is still a
  named-but-not-built integration. The MCP tool's guidance text mentions
  Aquifer-style image windows as a use case.

---

## Files Changed This Session

**Proxy + MCP server:**

- `src/lib/parse-proxy-path.ts` — `s` key in `ParsedImageRequest.options`,
  validated 1..8192. New tests.
- `src/worker.ts` — `s` resolution via `shortestSideToWidth` before
  `encodeDimension`; passthrough guard includes `!options.s`; MCP tool
  handler now delegates to `buildToolResponse`; threads `request` into
  `createServer` for origin resolution; version bumped to 0.3.0.
- `src/lib/generate-transcode-url.ts` — `s` in `ImageOptions`; new
  `shortestSideToWidth()` helper; **source URL no longer
  percent-encoded** (Bugbot fix — matched the parser contract).
- `src/lib/mcp-tool.ts` (new) — pure `buildToolResponse()` shared by the
  worker handler and the unit tests.

**Demo:**

- `src/demo-page.html` — emits `s=` (not `w=`) in `buildProxyPath`;
  dropped `getNaturalDimensions` pre-fetch; `shortestSideToWidth`
  demoted to a display-only helper; new `renderSize()` as single source
  of truth for intended display size; pixel-peep means full-encode
  resolution (no DPR); pixel toggle visible in both render modes;
  2×2 render matrix (true-size × rendered/peep and fit × rendered/peep);
  `.tile-image.fitpeep` CSS for the uniform crop window; opinionated
  defaults (q=low+medium, f=webp, target=320, sort=size-asc); URL-state
  default constants for q/f.

**Canon:**

- `canon/planning/2026-05-26-url-vocabulary-and-presets.md` — `s=` row
  in image options table; new "Shortest-Side Sizing (`s`)" subsection
  with rotation rationale, resolution formula, and `w` overrides `s`
  precedence.

**Tests:**

- `src/lib/mcp-tool.test.ts` (new) — 12 cases on the handler.
- `src/lib/parse-proxy-path.test.ts` — added `s=` cases.
- `src/lib/generate-transcode-url.test.ts` — added `shortestSideToWidth`
  cases (portrait / square / landscape / rounding / rotation invariance);
  updated raw-URL expectations (Bugbot fix).

**Smoke + CI:**

- `smoke-mcp.ts` (new) — JSON-RPC client over Streamable HTTP; covers
  `initialize`, `tools/list`, `tools/call` for image and audio; now
  includes a fetchability assertion on the constructed URL; preview-URL
  shorthand derives from current git branch (Bugbot polish).
- `.github/workflows/ci.yml` — rewritten: `test` → `resolve-preview` →
  parallel `smoke-proxy` + `smoke-mcp` against the per-branch deploy.
- `README.md` — new `## Testing` section documenting the four layers
  (unit, smoke, Inspector, real client) with config snippets.

---

## The Live Deployed System

- Production: <https://transcode-mcp.klappy.workers.dev/>
  - Demo page at `/` (and `/demo`)
  - MCP endpoint at `/mcp` (Streamable HTTP, JSON-RPC)
  - Image proxy at `/image/{options}/{source_url}` — `options` is a
    comma-separated subset of `s,w,h,q,f`. `s=` is preferred sizing.
  - Audio passthrough at `/audio/{options}/{source_url}` — `preset,q`
    accepted but not yet transformed.

- Per-branch previews follow Cloudflare's convention:
  `https://<branch-slug>-transcode-mcp.klappy.workers.dev` where
  `<branch-slug>` replaces `/` with `-`. The CI workflow uses this
  convention.

- CI: every PR to main runs `Test & Type Check` →
  `Resolve preview URL` → parallel `Smoke — proxy (canon worked examples)`
  and `Smoke — MCP protocol (JSON-RPC over /mcp)`. All four jobs visible
  on the PR's Checks tab.

- Local verification:

  ```sh
  bun install
  bun test                                # 52 tests
  bun run typecheck                       # tsc --noEmit
  bun smoke-mcp.ts                        # against production
  bun smoke-mcp.ts preview                # against current branch's preview
  bun run smoke-test.ts                   # proxy canon examples (needs WORKER_BASE_URL)
  ```

The system is in the most verified state it has ever been in. The next
session inherits a passing test suite, a live MCP server proven by every
PR's smoke run, and a demo that demonstrates the proxy's actual purpose
on first load instead of overwhelming the visitor with combinations.
