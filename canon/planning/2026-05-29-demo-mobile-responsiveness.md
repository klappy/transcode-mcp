---
title: Demo Mobile Responsiveness + Race-Lane Correctness
date: 2026-05-29
status: working
mode: planning
derives_from: canon/constraints/definition-of-done.md
complements:
  - canon/planning/2026-05-29-demo-spa-routing.md
---

# Demo Mobile Responsiveness + Race-Lane Correctness

> The three demo pages shipped at PR #18 work on a laptop but break on phones in three ways: the shared cross-page nav overflows the right edge of the viewport (the "Case study" link gets clipped), each page's body layout assumes ~1100–1500px of horizontal space, and on the film the showroom devices and race phones don't fit a 390-wide screen. Separately, the film's race has a correctness bug: the prose says "Left loads it raw; right loads the proxy URL," but the proxy/green phone renders on the **left** and the raw/red phone on the **right**. This change fixes the race-lane binding to match the prose, collapses the xnav to a small hamburger under ~520px, and adds the missing breakpoints so each page's content stacks cleanly down to ~360px. Whitespace between showroom devices is tightened at every width as a side benefit. The image / audio / MCP paths and the JS guard test discipline are untouched.

---

## Summary

PR #18 shipped three routes and a shared menu but no mobile media queries. On a 390-wide viewport (a common iPhone), three problems are immediately visible:

1. **Race lane mismatch** — the film's "loading race" headline reads "Left loads it raw; right loads the proxy URL," but the rendering binds the hero phone (proxy/green) on the *left* and `phone2` (raw/red) on the *right*. The race mechanics are correct (proxy still wins); the assignment of which phone is which is reversed vs the prose. The fix is to swap the lanes so left = raw, right = proxy, matching the prose. This is one line of layout math plus the lane-class on the hero phone.
2. **xnav overflows the viewport** — three text links + the brand wordmark exceed 390px. On the bench/casestudy pages "Case study" is clipped at the right edge.
3. **Per-page layout assumes desktop** — the film's showroom trio is ~750px wide; the case study's two-column phone+narrative grid doesn't collapse cleanly under its existing 840px breakpoint when the inner phone is 300px and the right column controls flex-wrap into a tower; the bench's `h1`+lede block is fine but the controls row, baseline-tile, and compare modal need confirmation at narrow widths.

Per the discussion this also includes tightening whitespace between the showroom devices on all viewports (a desktop polish), and verifying the showroom→in-context zoom hand-off works correctly at narrow widths where the `placE()` px math is computed from a smaller `innerWidth`.

## Problem statement

The three demo pages each work on a laptop but fail on phones: (a) the shared nav overflows the right edge, (b) the film's showroom/race expect ~750–900px of horizontal room, (c) the bench's controls/dropdowns are usable on phones but cramped, (d) the case study's two-column grid + 300px phone don't fit a 390-wide viewport. Separately, the film's race binds proxy/raw to the opposite phones from what the headline prose says, making the page read as contradictory.

## Decisions locked

- **Race lane binding (chosen):** swap the *phones*, not the prose. Left = RAW (red), right = PROXY/win (green). Matches headline reading order (story before answer; "left raw" is the natural starting frame).
- **Film mobile approach (chosen):** keep horizontal but shrink to fit. The showroom trio scales down (phones get smaller, lateral gaps narrow); the race phones stay side-by-side but smaller, with the verdict centered between them as today. No vertical-stack mode, no one-phone-with-toggle mode. Also tighten the desktop whitespace.
- **xnav on narrow viewports (chosen):** collapse to a hamburger under ~520px. A real toggle button (`<button aria-expanded>`) with a small popover; click-outside-to-close; escape closes. No external dependencies, no JS framework. Above 520px the three links remain inline as today.
- **Breakpoints:** one shared phone breakpoint at `max-width: 600px`, one shared narrow-nav breakpoint at `max-width: 520px`. The bench keeps its existing `840px` grid breakpoint and `720px` baseline-tile breakpoint.
- **Zoom hand-off check:** verify the showroom→in-context grow-into-hero transition at 360/390/480 widths after the showroom devices shrink. If the px-based `placE()` math drifts, parametrize the hero scale on viewport so the zoom lands cleanly.

## Alternatives considered

### A — Swap the prose ("Left loads the proxy URL; right loads it raw")
Reverses the reading order from "raw → proxy/win" to "proxy → raw," which loses the rhetorical "story before answer" cadence. The current binding (left=proxy) was an accidental swap, not a design choice. Rejected.

### B — Stack the showroom + race vertically on mobile
Cleaner per-element but loses the side-by-side race comparison, which is the strongest moment of the film. The race only reads if you can see both phones loading at the same time. Rejected.

### C — One phone on mobile with raw↔proxy toggle
Cleaner still but kills the parallel-loading drama. Rejected for the same reason as B.

### D — xnav scrolls horizontally with a fade-edge
A frequent pattern, but the "Case study" link is the most important destination on a first visit (it's the field-translator argument) and a horizontal scroll often hides it. A hamburger always shows every destination once opened. Rejected.

### E — xnav drops labels to initials (F·B·C) on mobile
Compact, but the affordance is weak — a stranger doesn't know what F/B/C mean. Rejected.

## Risks and reversibility

- **Reversibility: high.** Every change is CSS media queries plus one HTML element (the hamburger button + popover) plus a one-line swap in the film's `render()`. No data, no schema, no proxy-path change.
- **Risk — race semantics drift:** the lane swap moves CSS classes between two DOM nodes (`#phone`, `#phone2`). The lane assignment in `startRace` (`lane(false, raw, …)`, `lane(true, win, …)`) and the meter targets (`#skW/#picW/#fbW/#tiW` etc.) must continue to point at the proxy/green lane, not the visual left/right. The existing guard test catches missing ids; the manual race smoke (scroll past 0.74, watch which side finishes first) catches a wrong lane label.
- **Risk — hamburger keyboard-trap or focus-loss:** the popover must be dismissible with Escape, click-outside, and the first focusable element on open. The implementation is small enough to write straightforward.
- **Risk — zoom hand-off lands off-screen at narrow widths:** mitigated by re-deriving the hero scale and X-offset from `innerWidth` rather than hard-coded values.
- **Risk — bench `<details>` / popover stack at mobile:** the existing controls flex-wrap fine; the dropdown popover (`.dropdown-popover`) uses `min-width:280px max-width:360px` which fits a 390-wide viewport but not a 360-wide one. Cap to `min(86vw, 360px)` on phones.

## Success criteria

1. At a 390×844 viewport (a common iPhone), all three pages render with no horizontal overflow and no clipped content above the fold.
2. At a 360×740 viewport (an older Android), same — no horizontal scroll, no clipped nav.
3. The xnav is replaced by a single hamburger button under ~520px; clicking the button opens a popover listing the three links; Escape and click-outside close it; the active link is marked.
4. The film's race headline ("Left loads it raw; right loads the proxy URL") matches the rendered binding: left phone tagged RAW SOURCE in red, right phone tagged PROXY in green; the verdict reads "X.X× faster" with the green phone finishing first.
5. The film's showroom→in-context zoom hand-off lands the hero phone on-screen and at the right scale at 360, 390, 480, 768, and 1280 widths.
6. The bench's source dropdown, controls row, baseline tile, and compare modal are usable (no overflow, no truncated controls) at 390 wide.
7. The case study's phone + breakdown table stack cleanly under 840 wide and remain readable at 390 wide.
8. The proxy and MCP smokes still pass — no regression to non-demo paths.
9. `bun run typecheck` and `bun test` pass; the demo-page guard tests pass for all three pages.
