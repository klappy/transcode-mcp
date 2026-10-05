---
title: Video showcase — whole-page information hierarchy
date: 2026-10-05
status: accepted-for-implementation
---

# Whole-page partner comparison — replacement contract proposal

Patterned on recorded Product/Design lens methods; not a human owner's words or endorsement. Supersedes the earlier narrow player-only YES as any claim of whole-page acceptance. This proposal was recorded before the product code changed.

## Product decision

The visitor came to watch the same resource at useful delivery sizes. The current page repeats that invitation in the hero, a second introduction, three section introductions, card captions, a three-step infrastructure explanation, timing tiles, a second field-use story, a calculator and a technical evidence block. Those sections ask the visitor to read the case before seeing the case. Native players fixed one local problem; they did not fix this information hierarchy.

Primary journey: see recognizable scene → play a comparison → compare its visible picture and file size → consider the middle size. One action type dominates: native Play. This page does not need a signup, download chooser, preset configurator or extra CTA.

## Exact visible replacement copy and order

Keep the existing compact site navigation and style language. No new visual system. Remove the large two-line marketing hero and the second introduction. Use one compact introduction:

**H1: Same video. Less to carry.**

“Compare five versions of the Jordan River resource. Play a pair, then weigh the picture against the file size.”

Proceed directly to the first pair; no status badge, slogan pill, numbered eyebrow or extra call to action between the introduction and videos.

### 1. 720p, 89% smaller

Two equal players side by side on laptop, source first; stack in that order on phone.

- **720p source** — native player — **49.85 MB**
- **Optimized 720p** — native player — **5.51 MB · Stereo**

One result line: “The same resolution, 44.34 MB less per video.”

No repeated paragraph explaining that the videos are the same source. No “HQ,” “Large,” “REFERENCE,” sequence index, raster dimensions or encoding time in the visible card. Resolution is already in the title. Keep exact measurements bound to data; rounded visible values must be derived, not separately maintained.

### 2. 224p and 480p. Nearly the same size.

Two equal players; compact first.

- **Existing compact version · 224p** — native player — **2.55 MB**
- **Optimized 480p** — native player — **2.56 MB · Mono**

One result line: “480p uses 0.64% more space in this example.”

Do not claim that resolution alone proves quality or that this one compact file represents industry practice. The videos themselves let the visitor inspect the difference. Remove the extra explanatory paragraph and repeated caption under each player.

### 3. A middle size

One player at the same useful maximum width as a comparison player, without the oversized half-page promotional text panel.

- **Optimized 540p** — native player — **3.20 MB · Stereo**

One result line: “A smaller file than 720p, with stereo audio.”

Do not call this an objectively “balanced choice” or a universal optimum. Do not repeat Small/Medium/Large terminology when the visible resolution already distinguishes the options.

### Footer and optional detail

One quiet attribution line remains visible: “Jordan River video by Word Collective · CC BY-SA 4.0. Optimized versions are adaptations.” Link the license. A small “About FIA Guide” link may share this line; it must not compete with the players or imply automatic offline installation.

Then two collapsed disclosures, neither open by default:

1. **How this was measured** — exact current file bytes, raster, duration and channels in one concise table; encoding and delivery timings in a separate labeled table; one short explanation that verified files are stored in R2 and served through Cloudflare. Label encode time, first full request and cached full transfer separately. Network varies. No progressive-encoding or geographic edge-cache claim. Include source review/provenance links. Historical CI/0.4 details should be a labeled linked record or nested history disclosure, not a raw JSON paragraph. Keep current/historical identities separate.
2. **Estimate storage for a longer collection** — retain the existing minutes calculator only here, with its one necessary caveat: “An estimate from this clip, not an available offline pack. Other videos compress differently.” Preserve the named-map comparison and optimized-map caveat in this disclosure or linked evidence, not a second visible narrative section. This retains useful field context without making it a hurdle before playback.

Error text only appears on actual failure: “This video could not be loaded. Try the player again.” Avoid implementation commentary about alternate sources in the main journey. Do not silently add a fallback route.

## Disposition of every existing text group

| Existing group | Disposition |
|---|---|
| Brand and existing site navigation | Keep compact; current destinations unchanged |
| FIA eyebrow, “Take the story / Leave the weight,” long intro, standalone Explore link | Replace with the single H1 and sentence; move FIA link to quiet footer |
| “Keep the detail / Choose the size,” repeated comparison paragraph, Context pill | Remove; duplicate invitation |
| Verified production / press Play status strip | Remove from happy path; qualification is a release gate, not visitor work |
| Numbered pair eyebrows, pair titles and paragraph intros | Replace with one outcome-led heading per section |
| Card indices, REFERENCE/OPTIMIZED DELIVERY labels | Remove; duplicate card title |
| Card names | Use the five exact neutral labels above |
| Card bytes | Keep prominent, one display per card |
| Duplicate raster and channel row | Remove repeated raster; retain mono/stereo beside bytes where relevant |
| Card captions | Remove; repeated explanation, preserve unique facts in details |
| Per-card encode proof rows | Move to timing table in collapsed details |
| Pair outcome lines | Keep one concise measured outcome per pair |
| 540 large promotional panel, “middle option” pill and long explanation | Replace with compact third section and one result line |
| R2/Cloudflare three-step cards, encoding/cold/cache metric tiles and caveat | Move to one optional technical disclosure |
| Offline field-story heading and paragraphs | Remove from default page; compact context in optional calculator |
| Named source-map comparison | Preserve with its limitation in optional details, not the viewing path |
| Calculator | Keep collapsed, with one precise scope caveat |
| License and creator | Keep visible one-line attribution; full provenance in details |
| Exact source IDs, hashes, commit/version, historical evidence | Preserve behind optional details/links, never visible status or raw JSON dump |
| Closing “compare then decide” footer | Remove duplicate instruction |

## Layout and acceptance

Use the existing dark palette, typography, native controls and matched posters. Reduce vertical spacing created for removed prose; do not compensate with another oversized hero or decorative card. Both first players must begin within the first1280×800 screen; the first recognizable player must begin within the first390×844 screen. No fixed-height text blocks or empty reserved status row. Native metadata loading is normal; no autoplay. Keep one playing video at a time.

Before final acceptance, inspect the **entire page** at390×844 and1280×800, both disclosures closed and open. Review every visible string and section—not only player crops. Confirm all five remain discoverable in the required order, controls and bytes are readable, no horizontal overflow, no evidence loss, no duplicated explanatory blocks, and technical/history content does not dominate when expanded. Walk Play/seek/pause-other and disclosure keyboard access. Physical iPhone/fullscreen behavior, acoustic quality and live media transport remain separate scopes.

Current verdict: whole-page HOLD pending this reduced-information candidate and complete before/after renders. Earlier player-only YES remains historical evidence for the embedded-player mechanism, not whole-page approval.

## Driver’s-seat delta and implementation boundary

The operator explicitly expands the correction from the player to every line, section and layout. One page must support one comparison journey. Keep the source/optimized pairs and middle option in the viewing path, move complete timing/provenance/storage detail behind two native disclosures, and derive rounded values from the same records rather than duplicate them. Remove the second invitation, numbered card taxonomy, duplicated captions and infrastructure narrative. This changes the plan from preserving all surrounding layout to deliberately reducing it. Reject hiding a comparison behind a tab, removing measurements, inventing new benchmarks, or changing the native player. The existing styles are the material; no new design framework, route, binding, encoding or player library. The same L5 Knows / Does NOT Know / Is NOT enumerations in the embedded-player contract remain authoritative.

Accept only after whole-page closed/open screenshots at390×844 and1280×800, every copy group reviewed, native interactions, disclosure keyboard access and retained data checked independently. The earlier narrow visual YES is historical, not this page’s acceptance. Public release remains sequential DEV→staging→production; the narrow DEV build is not promoted independently. Reversal is a presentation-only revert. No physical-device or field-quality inference.

## Challenge disposition

The execution challenge on 2026-10-05 raised sample representativeness, comparison fairness, missing evidence, reversibility and success criteria. This is a scoped presentation decision for one Jordan River resource, not a general compression principle or new pattern. Grounding is the operator’s explicit information-dump report, the complete production before captures in `integration/whole-page-before`, and the five qualified production files documented in `2026-10-05-fia-r2-production-proof.md`. The compact 224p file is explicitly one existing version; it is not presented as the strongest industry approach. Resolution alone is not a quality verdict.

The alternative of leaving all technical material visible preserves audit detail but obstructs the requested viewing journey. Removing it entirely loses useful verification. Two native disclosures retain that information with one additional interaction. The cost is reduced immediate visibility for visitors seeking measurements; descriptive disclosure labels address discoverability. A failure to find all five videos, reach details by keyboard, read measurements on a phone, or preserve exact file identities disconfirms acceptance and requires correction before promotion. No universal usability claim or field study is asserted. Reversal remains a presentation-only revert.

The earlier production proof’s explicit-Play-only loading wording records historical behavior. The operator subsequently clarified ordinary showcase metadata loading is appropriate. Native `preload="metadata"` now applies to this comparison page; it does not alter FIA’s separate offline-download policy.
