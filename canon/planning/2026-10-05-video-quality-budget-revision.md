# Restore video quality headroom: all three budgets +50%

2026-10-05. Latest user decision supersedes the unexecuted +20% proposal : apply +50% to ORIGINAL budgets, never compound the increases. User decision: keep roughly double-average peak capacity, increase each video budget50%, and value useful quality as well as size. This supersedes the unimplemented cadence-first option; see [prior cadence context](2026-10-05-natural-video-budget-frame-rate.md). No encoding or runtime change has occurred in this document task. Exact implementation and output review still precede release.

## Exact data revision

Scale existing requested video average, nominal class, maxrate and buffer by1.5; round the one noninteger average to nearest whole bit/s. This preserves each existing rate-control convention and VBV time horizon rather than silently changing the Large correction. Leave resolution,50fps, H.264, two-pass mode, medium encoder preset, scene-cut/GOP controls, audio codec/bitrate/channels/sample-rate and all safety limits unchanged.

| Target | Requested video average old→new (bits/s) | Nominal class old→new | VBV max old→new (bits/s) | VBV buffer old→new (bits) | Audio unchanged |
|---|---:|---:|---:|---:|---|
|Small480p|200000→300000|200000→300000|400000→600000|800000→1200000|AAC42667 mono|
|Medium540p|253125→379688|253125→379688|506250→759375|1012500→1518750|AAC54000 stereo|
|Large720p|439024→658536|450000→675000|900000→1350000|1800000→2700000|AAC96000 stereo|

Large retains its prior measured request correction:439024×1.5=658536. Its max remains2× nominal class675000, approximately2.05× corrected average, exactly the existing relationship except rounding. Small max remains exactly2× average. Medium uses exact original max ×1.5 =759375; its requested average379687.5 rounds to379688, so max differs from twice the rounded request by one bit/s. Its nominal class is likewise379688. This rounding is explicit rather than a new calibration. All three buffers remain twice their maxrate (roughly2 seconds). This consistent multiply-existing-policy interpretation avoids inventing a fresh Large calibration or calling its requested average675000 when it is658536.

Standalone audio presets and image presets are unchanged. Keeping video AAC rates unchanged is this explicit experiment/revision decision; do not automatically increase audio50% because earlier video/audio ratios were proportional. The resulting ratio change must be documented, not hidden behind an old proportionality claim.

## What changes and what does not

Current encoding already uses two-pass ABR with variable allocation, `-b:v`, `-maxrate`, `-bufsize`; it is not static bits per frame. No minimum rate or filler/CBR is added. The new average offers more sustained detail budget while the doubled peak permits bursts. A VBV max is not an exact every-frame/network-second file cap. Easy scenes may consume less; actual total file growth depends on video rate, unchanged audio and mux overhead. **Do not promise exactly50% larger files or a visual improvement before measurement.**

Preserve50fps now. A clean-divisor50→25 motion comparison is a separate possible follow-up, not bundled into this quality revision. No frame interpolation, macroblock sweep, codec expansion,320 public target or arbitrary-size escape hatch. Existing public target names remain Small480/Medium540/Large720.

## Smallest implementation and qualification

Update the three existing shared target recipe data records, with a new truthful recipe revision; let actual encoder/catalog identity advance. Never retain the old hash for changed settings or overwrite old qualified bytes. Generalized source×size selection continues to use one pipeline. Existing fixed showcase artifacts remain stable historical comparisons until new measured artifacts are independently accepted and explicitly published.

Initial proof is the single 320p candidate defined in the [aligned-canvas contract](2026-10-05-aligned-video-canvases.md), compared with the retained source and old compact file. Do not encode the three core profiles until that motion/geometry review is accepted. Then reuse the shared proportional rules and briefly validate each needed actual size/source; no repeated tuning matrix or assumed universal quality transfer. Reuse one retained verified a13 source locally, at most one output per changed core target under the existing bounded manual qualification harness. No original-source download, no speech generation, no retries or alternative bitrate search. Verify actual emitted x264 average/max/buffer settings; full decode, source identity, duration, geometry/SAR, audio settings, complete output hashes and cleanup. Reuse current three-target resource ceilings and shared deadline/checkpoint rules; larger budget does not relax process, disk or byte safety bounds.

Compare each new output against its own previous same-size output using actual matched decoded frames and continuous motion at the intended display size. Focus on foliage/water detail breakup and motion stability; a13 is not a confetti stress corpus. Report actual video payload average, mux/audio bytes and total size separately. Measure processing time only on comparable hardware; cached delivery and first-frame/seek times remain distinct. A larger output is not a failure solely for exceeding the OLD target budget; validate against the NEW declared recipe and assess whether quality earns the bytes.

The other two approved source assets require their own changed-recipe qualification before the app can advertise all-source readiness. Do not extrapolate one river clip into universal motion performance. Stage and production remain on the existing sequential release train; retain the old artifacts and failure evidence. No current source/variant becomes ready merely because the revised data exists.

## Evidence and provenance

Actual shared flags inspected in [`container/video.mjs`](../../../container/video.mjs); root independently verified released target numbers in video-cached-owner. Root checked primary FFmpeg rate-control documentation. The [prior cadence context](2026-10-05-natural-video-budget-frame-rate.md) remains historical reasoning about ABR/VBV and cadence tradeoffs; its optional experiment is not authorized by this revision.

## Viewing acceptance and discovery

The user’s quality criterion includes continuous motion when displayed one resolution step above the encoded frame. Review source, previous same-size output and revised output at matched times and the same larger display size. Declare each tested display size explicitly; compare foliage and water during motion, not only paused stills. The fifty-percent increase is the first correction, not an assumed solution or a guaranteed perceived-quality equivalence. Keep 50fps. Any later macroblock or cadence experiment requires a separately bounded record.

This canonical planning record is intended to become discoverable after publication through the existing docs search tool by the title and terms `video quality budget`, `fifty percent`, and `motion acceptance`; retrieve its single URI for the full body. No bundled catalog or additional docs tool is introduced.

Decisions are locked for this revision: only the declared three video rates change; audio, cadence and safety bounds remain fixed. Local implementation is reversible through Git and preserves all old immutable outputs. Definition of done is exact argument/identity tests plus independently reviewed bounded output and continuous-motion evidence before deployment. Failure to earn the added bytes or remaining distracting motion artifacts withholds output acceptance; it does not authorize automatic tuning or retries. Search discovery must be verified against the published repository after merge.

## Measured sampling-first checkpoint

See [the sampled 320p results](2026-10-05-320-sampled-results.md) for the actual 39.6-second measurement, matched still and geometry review, and remaining motion/listening limits. This evidence does not qualify the complete source or change production availability.
