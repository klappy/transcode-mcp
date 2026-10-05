---
title: FIA video source mapping and translated narration proposal
date: 2026-10-05
status: working
mode: planning
---
# FIA video source mapping and translated narration proposal

> Map each FIA video to verified higher-resolution picture and approved narration independently. Reuse one reviewed narration per language across Small 320p, Medium 540p and Large 912p. Start with one Spanish pilot; this proposal starts no paid generation or further encoding.

## Summary — Preserve picture quality, translate speech once

Use the [final phone menu](2026-10-05-fia-phone-video-sizes.md). The current inventory covers 93 distinct English catalog videos; the 136 Mark packs reference 52 distinct video IDs in 172 placements. This is not an inventory of every FIA language or the whole Bible. A title match is a candidate, not proof of 4K, the same edit, or synchronized narration. Jordan is the first verified 4K picture plus approved original audio composite. Other rows need qualification.

Retain approved existing narration when the YouTube soundtrack includes music we do not intend to distribute. Prefer existing approved recordings in the requested language before generating replacements. Propose one Spanish pilot with terminology and timing review before expansion. Large 912p is still unqualified; this document does not make it available. No further experiments or paid generation occur during today's wrap-up.

## Inventory captured today

The [93-row source map](2026-10-05-fia-video-source-map.json) preserves every current catalog ID. The playlist returned 68 entries: 51 catalog rows have candidates (46 exact normalized titles, three fuzzy titles, two earlier web candidates); 42 remain unmatched. Of the 51, only Jordan is verified; 50 are candidates awaiting qualification. Manual candidate review rejected a false Purse-to-House match; title similarity is not sufficient evidence. Candidate status never authorizes source replacement. The map pins upstream metadata revision and catalog checksum.

## Source mapping acceptance

Each stable FIA video ID needs its current URL, language and pack references, candidate YouTube ID/publisher, actual available dimensions/fps/codec, acquired source checksum, duration/edit alignment, approved audio source/checksum/language, timing offset or edit map, provenance evidence, and qualification status. Separate candidate, picture-verified, audio-aligned and delivery-ready states. Unmatched titles and unavailable 4K remain visible.

Use the [publisher playlist](https://www.youtube.com/playlist?list=PLRtiwzxN21Ya8U8e3HD9PUed9cb6a4bWO) supplied by the user. Compare opening, ending and scene transitions as well as duration. If edits differ, retain the existing approved video until an explicit edit map is reviewed. Do not silently stretch or trim narration.

Jordan's [YouTube picture](https://www.youtube.com/watch?v=AmunLtggLUI) is video-only 3840×2160 at 50fps, 79.140 seconds, SHA256 `53bc189e7e1815efd18b1ba017da3df5a0ee8b0d03ec7bfd85c9b1b41b94857b`. Approved audio comes from original MP4 SHA256 `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718`. The packet-copy composite is 225,659,075 bytes, SHA256 `c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4`. Sampled picture alignment and full decode passed. No optimized output from this 4K composite has been encoded; this evidence does not qualify other titles.

Combine picture and approved narration into a synchronized deliverable. Avoid independently playing video and fallback audio on two browser clocks. A manifest with alternate audio is a later option only after player qualification. Replacing the soundtrack changes the audio choice, not the picture's provenance.

## Spanish pilot and expansion

1. Check for approved Spanish narration matching Jordan's cut. If present, reuse it and avoid generation.
2. Otherwise prepare one audio-only English-to-Spanish Dubbing v2 project. Review meaning, names and biblical terms against FIA material; listen across scene boundaries and verify ending sync. Record a language review decision before publication.
3. Confirm the workspace's editing entitlement. ElevenLabs documents supplied transcripts/translations as Enterprise-only. Without that access, reviewed translated text plus ElevenLabs TTS with explicit segment timing is the controllable alternative; it needs a separate character-based quote and authorized voice choice. Do not promise manual correction controls through automatic dubbing without checking access.
4. Save one accepted lossless narration per language. Derive delivery audio profiles through the transcode service and reuse encoded picture packets when remuxing permits. Three video sizes do not require three dubbing purchases. Language-specific containers still add packaging/storage bytes.
5. Use the existing DEV→staging→production queue. Check phone playback, seeking, fullscreen return and offline operation. Expand by unique video, not repeated pericope placement. No mass generation, local speech synthesis or new adaptive player is part of this proposal.

The current [Dubbing quickstart](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/dubbing) uses reusable projects with separate language targets and downloadable audio. Project creation prepays one language. Persist project/target IDs and reconcile ambiguous submissions before retrying. Copy completed audio into durable content-addressed storage instead of retaining an expiring provider output URL.

The [custom transcript guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/dubbing/bring-your-own-transcript) documents the Enterprise restriction. Treat generated translation as a draft pending FIA review. If accuracy, pronunciation or pacing fails, retain the approved original and revise the proposed route; do not expand a failing pilot. Source mappings and original assets remain reversible; provider generation is a paid action.

## Cost proposal — Per target language, not per resolution

The [ElevenLabs API price list](https://elevenlabs.io/pricing/api), checked October 5, 2026, lists Dubbing v2 at $2.20 per source minute. Its [billing explanation](https://elevenlabs.io/docs/help-center/product/dubbing/how-much-does-dubbing-cost) bills source duration for each target language. These are public planning rates, not an account quote or measured processing time.

| Scope | Source minutes | Base dubbing | With 20% planning reserve |
|---|---:|---:|---:|
| Jordan pilot, 79.153 seconds | 1.3192 | $2.90 | $3.48 |
| 85 catalog videos with duration labels | 104.200 | $229.24 | $275.09 |
| All 93 catalog videos, eight durations imputed | 114.007 | $250.82 | $300.98 |

The reserve is an assumption, not observed retry frequency. The 93-video duration comes from the [existing inventory model](2026-10-05-fia-video-cost-four-current.md); replace imputed durations with probes before batch execution. Each additional generated language adds its required unique minutes. Existing approved recordings reduce generation needs. Human review, translation work, subscription requirements, taxes, encoding and storage are separate. This estimate covers video narration only, not all guide/pericope text audio. No paid request was made for this proposal.

## Deterministic identity and truthful download totals

Picture identity includes source checksum and complete encode recipe/version. Narration identity includes approved source checksum, language/dialect, transcript/translation revision, model/version and voice/settings. Final package identity includes both outputs and timing/remux recipe. Persist unknown provider revision honestly; titles and language labels alone are not cache keys.

Streaming remains user-initiated; downloads remain explicit. Play ready assets and report preparing/unavailable states truthfully. An English fallback must be labeled English, not presented as a translated track. Preserve the separately identified high-quality streaming fallback until the requested proxy output is ready.

Calculate each pericope total from actual selected manifest members: core/text and selected image/audio/video in the chosen language. Count each member once under actual downloader reuse semantics, not every quality or repeated activity reference. Unknown files prevent an exact complete total. Separate audio only saves package bytes if the actual player/downloader reuses it.

## Next bounded ticket

Complete and qualify the source map, then prepare the Spanish pilot's exact input, entitlement, reviewer and cost receipt. Implement final 320/540/912 app bindings using qualified assets. Today closes with documentation and evidence; automation remains paused.
