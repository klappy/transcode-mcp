---
title: FIA Guide phone video sizes
status: working
date: 2026-10-05
---
# FIA Guide phone video sizes

> Final user direction for this work session: Small320p, Medium540p, Large912p. Finish documentation and handoff; run no further experiments today.

## Summary

| FIA Guide selection | Intended encoded resolution |
|---|---|
| Small | 320p |
| Medium | 540p |
| Large | 912p |

This supersedes the previous Small480p/Large720p application mapping and the tentative four-class/1080p selection. The240p,1080p and1360p experiments are deferred. Existing comparison evidence and earlier cost scenarios remain history, not the final app menu. This decision does not authorize an additional encode, deployment or new experiment during wrap-up.

## Truthful migration and availability

Public app size labels and physical proxy profiles are distinct. Existing proxy `size=small` semantics must not be silently relabeled320p, and omitted/currentLarge routes must not be described as912p while serving720p. Implementation must bind each app selection to the actual qualified profile, source identity, output SHA/bytes and applicable timing record. Until912p is actually ready, report Large912p as unavailable or pending; preserve truthful identification of any existing saved720p resource. Never substitute another profile while claiming the requested size was delivered.

Reuse the existing verified catalog, selection and offline mechanisms. Streaming settings and Downloads must show the actual selected or saved profile. No placeholder bytes, fabricated readiness, borrowed qualification or silent fallback is permitted. This document records the desired mapping, not a claim that it is implemented or all outputs are ready.

## Pericope download total

Calculate the pericope total from the unique, actual, verified files selected for its image, audio and video choices. Sum each delivery object's verified byte length once even when several activities reference it; deduplicate by its actual delivery identity rather than by activity count. Count only the chosen variants, not all available variants. If a separate core/text subtotal is shown, label it explicitly.

Missing or unavailable resources remain a separately reported unknown/pending component, never zero bytes. A partial known subtotal must not be presented as the complete download size. An existing saved package's status describes its actual saved members, not the current preference controls.

## Preserved comparison direction

The user's proposed comparison baseline was external delivery at the same displayed class size, not our540p versus our480p with multiple changing budgets. Any future comparison would identify the same publisher/cut/frame and external codec, frame rate and audio, accounting separately for the approved narration versus YouTube music. No generic claim about all YouTube quality follows. That investigation and metadata acquisition are deferred with the other experiments; the final app choices above take priority.

See [prior mapping proposal](2026-10-05-sovee-display-resolution-mapping.md) and [historical cost scenarios](2026-10-05-fia-video-cost-four-current.md). Their experimental alternatives are superseded as app-selection direction, while their measured observations remain preserved.
