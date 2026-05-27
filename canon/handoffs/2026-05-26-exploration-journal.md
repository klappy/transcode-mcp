---
title: "Session Journal — Media Transcoding Proxy, Exploration Session 1"
audience: journal
date: 2026-05-26
mode: exploration
status: complete
project: media-proxy-mcp
operator: Christopher Klapp
---

# Session Journal — Media Transcoding Proxy, Exploration Session 1

## What this product is

A media transcoding proxy — conceptually "Sovée Transcribr for the AI world."
A proxy that transcodes media into the right filesize for its intended delivery
context, at the best quality achievable for that budget. Two control surfaces:

- **Automagic GET-param URL** — pass a media URL plus a few options as query
  params; drops into an `<img>`/`<audio>` tag with zero integration. This is the
  primary surface and the product's identity. It must stay sacred.
- **MCP layer** — the same parameter vocabulary exposed to an LLM caller, so an
  LLM can drive and optimize transcoding on a user's behalf. The LLM is not a
  privileged caller; it is a smart caller using the public parameters well.

## IP status (resolved)

Original patent **US9565430B1** ("Apparatus and method for video encoding and
transcoding system"), priority 2011-12-15, granted 2017, lists Christopher Klapp
among inventors, assigned to Kingdom Site Ministries. **It lapsed 2021-02-07 for
non-payment of maintenance fees and is expired.** Its teachings are public domain
— free to reimplement, no licensing/infringement risk, but also no enforceable
monopoly. The "resolution overshoot" trick was never claimed in that patent; it
was operator know-how. Protection now comes from execution and AI-era framing,
not from IP.

## The core method (this is the spine of the product)

**One principle:** Find the perceptual axis the human under-samples — and the
content the human won't scrutinize — and spend nothing there. Pour the entire
budget into what will actually be looked at and listened to.

### Half-step resolution overshoot (images + video)

Overshoot the delivery target's expected resolution class by a HALF step, not a
full class. 480p → 540p; 720p → ~960p — the intermediate resolutions consumer
devices were never sold at. Encode at the half-step-up resolution, hold the
bitrate/byte budget to the lower (expected) class floor, scale down on display.
The downscale acts as a low-pass filter that averages away compression
artifacts. The half-step is the CEILING — a full class up starves the bitrate so
badly the higher-res encode degrades before it can scale.

### Per-axis perceptual leash

Every perceptual axis has a different "leash" — how far you can degrade it before
a human notices. Push each to just short of its own breaking point:

- Chroma subsampling — long leash, push hard (eye under-samples color resolution)
- Color depth — short leash, banding is the hard wall, reduce only gently
- Resolution — half-step ceiling
- Audio bit budget — long leash
- Audio sample rate — short leash, floored to content's true frequency range

### Confetti perceptual triage

Some content is incompressible (confetti: thousands of tiny high-frequency
independent moving objects). Don't spend budget fighting content that will be
lost regardless. Protect what the eye scrutinizes (faces, text, edges, logos);
let the unwinnable content blur. Winning vs same-bitrate competitors comes from
not losing the frames that matter, not from winning the confetti frame.
NOTE: automatic content-aware triage is adaptive, NOT a static preset, and is the
hardest/most-valuable piece — plan it as more-than-a-preset.

### Audio method

Sample rate and bit depth are different kinds of knob. Sample rate sets the
frequency ceiling — cut it and you delete top octaves outright (audible loss).
Bit budget sets the noise floor — cut it and you raise a hiss that stays buried
on a forgiving playback chain. So: protect sample rate, spend bit budget. In a
modern codec (Opus) this is "hold the codec's internal bandwidth mode, lower the
bitrate." Match codec + channel layout to content before touching quality.

## Decisions locked

1. **V1 scope:** images + audio. Video deferred (needs async/queue; fast-follow).
1. **Two audio presets:** voice and music. No dynamic per-request dials. Voice =
   mono, low frequency ceiling, low bitrate. Music = full ceiling, stereo when
   source has it, bit budget cut only as far as inaudible. A preset is a named
   bundle; more can be added later as entries.
1. **Target playback chain = cheap Android phone.** This licenses aggressive cuts.
   Honest promise is "imperceptible on the target chain," not "lossless."
1. **Target-class resolution ladder:** explicit param wins → auto-detect from
   request headers (User-Agent, Save-Data, Client Hints) as floor → LLM is a
   smart explicit caller. One parameter vocabulary, three ways to populate it.
   For images the strongest driver is display box size (viewport × DPR × layout),
   not device screen resolution.
1. **Borrow, don't invent:** adopt existing accepted encoding recipes (Opus voice
   config, compressive-image recipes, MozJPEG/WebP/AVIF presets, chroma defaults).
   At pick-time this is a search-and-verify step, not from-memory — the image
   codec landscape shifted recently (AVIF, JPEG-XL); verify currency before adopt.

## Open items / caveats for planning

- Client Hints require server `Accept-CH` advertisement; network hints (ECT,
  Downlink) have patchy support. Device class (User-Agent) and data-saver intent
  (Save-Data) are reliable; live bandwidth class is a weaker signal.
- Content-aware confetti triage is the part that exceeds a preset — plan honestly.
- Audio voice/music: caller flag is primary; spectral auto-detect is the floor.

## Video-deferred — GOP / scene-detection triangle (operator know-how)

Captured for the future video session. The video equivalent of perceptual triage
is NOT content understanding — it is re-weighting the encoder's existing
scene-change machinery. Deliberately kept out of the original patent to prevent
reverse-engineering. Three controls in tension:

1. **GOP cap, absurdly long** — ~900+ frames, ~30s max between I-frames. No fixed
   keyframe interval. Static shots run the GOP full-length; P-frames diffing a
   near-still picture are nearly free. Starves I-frames where nothing happens.
1. **Scene-change sensitivity, high** — low threshold so a genuine cut forces an
   immediate fresh I-frame. Fixed-GOP encoders smear right after a cut (new
   scene's P-frames diff against a picture that no longer exists). Redrawing ON
   the cut keeps scene changes sharp.
1. **Motion/object-detection window, enlarged (coarsened)** — the most-missed
   control. If sensitivity is high AND the motion window is fine-grained,
   ordinary within-scene motion trips the scene-change trigger and forces endless
   needless I-frames — worse than fixed-GOP. Coarsening means local motion in a
   stable scene does not read as a scene change, but a true cut still does.

**The craft is the triangle, not any single number.** Tune one without the
others and it breaks. At video pick-time, verify how a modern encoder
(x264/x265/SVT-AV1) exposes these — keyint, scenecut sensitivity, motion
estimation granularity — and confirm current best-practice values.

## Images — content-class routing (v1-relevant outcome of the video discussion)

For still images, per-region triage is largely the codec's own job (AVIF, WebP,
MozJPEG rate-control already spends bits on complex blocks). Our version of the
"cheat" for v1 images is **whole-image content-class routing**: a cheap global
signal (complexity / color histogram) routes the job to the right preset —
**photo** vs **graphic/screenshot**. Photo tolerates aggressive chroma
subsampling; graphic/screenshot needs sharp edges and hates chroma cuts on
colored text. This mirrors the audio voice/music preset pair and the same
precedence ladder (explicit param wins, auto-detect is the floor, LLM is a smart
caller). Candidate v1 image presets: photo, graphic.

## Control the character of the loss (the confetti principle, resolved)

The deepest principle of the session. The Sovée "confetti test win" was
**relative, not absolute** — Sovée confetti was never as sharp as the
uncompressed source (impossible at low bitrate), but at the same bitrate it read
as cleaner and more natural than any competitor's.

Why: a competitor encoding at the expected resolution into a starved bitrate
produces **blocking** — hard square DCT-block artifacts the eye reads as
"broken." The half-step overshoot encode at the same byte budget pushes artifacts
to a finer grain; the downscale-on-display then low-passes them, yielding **soft
blur** instead of blocking. Same information loss, opposite perceptual verdict:
the eye reads soft blur as natural (motion blur, depth of field) and reads
blocking/ringing/banding as broken (nothing in nature has hard square edges).

**Principle:** when quality must be lost, control the *character* of the loss —
degrade toward what the eye reads as natural (blur, softness), away from what it
reads as artificial (blocking, ringing, banding). This is the per-axis leash one
level up: not just which axis to spend, but ensuring the failure mode itself
looks natural.

## Scrub-snapping — emergent, conditional (video-deferred)

Long GOP → scrub lands on nearest I-frame → sensitive scene detection clusters
I-frames at cuts → scrubbing snaps to scene boundaries. A pleasant UX behavior,
discovered by accident and kept deliberately ("a bug rebranded as a feature").
But conditional: snapping only happens on cut-heavy content. On continuous
content (long handheld shot, slow pan, security feed) the same long GOP gives no
snapping — sparse scrub with ~30s dead zones. Do not promise snapping as a
guaranteed feature; scrub-granularity cost on continuous content is the tradeoff.

## Meta-note for planning — verify, don't just remember

Across this session several operator memories generalized one notch too far in
the retelling, and the *precise* version was consistently the better engineering
story: "one full class" → a half-step; "1/30th the file size" → freed ~1/3 of the
budget; "never failed confetti" → contained it / degraded gracefully; "intelligent
snapping" → content-conditional. The memories are real and valuable but are ~15
years old and condition-dependent. **Every recipe and setting is verify-then-adopt
at planning time, not remember-and-implement.**

## Bounded two-pass VBR — the confetti principle, final corrected form

This supersedes the loose "don't spend budget on confetti" framing above. The
assistant earlier mischaracterized "confetti is unwinnable, don't waste budget"
vs. "VBR spent more on confetti" as a contradiction — that was wrong. Multiple
constraints balanced against each other is constrained optimization, not a
contradiction; both statements were always compatible.

VBR at Sovée was never unbounded. It is a **bounded system, four parts**:

- **Target average** — the bitrate the whole file must land on.
- **Ceiling** — the most any single moment may spend.
- **Minimum** — the floor calm scenes won't drop below.
- **Rolling average** — the running constraint keeping local spend honest
  against the target as the encode progresses.

Difficult scenes (confetti) spend up toward the ceiling; calm scenes settle
toward the minimum; the rolling average forces the trade-off so the file still
hits target. Nothing is "robbed" — both serve one global average and the bounds
make runaway spend impossible by construction.

**Two-pass** makes allocation predictive, not reactive: pass 1 maps where
difficulty is across the whole file; pass 2 allocates deliberately, able to give
confetti more *because it already knows* there's enough calm content elsewhere to
take it back. Single-pass guesses; two-pass solves with the answer key in hand.

Final form of the confetti principle: not "starve confetti," not "feed confetti"
— let the bounded, two-pass-informed VBR system spend where difficulty genuinely
is, while the bounds guarantee the file hits its target average. Confetti gets
what the global solution says it can afford.

Planning note: bounded VBR (capped/constrained VBR) and two-pass are standard,
well-supported encoder features — borrow-don't-invent. The judgment to carry
forward is where the bounds sit relative to the target average.

## Two-pass as the content-understanding layer (architecture)

Two-pass is not a VBR feature — it is the layer the whole system sits on.

**Pass one = analysis.** A fast, deliberately *targeted* content-profiling pass —
not thorough, focused: tuned to be as quick as possible while still measuring
what matters. Builds a profile of the source — difficulty map, real scene
boundaries, presence/absence of features (high-frequency detail, color vs.
grayscale, true stereo vs. mono, meaningful motion, audio frequency content). The
craft is in *what* pass one chooses to measure and how much it refuses to do, so
it stays cheap.

**Pass two = intelligent compression.** Acts on pass one's profile. Several
consumers of the same profile: VBR bitrate allocation; deliberate I-frame
placement at known scene boundaries (not reacting to a live detector); and **work
elimination** — skipping machinery for features pass one found absent. Don't do
what isn't needed. The first pass earns the right for the second to be lazy where
it's safe; cycles and bytes not spent on absent problems go to the real ones.

**Consequence:** the earlier "content-aware confetti triage is more-than-a-preset,
a separate hard problem" worry is resolved — triage is just another thing the
first-pass profiler measures. The architecture absorbs it.

## The unifying shape

Every method in this session is one principle seen repeatedly: **no single knob
is the trick — the system of constraints is the trick.** Half-step overshoot,
per-axis leash, control-the-character-of-loss, the GOP triangle, bounded VBR, the
two-pass architecture — all the same shape. Six views of one idea.

## Open question for planning

Was the first-pass profile ever persisted/reusable? Not confirmed — may have
faded, or may never have existed (the original system encoded a file once and had
no reason to persist). For a proxy that may re-encode one source for multiple
delivery targets, analyze-once-reuse-many is a live design choice. Decide it
deliberately at planning; don't assume from Sovée precedent.

## Sovée production infrastructure (historical — the scaling architecture, NOT v1)

**Firm (operator stated with confidence):** A queue-and-worker architecture —
request arrives, job is queued, a pool of workers pulls from the queue. Workers
auto-scaled with demand. A mixed fleet — some bare-metal, some virtual — behind
load balancing. Outputs stored in Amazon S3. First pass and second pass ran
sequentially **on the same worker**, and the first-pass profile persisted into
the second pass within a single job. *(This resolves the earlier open question:
within one job, the profile WAS reused pass-to-pass.)*

**Hypothesis (operator explicitly uncertain — "I think," "I don't remember"):**
Multiple presets / output transcodings may have run together in one request with
a large core allocation ("all nine transcodings" at once), and the first pass
*may* have been shared across those outputs. Worth pursuing — it's architecturally
sound: the first pass profiles the *source*, which is identical regardless of
target, so profile-once + run-N-second-passes falls straight out of the two-pass
model. But it is a hypothesis to verify at planning, not a Sovée fact.

**V1 scope flag:** The Kubernetes / worker-fleet / autoscaling picture is the
*eventual* scaling architecture, not the v1 shape. For v1 (images + audio, video
deferred) images transcode synchronously in-request with no queue, and audio is
light enough to likely do the same. The fleet is the answer to video and to
scale — both deferred. Building it before there's load would be premature
machinery. Record it as "scaling architecture, when needed."

## Reference architecture — Cloudflare, modeled on klappy/ptxprint-mcp

The platform is Cloudflare, and the reference is the operator's own
`klappy/ptxprint-mcp` (reviewed live — README + ARCHITECTURE.md). The pattern maps onto
the transcoder almost 1:1.

**The pattern.** One thin Cloudflare Worker, one Container image, Durable Object
bindings, R2 buckets. "One MCP. One image. One repo." No queue, no dispatcher
service. The Worker parses the request (GET-param URL + MCP tools), validates,
computes a sha256 of the canonicalized payload, and either returns a cached R2
URL or dispatches to the Container via a service binding + `ctx.waitUntil()`.
The Container holds all the heavy work — for PTXprint, XeTeX; for us, ffmpeg +
codecs. One ffmpeg image covers images, audio, and video. Durable Objects hold
per-job state, one per `job_id`, polled via a status tool. Two-step async:
submit returns a `job_id` immediately, status is polled, nothing blocks.

**Pure function + content-addressing — the key idea.** PTXprint is treated as a
deterministic pure function; output is content-addressed by payload hash;
re-submitting an unchanged payload returns the cached URL with no run.
`transcode(source, preset, target)` is *also* a pure function. So the transcoder
gets content-addressed caching for free — and the cache *is* the performance
story. The automagic overshoot URL hashes to a key; first hit transcodes, every
later hit is a fast R2 fetch. Expensive work happens once per unique
(source, settings) pair, ever.

**Vodka-faithful, confirmed.** ptxprint-mcp's tool surface went 17 → 7 → 4 (now 6)
by removing domain opinions that had drifted into server code. The transcoder
follows the same split: thin Worker, ffmpeg sealed in the Container, recipes as
*data not code*. The spec must enumerate the boundary ("what the Worker knows /
does not know / is not") first — ptxprint-mcp attributes its own early sprawl to
an implicit boundary.

**Video — position corrected.** Video was earlier deferred because it seemed to
need async queue/fleet machinery that would have to be built. ptxprint-mcp proves
that machinery already exists and the operator has already built it once (a
~30-minute PTXprint job runs in a Container, DO status, two-step async, no
queue). Video transcoding is the same shape. So the *architectural* reason to
defer video is gone. Updated position: **build the architecture for images +
audio + video from day one** — it costs nothing extra, it's the same system — but
v1 may still **ship images + audio first** by enabling only those media types on
a video-ready architecture. Video is now a *launch* decision, not an architecture
decision.

Two real video costs remain, kept honest — **corrected:** the first cost was
earlier overstated. Streaming transcode means video does *not* break the
automagic-URL promise. ffmpeg writes output progressively; the Worker streams the
response from R2 as the Container writes to it, so playback begins on the opening
chunks while the tail is still encoding (chunked response, no fixed
Content-Length — a player doesn't need total size to start). Because video is
seekable, the source can be chunked and the front transcoded first. So video on a
cache miss has a *short first-segment delay*, not a "can't use a URL" problem —
the viewer waits seconds to start, not minutes to finish. All three media types
still work as "put a URL in a tag"; images/audio return complete-and-cached,
video streams-while-transcoding. The operator did this at Sovée 15–17 years ago.

What genuinely remains: (1) ffmpeg-on-video compute is materially more expensive
per job — streaming changes *when* bytes are available, not how much CPU burns;
content-hash caching softens it but the cost curve differs. (2) A new nuance
streaming introduces: a not-yet-complete transcode is harder to content-address
and cache cleanly, because the cache entry is written as it's read. Pure-function
caching still holds, but the job now has three states the Durable Object must
track — in-flight/streaming, partially-available, done/cacheable. PTXprint-MCP
didn't need this (a PDF is atomic). Flag for planning; don't solve now.

**Also worth carrying from ptxprint-mcp:** co-locating code + governance KB in one
repo to prevent drift; "ask the live deploy, don't trust hand-maintained lists";
and three failure modes, not two — hard / soft / success, where a soft failure is
a degraded-but-present output caught by structural checks.

## The GOP triangle DOES port to images (correction)

Earlier the journal/session treated the GOP/scene-detection triangle as
video-only ("for images, nothing"). That was wrong — it pattern-matched "still
image = no time axis = no GOP." The GOP's real lesson was never about time: it is
about matching granularity/effort to local content complexity, and structuring
output coarse-to-fine. Both are spatial ideas too. Two distinct image analogues:

**Variable block size** — the spatial version of the scene-detection triangle.
JPEG is fixed at 8×8 DCT blocks (no knob), but modern formats (AVIF, HEIC,
AV1-based image formats) use quadtree variable block sizes: large blocks over
smooth regions, small subdivided blocks over detail. That *is* "fine granularity
where complex, big cheap blocks where flat." Design consequence: a concrete
reason to pick a modern block-partitioned format over baseline JPEG.

**Progressive scan passes** — the still-image version of I-frame/P-frame layering
*and* of streaming delivery. JPEG, JPEG-XL, and PNG support progressive
encoding: coarse-to-fine scans. Scan 1 is a blurry whole-image "keyframe"; later
scans refine it. Same property as streaming video transcode — the decoder renders
a usable image from early scans before the rest arrives.

Revised scorecard: the GOP triangle ports to images *twice* (variable block
partitioning; progressive scan structure). For audio its analogue is "let Opus
VBR spend bits on transients, coast through steady passages and silence."

## The v1 image target — a (resolution, byte ceiling) pair

The image transcoder's target is not a single number. Like video, it is **both
a target resolution and a target file size**, solved in order:

1. **Resolution first.** The target resolution comes from the display box (via
   the precedence ladder — explicit param wins, viewport/DPR client hints as the
   floor, LLM as a smart caller), then overshot a half-class. If the source is at
   or below that resolution (e.g. a 240×320 image), resolution is effectively a
   no-op — only the overshoot applies. If the source is larger (e.g. a 10 MP
   photo), resize to the overshot target *first* — do not just compress a 10 MP
   image harder until it fits; that blocks up. Resize, then converge.
1. **Quality second.** The encode-measure-adjust loop tunes quality — the free
   variable — to land just under the byte ceiling, at the already-chosen
   resolution.

So: byte ceiling is the convergence target; target resolution is a co-equal
input decided first; quality is what the loop moves.

### The half-class overshoot has three independent justifications

1. **Artifact cleaning** — encode finer, downscale-on-display low-passes blocking
   into soft blur.
1. **Display-box match** — encode to the delivery target's display box.
1. **Zoom/interaction headroom** — a phone screen isn't fixed; users pinch-zoom.
   Encoding exactly to the display box means the first zoom hits upscaling blur
   with no pixels in reserve. The half-class overshoot is the zoom buffer — a
   modest zoom draws on real pixels.

Worked example: a retina phone reporting a ~1080p/2K display box. Full-class
overshoot → 4K, which starves the bitrate so the high-res encode degrades before
it scales. Half-class → ~3K: enough to survive the downscale *and* absorb a
modest pinch-zoom, without 4K's bitrate starvation at the same byte ceiling.
"~3K not 4K" is the half-class rule working. Three independent reasons converging
on one value is strong evidence it's right — the best-supported decision in the
method.

Honest boundary: the overshoot buys *modest* zoom only — a small pinch, a slight
crop-in. Not a substitute for a genuinely high-res asset. The honest claim is "a
phone can zoom in a little and it's not a terrible experience," not "zoom is
free."

## Content-addressed R2 storage as the cache layer

The proxy's storage strategy is content-addressed R2 — and the oddkit canon
explicitly endorses this as the *only* acceptable form of caching. The
`anti-cache-lying` constraint (tier 1, from the Foundational Axioms) rules out
TTL caching of derived/mutable content as "cache lying" — serving a past
observation as current truth — proven by the Feb 2026 oddkit Stale-Cache
Incident. But it endorses content-addressed storage without reservation: when the
key *is* the identity of the content, the cache cannot lie.

`transcode(source_bytes, preset, target)` is a pure function — same inputs,
byte-identical output, forever. So the strategy is clean: the R2 object key is
`sha256` of the canonical input tuple — the source's own *content hash* (not its
URL; URLs change while content doesn't) plus the normalized parameters (preset,
target resolution, byte ceiling). Worker computes the hash, checks R2; on a hit
it streams bytes back with no Container spawn; on a miss it transcodes once and
writes to that key. Same pattern ptxprint-mcp uses.

Three wins: **money** — Container compute collapses to once-per-unique-job, a
popular image transcodes one time then costs only R2 reads; **time** — a hit
skips the Container entirely, a millisecond R2 fetch; **space** — because the key
is the source's content hash, two URLs pointing at the same bytes dedupe to one
stored output. Content-addressing is free deduplication. The only valid "flush"
is garbage-collecting cold objects via R2 lifecycle rules — hygiene, never
correctness.

One honest caveat for planning: hashing the source means *reading* the source
bytes. Trivial for small images; for a large source the Worker must either
fetch-and-hash before it can check the cache (a read even on a hit), or use a
weaker identity proxy (origin ETag, or Content-Length + Last-Modified) — faster
but able to lie, since an origin can change bytes without changing those headers.
The canon pushes hard toward hashing actual bytes. Planning decides this
deliberately; it's the one place the content-addressing story has a genuine cost.

## Source identity — ETag fast-path over a sha ground truth (resolved)

The earlier open question — hash the source bytes, or trust origin headers — is
resolved. ETag and content-hash aren't competing; they're layered, and the order
is the point. This matches Sovée practice (ETag used, but sha likely verified by
download first).

- The **content hash** (sha256 of source bytes) is the canonical key and the
  ground truth, established by download-and-hash on first encounter.
- The **origin ETag** is the fast-path check: on later requests, check the ETag
  cheaply; if it matches the ETag recorded alongside the stored sha, serve from
  the sha-keyed object without re-downloading.
- Any ETag miss or absence falls back to download-and-hash.

This satisfies `anti-cache-lying`: the key still *is* the content's sha; ETag
just spares re-observation. A *bare* ETag strategy (ETag as the key, never
hashing) would be cache-lying — an ETag is the origin's claim and can be reused
across changed content. "Hash once honestly, then use ETag to confirm" is not a
lie.

### Deterministic-shortcut policy

Operator stance: "I'm fine at any deterministic cheating, and when we have issues
iterate." Stated as a rule: a shortcut is acceptable when (1) it is
*deterministic* — same input, same result, no hidden time-dependence — and (2)
its failure mode is *observable* — it fails loudly enough to detect and iterate
on. ETag-as-fast-path qualifies (a wrong result is a visibly wrong transcode for
a known URL). A TTL cache does not (its failure is silent — "nobody noticed for
days"). Not in tension with the canon — it's a pragmatic reading of the same
principle.

Rider, so "iterate later" stays honest: it only works if issues are *visible*.
The shortcut pass applies only when the failure mode is observable. A
deterministic-looking shortcut whose breakage would be silent does not get the
pass — trace the actual failure mode before granting it.

## Next session

Exploration has converged — the concept, the reference architecture, and the
storage/identity strategy are all settled. Next session shifts to **planning**:
the enumerated Worker/Container boundary, request flow, the exact parameter
vocabulary, the MCP tool surface, the recipe-as-data format, and the v1
images+audio build plan on a video-ready base.
