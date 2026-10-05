# Video cadence cap

## Decision

The current user instruction supersedes the earlier preserve-50fps decision. Apply a clean integer-divisor cadence at or below 30fps now, without frame blending. Keep all approved +50% original video budgets, raster/SAR/DAR, audio, source allowlist, and two-pass limits unchanged.

For an exact positive CFR rational N/D, choose the smallest integer divisor k for which N/(D*k) <= 30. Preserve rates already <=30. Thus 50 becomes25,60 becomes30,60000/1001 becomes30000/1001, and30000/1001 remains unchanged. For conversion use the exact rational FFmpeg fps filter with nearest timestamp rounding in both passes; it advertises the intended output rate to the encoder and drops frames without blending. Do not change playback speed with setpts. For already-low CFR rates omit conversion. Output mux passthrough prevents a later synchronization stage from duplicating frames. The maximum GOP remains30seconds (750frames for current25fps outputs).

The three hash-pinned approved sources are qualified50fps CFR. The adapter checks their explicit source cadence contract and probe cadence before encoding. Unknown rates, conflicting average/rate metadata, and sources not qualified as CFR are unsupported. Equal probe rates alone are not a general proof that arbitrary video is CFR. No new VFR source is admitted by this change.

## Identity and qualification

Advance recipe IDs and include cadence policy/source rate/output rate in the existing hash-bound contracts. Adapter changes also advance encoder identity. Never alias old50fps objects as new25fps outputs. Fixed showcase references remain unchanged qualified historical files. The app catalog must bind actual new output identities after publication.

Use the already approved reduced release sequence: DEV a13Small, staging a184Medium, production all nine required source/size members, with actual HTTP/cache/range, full decode, duration, explicit SAR/DAR, actual25fps and frame counts, R2 identity reconciliation, and representative browser playback. No nine-output CI encode or quality experiment is required. Existing five fixed-reference page checks stay in force.

## Alternatives and risks

Keeping50fps contradicts the latest instruction. Arbitrary30fps conversion from50 creates an uneven sampling pattern; integer division yields25 instead. Frame blending changes image content and is excluded. Frame dropping changes motion sampling and encoder bytes; it does not guarantee a particular size or quality gain. A source cadence or timeline mismatch must fail closed rather than silently normalize unqualified VFR. Existing source/frame duration and output-count checks provide disconfirming evidence during actual qualification.

## Scope

No new service, tool, source acquisition policy, codec, audio strategy, or capacity setting. Existing bounded two-pass pipeline and publication owner remain authoritative. No deployment or encode is implied by this document.

The [FFmpeg fps documentation](https://ffmpeg.org/ffmpeg-filters.html#fps-1) specifies constant-rate conversion by dropping or duplicating frames, with explicit timestamp rounding. On the qualified clean-divisor inputs this is decimation, not interpolation. Validate both average and nominal output frame rates and the actual x264 pass settings; select-only with inherited50fps metadata is insufficient.
