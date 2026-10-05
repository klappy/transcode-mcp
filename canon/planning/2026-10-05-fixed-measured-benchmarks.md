---
title: Immutable measured video comparisons
status: working
date: 2026-10-05
---
# Immutable measured video comparisons

> Freeze the four measured 25fps comparison files without coupling playback to later encoder revisions.

## Summary

Use the existing closed reference registry, private tier R2 bucket and bounded publication sidecar. Add four fixed IDs below; retain all existing source, compact and historical entries. No origin fetch, new encode, generic URL route or bucket publicity. Page metrics describe these exact measured files, not current encoder output. The operator seeds each exact retained MP4, reads it back fully and verifies SHA/length, then publishes the existing v1 sidecar last with observed native R2 ETag. Per-tier HEAD/GET/range identity proof remains required before page publication. Missing objects remain unavailable (503), with no dynamic fallback.

These compressed adaptations retain the approved Jordan River source and CC-BY-SA-4.0 attribution. Separate per-file accepted HTTP/full-decode/R2 receipts are pinned below; no new quality verdict is made.

| Fixed reference | Bytes | SHA256 | Accepted receipt SHA256 |
|---|---:|---|---|
|a13-xsmall-25fps-benchmark-v1|1825753|`627ac30873371b3c237eead9b582672016da5a3d44c3b420dc0149850bf8003d`|`01c130d60a4bf2cd47a06d2f74f4f9a25289b602fc5a15630e455d501085bdee`|
|a13-small-25fps-benchmark-v1|3493851|`ff6e824bc2fb902fd380052247287431ba62750c249f88406729f440320d96b3`|`ed52ed2672d584189c0bcbf87562228b3e9d411fef48b04f3639c6c9f0902310`|
|a13-medium-25fps-benchmark-v1|4386076|`f39a7b8ab99b15dc00ead12a0be5e1fddb9d77f3d57758b3a368b2093e66a38c`|`d3335c221c24ce5ed6a31ce82e2de710720bc36e1eee95cfe042bcf83b675848`|
|a13-large-25fps-benchmark-v1|7598950|`83f22e9ffa67218b89cf852c85db8e0b52781697e4bf8665104dc27658525668`|`b51113df719d16bee8954d2c3a35b867e580117b46d652a556b13996d3e39bff`|
