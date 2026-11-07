---
title: Admit the approved 3D Review video path through the existing proxy
date: 2026-11-06
status: working
---

> Admit canonical sources only under `https://cdn.3dreview.app/overview/5d92d72d3946/`, preserving existing source validation, encoding and release gates.

## Summary

The generator rejects the approved original 3D Review video before fetching or probing it because its host/path has no source contract. The operator authorized this narrow CDN path, testing and normal release. Add one prefix to the shared Worker/container source policy; retain all existing URL, redirect, size, geometry, cadence, time and byte checks. No wildcard, alternate host, UHD preset, UI change or revised video is included.

The original source is `3D-Review-120s-Raphael-narrated-draft.mp4`, 3,574,594 bytes, SHA-256 `5d92d72d3946bad622cee72b5bdebc8029e43cced4e9b01e4e65b4d6ada4d059`, H.264/AAC, 1920×1080, 30 fps, 120 seconds. These are observed input properties, not output qualification or playback claims. Existing Large targets 1280×720 and existing cadence selection still applies.

Video options remain `preset=fia,q=medium,f=mp4` with a supported size. The UI reproducer's `q=high` is a separate existing rejection (`Unsupported video option`) after source admission; it is not silently accepted or mapped to a new quality recipe.

## Acceptance

Targeted tests admit the approved source at existing sizes in Worker, container and generator, preserve identical settings/limits, and reject neighboring paths, sibling/subdomain/spoof hosts, credentials, noncanonical URLs, queries and fragments before encoder allocation. Catalog cache identities stay unchanged; the shared source module changes lazy encoder revision and can cause new lazy encodes.

Require independent review, applicable real Linux container proof, and exact main→development→staging→production Workers Builds identities. At each runtime gate verify source/output identity, MISS then verified HIT/HEAD/ranges and browser playback/seek. Preserve failed receipts and report platform limitations. Existing FIA PR108 ancestry is assessed separately from held UHD PR110; no denied action or security restriction is bypassed.

Ticket: `klappy/kitchen/rail/1-ordered/2026-11-06-transcode-3d-cdn-path/TICKET.md`. Reject broader CDN access and rehosting as unnecessary expansion. Reconsider only with new operator scope and evidence.

## Existing workflow adapter

The old Docker executor is unavailable and the current exposed environments lack Docker. The existing manual `video-qualification.yml` now offers a separate `source-policy-3d` mode; omitted mode still runs the unchanged historical three-target path. The adapter pins runtime `652d536c8b64903dc01ba09a4b9ab034cce6797c`, reviewed harness blob `3cea8143d87aa57dd73535ab10e1b8f6297e41e4` and the exact original source bytes/hash. Its image uses that clean runtime checkout; orchestration is recorded separately. Permissions remain read-only and there is no deployment step. It enforces isolated 4-CPU/8-GiB execution with no extra swap, a read-only root, 1408-MiB temporary storage and a 660-second Docker-run ceiling, then validates evidence and removes the owned container. A passed job still requires independent evidence acceptance and all tier runtime/playback gates; it is not a release.
