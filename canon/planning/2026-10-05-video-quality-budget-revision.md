# Restore video quality headroom: all three budgets +20%

2026-10-05. User decision: keep roughly double-average peak capacity, increase each video budget20%, and value useful quality as well as size. This supersedes the unimplemented cadence-first proposal in PROPOSAL.md. No encoding or runtime change has occurred in this document task. No further user permission is required for this authorized policy; exact implementation and output review still precede release.

## Exact data revision

Scale existing requested video average, nominal class, maxrate and buffer by1.2; round the one noninteger average to nearest whole bit/s. This preserves each existing rate-control convention and VBV time horizon rather than silently changing the Large correction. Leave resolution,50fps, H.264, two-pass mode, medium encoder preset, scene-cut/GOP controls, audio codec/bitrate/channels/sample-rate and all safety limits unchanged.

| Target | Requested video average old→new (bits/s) | Nominal class old→new | VBV max old→new (bits/s) | VBV buffer old→new (bits) | Audio unchanged |
|---|---:|---:|---:|---:|---|
|Small480p|200000→240000|200000→240000|400000→480000|800000→960000|AAC42667 mono|
|Medium540p|253125→303750|253125→303750|506250→607500|1012500→1215000|AAC54000 stereo|
|Large720p|439024→526829|450000→540000|900000→1080000|1800000→2160000|AAC96000 stereo|

Large retains its prior measured request correction:439024×1.2=526828.8, rounded526829. Its max remains2× nominal class540000, approximately2.05× corrected average, exactly the existing relationship except rounding. Small/Medium max remains exactly2× average. All three buffers remain twice their maxrate (roughly2 seconds). This consistent multiply-existing-policy interpretation avoids inventing a fresh Large calibration or calling its requested average540000 when it is526829.

Standalone audio presets and image presets are unchanged. Keeping video AAC rates unchanged is this explicit experiment/revision decision; do not automatically increase audio20% because earlier video/audio ratios were proportional. The resulting ratio change must be documented, not hidden behind an old proportionality claim.

## What changes and what does not

Current encoding already uses two-pass ABR with variable allocation, `-b:v`, `-maxrate`, `-bufsize`; it is not static bits per frame. No minimum rate or filler/CBR is added. The new average offers more sustained detail budget while the doubled peak permits bursts. A VBV max is not an exact every-frame/network-second file cap. Easy scenes may consume less; actual total file growth depends on video rate, unchanged audio and mux overhead. **Do not promise exactly20% larger files or a visual improvement before measurement.**

Preserve50fps now. A clean-divisor50→25 motion comparison is a separate possible follow-up, not bundled into this quality revision. No frame interpolation, macroblock sweep, codec expansion,320 public target or arbitrary-size escape hatch. Existing public target names remain Small480/Medium540/Large720.

## Smallest implementation and qualification

Update the three existing shared target recipe data records, with a new truthful recipe revision; let actual encoder/catalog identity advance. Never retain the old hash for changed settings or overwrite old qualified bytes. Generalized source×size selection continues to use one pipeline. Existing fixed showcase artifacts remain stable historical comparisons until new measured artifacts are independently accepted and explicitly published.

Initial proof: one retained verified a13 source acquisition reused locally, exactly one output per changed target, sequentially under the existing bounded manual qualification harness. No original-source download, no speech generation, no retries or alternative bitrate search. Verify actual emitted x264 average/max/buffer settings; full decode, source identity, duration, geometry/SAR, audio settings, complete output hashes and cleanup. Reuse current three-target resource ceilings and shared deadline/checkpoint rules; larger budget does not relax process, disk or byte safety bounds.

Compare each new output against its own previous same-size output using actual matched decoded frames and continuous motion at the intended display size. Focus on foliage/water detail breakup and motion stability; a13 is not a confetti stress corpus. Report actual video payload average, mux/audio bytes and total size separately. Measure processing time only on comparable hardware; cached delivery and first-frame/seek times remain distinct. A larger output is not a failure solely for exceeding the OLD target budget; validate against the NEW declared recipe and assess whether quality earns the bytes.

The other two approved source assets require their own changed-recipe qualification before the app can advertise all-source readiness. Do not extrapolate one river clip into universal motion performance. Stage and production remain on the existing sequential release train; retain the old artifacts and failure evidence. No current source/variant becomes ready merely because the revised data exists.

## Evidence and provenance

Actual shared flags inspected in `source/video-source-size-catalog/container/video.mjs:76–96`; root independently verified released target numbers in video-cached-owner. Root checked primary FFmpeg rate-control documentation. This record supersedes PROPOSAL.md e0f1e97f (written but not executed) and keeps its historical reasoning about ABR/VBV and cadence tradeoffs without authorizing its optional experiment.

## Viewing acceptance and discovery

The user’s quality criterion includes continuous motion when displayed one resolution step above the encoded frame. Review source, previous same-size output and revised output at matched times and the same larger display size. Declare each tested display size explicitly; compare foliage and water during motion, not only paused stills. The twenty-percent increase is the first correction, not an assumed solution or a guaranteed perceived-quality equivalence. Keep 50fps. Any later macroblock or cadence experiment requires a separately bounded record.

This canonical planning record is discoverable through the existing docs search tool by the title and terms `video quality budget`, `twenty percent`, and `motion acceptance`; retrieve its single URI for the full body. No bundled catalog or additional docs tool is introduced.
