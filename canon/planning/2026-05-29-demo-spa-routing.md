---
title: Demo SPA Routing — Three Pages, One Menu, Film at Root
date: 2026-05-29
status: working
mode: planning
derives_from: canon/constraints/definition-of-done.md
complements:
  - canon/values/project-identity.md
  - canon/planning/2026-05-27-success-criteria-and-irreversibility.md
---

# Demo SPA Routing — Three Pages, One Menu, Film at Root

> The demo is no longer a single page. Three audience-specific pages — the cinematic scroll **film** (the emotional pitch), the measurement **bench** (the pixel-peep proof tool, formerly the only demo), and the storage **case study** (the offline last-mile argument) — are each served as their own single-`<script>` HTML string on its own worker route: `/` and `/film` serve the film (default landing), `/bench` serves the bench, `/casestudy` serves the case study. A shared nav in all three lets a visitor move between them. Pages stay separate files (not one combined SPA) specifically so the existing one-script / all-ids guard test stays meaningful per page. The image/audio proxy paths are untouched: this change is additive static routing only.

---

## Summary — Separate Route-Served Pages With a Shared Menu

The proxy now has three demo artifacts that each make a different case to a different reader, but only one was reachable (the bench, at `/` and `/demo`). This change gives each its own route and links them with a shared menu, landing first-time visitors on the most persuasive one (the film).

The pages are served exactly the way the current demo is — an HTML file imported as a text string by a thin `.ts` loader and returned from `worker.ts` with `Content-Type: text/html`. Nothing is bundled into a client-side router. Three routes, three strings.

This keeps the project's existing guard test honest. `demo-page.test.ts` asserts each page has exactly one inline `<script>` and that every `getElementById('x')` has a matching `id="x"` — a real defense against a silent load-time crash. Merging three pages into one combined document would have many scripts and many ids and would gut that test. Keeping the pages separate preserves the guard; the test is generalized to run the same three assertions over all three page modules so the two new pages get the same protection.

The only deletion is the `/demo` alias, which was never linked publicly and only the owner ever visited. The proxy boundary (`/image/`, `/audio/`, `/mcp`) is not touched, so the proxy-first + lazy contract is unchanged.

---

## Problem Statement

The repo accumulated three demo pages that each serve a distinct purpose:

- **Film** — a scroll-driven Showroom → In-Context → Race narrative. The emotional, first-impression pitch.
- **Bench** — the existing measurement tool: pick a source, fan out size × quality × format combinations, read live `X-Transcode-*` headers, compare and pixel-peep. The technical proof.
- **Case study** — a storage-headroom planner for the offline Bible-translation last mile: raw vs proxy-optimized bundle, framed as "leave room for the work" (recording runway).

Only the bench is reachable — at `/` and `/demo`. The film and case study exist as standalone artifacts with no route and no way to navigate between any of them. A visitor cannot move from the persuasive pitch to the proof to the field argument. The goal is to make all three reachable and cross-linked, and to land first-time visitors on the most compelling one.

## Alternatives Considered

### Alternative A — One file, hash routes (`#film`, `#bench`, `#storage`)
A single combined HTML document with a client-side hash router showing/hiding sections. True single-page app, one HTTP route.
- **Rejected.** Combining three pages means many `<script>` blocks and hundreds of ids in one document, which defeats `demo-page.test.ts`'s single-script / all-ids guard — the test that catches a botched escape silently breaking the page at load. The three pages also have overlapping element ids (each has its own dock/controls), which would collide in one document.

### Alternative B — One file, tabs that show/hide (no URL change)
Same combined-document problem as A, plus no shareable per-page URL. Same test-guard objection.
- **Rejected** for the same reason as A, with the added downside that you can't link someone directly to the case study.

### Alternative C — Three separate route-served files, shared menu (chosen)
Each page stays its own single-`<script>` HTML file, served on its own route, exactly like the current demo. A shared nav links the three. The guard test stays valid per file and is generalized to cover all three.
- **Chosen.** Preserves the existing test discipline, gives each page a clean shareable URL, keeps each page's markup/ids isolated, and is purely additive to routing. Cost: a little markup duplication (the nav appears in three files) — acceptable for three static pages.

## Decisions Locked

- **Topology:** three separate route-served HTML strings (Alternative C). Not a combined SPA.
- **Routes:** `/` and `/film` → film (default landing); `/bench` → bench; `/casestudy` → case study.
- **`/demo`:** removed. It was never linked publicly; the bench now lives at `/bench`.
- **Default landing:** the film — the most persuasive first impression.
- **Shared menu:** a compact nav present in all three pages, linking the three routes and marking the current one. Plain `<a href>` links (real navigation between real routes), not JS view-switching.
- **Test:** `demo-page.test.ts` generalized to assert one `<script>` block + all-ids-present across all three page modules. Protection kept, not relaxed.
- **CORS:** not added. The bench reads `X-Transcode-*` via `fetch`; served same-origin from the worker (which it is), that works today. Off-origin CORS is a separate concern and out of scope here.

## Risks and Reversibility

- **Reversibility: high.** The change is additive static routing plus two new page files and their loaders. Reverting is deleting the routes/files and restoring `/demo`. No data, no schema, no proxy-path change.
- **Risk — id collisions across pages:** avoided by keeping pages in separate documents; ids only need to be unique within each file (already true).
- **Risk — nav drift:** the menu markup is duplicated in three files, so a label/route change must be made in three places. Accepted for three static pages; if it grows, the nav can be factored into a shared partial later.
- **Risk — breaking the guard test:** mitigated by keeping pages separate and extending (not relaxing) the test.
- **Risk — proxy regression:** none expected; the `/image/`, `/audio/`, `/mcp` handlers are not modified. Smoke confirms the proxy still answers.

## Success Criteria

1. `GET /` and `GET /film` return 200 `text/html` and render the scroll film.
2. `GET /bench` returns 200 `text/html` and renders the measurement bench (the former `/` content).
3. `GET /casestudy` returns 200 `text/html` and renders the storage planner.
4. `GET /demo` returns 404 (alias removed).
5. Each page shows the shared menu; clicking an item navigates to that route and the current item is marked active.
6. `demo-page.test.ts` passes its one-script / all-ids assertions for all three page modules.
7. `bun run typecheck` and `bun test` pass.
8. Smoke verification against the preview worker: the four routes above return their expected status/content-type.
9. The image proxy still passes its existing smoke (no regression from this change).
