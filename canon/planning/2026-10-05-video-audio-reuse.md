# Video audio strategy audit and bounded proposal

Status: read-only audit and proposed experiment. No encoding, source acquisition, runtime changes, or production qualification performed. Existing resolution/framerate experiments retain identical audio so their comparisons remain controlled.

## What is actually implemented

In `source/video-proxy/container/recipes.mjs`, shipped `voice:medium` is exactly `-ac 1 -ar 16000 -c:a libopus -b:a 16k -vbr on -application audio`, delivered as Ogg/Opus. Low is8kbps/8kHz/mono/voip; high32kbps/24kHz/mono/audio. No loudness normalization, silence removal, denoising, high/low-pass filter, or other `-af` processing appears in these recipes. Resampling and channel conversion are explicit.

`src/lib/audio-options.ts` defaults an audio transform request to voice/medium/opus. A request with no transform options passes through. Only Opus+voice is currently transcodable; AAC, MP3 and music combinations pass through. `canon/planning/2026-05-27-audio-container-recipes.md` describes music low64/medium96/high128kbps stereo, but those music recipes are not implemented in the actual table. Its evidence section is still marked working. Do not present these documented music settings as deployed behavior.

Video `container/video.mjs:deliveryPassArguments` currently uses `-c:a aac -b:a 96k -ac 2`, with no explicit sample-rate reduction or audio filter. First pass has no audio; second pass encodes it. Actual a13 runtime output is AAC stereo48kHz. Actual a184 payload is687,604bytes,97.376kbps measured over its audio track. Video therefore does not currently reuse the shipped voice-medium compression strategy.

## Reuse without assuming content

Before selecting an output, inspect/listen to each retained source audio: speech, music, ambience, meaningful stereo and any mixed content. Metadata alone cannot establish that mono/16kHz speech treatment is acceptable. Do not discard music, channels, quiet sounds or timing merely to meet size targets. If this is voice-dominant and the independent listening comparison accepts it, the exact existing Opus voice-medium recipe is the first reuse candidate—not a newly invented bitrate strategy.

Keep the selected H.264 video samples byte-identical for an audio-only experiment (`video copy`, verified sample payload hash). Compare the existing AAC96 stereo baseline against the exact shipped Opus voice-medium recipe using the original HQ source audio, not a lossy second-generation extract. Record codec/container, actual payload bytes, channel count, sample rate, delay/start/end timestamps, duration, A/V synchronization, intelligibility and retained ambience. This is separate from the25/50fps and resolution experiments. Combine only independently accepted video and audio choices afterward and requalify the final muxed artifact.

## Container and playback choice

H.264+Opus in MP4 is a possible isolated compatibility candidate, not a claim that changing the audio codec is universally safe. WebKit's Safari18.4 announcement includes an AVC+Opus MP4 example; Safari17's announcement specifically documents one/two-channel Opus in MPEG-4 on macOS Sonoma. These facts do not replace actual target iPhone PWA playback/seek/offline tests. Ogg support for audio alone also does not establish every video container/codec path. Sources: [WebKit18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/), [WebKit17](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/).

Changing to WebM is not a simple remux of the existing H.264 video: the WebM project's documented video formats are VP8/VP9 with Vorbis/Opus audio. That would add a video-codec experiment and obscure the audio-only result; keep it outside this minimal slice. [WebM format definition](https://www.webmproject.org/about/).

If exact Opus-in-MP4 playback fails the required target chain, preserve the existing AAC MP4 path while separately qualifying an AAC speech-budget analogue. Do not call AAC16kbps equivalent to Opus16kbps or assume quality parity. No alternate AAC bitrate is selected in this audit. FFmpeg exposes distinct AAC and libopus encoders/options; codec-specific settings require their own measured result. [FFmpeg codec reference](https://ffmpeg.org/ffmpeg-codecs.html).

## Expected size effect and acceptance

For scale only,96→16kbps saves nominal80kbps: about0.792MB over79.168seconds, or0.565MB over56.47seconds, before measured codec/mux differences. These are arithmetic estimates, not promised file sizes or a quality verdict. The a184 total-budget diagnostic excess28,393bytes is much smaller, but that does not justify treating non-speech as speech.

Proposed bounded next step: one retained a13 audio-only recipe comparison with source listening/classification required for acceptance, fixed video payload, no source refetch, no automatic retries, and explicit private fixture rather than production readiness. Require independent acoustic/content judgment plus actual target decode, seek, A/V sync and offline behavior before changing the audio validation contract, MIME/codec capability declarations, cache identity or app publication schema. Existing video validators require AAC; Opus cannot be silently substituted. Preserve provenance and distinguish local desktop evidence from physical iPhone evidence.

## Concrete private a13 experiment contract

This bounded private candidate is already within the requested comparison scope. Listening/classification gates selecting or publishing its result, not a new permission request to create it. Preserve the AAC baseline. One job, no source fetch, no retry, no runtime edits.

Pinned inputs:

- Original HQ a13: `client/evidence/video-source-audit/a13-720p.mp4`,49,851,846bytes SHA256 `257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718`.
- Current actual two-pass/AAC baseline: `integration/ci-video-5bced-a13/output.mp4`,5,509,355bytes SHA256 `b48729c4de2bbea42ad0efab778ae758381bc135ead32cc1bed9573837b0808e`.

Paths above are relative to `outputs/fia-v3-continue/`. Verify both before any process. Use the existing qualified FFmpeg container executable and record its actual version/binary/library identity. No install or provider change.

Exactly one audio encode/remux candidate, with shell-free argument construction equivalent to:

```text
ffmpeg -nostdin -hide_banner -y -copyts -i BASELINE -i HQ_SOURCE
  -map 0:v:0 -map 1:a:0 -c:v copy
  -ac 1 -ar 16000 -c:a libopus -b:a 16k -vbr on -application audio
  -movflags +faststart OUTPUT.mp4
```

Do not add `-shortest`, trim, silence removal, normalization, denoising, or a video encoder. Pin the video track to the baseline and the audio track to the original HQ input. `-ar16000` is the encoder-input resampling choice; Opus container/decode metadata commonly reports48kHz. Do not require decoded sample-rate metadata to equal16kHz or misreport that difference as upsampling newly recovered detail.

Limits: one encode process at most120seconds, complete proof at most5minutes, output at most60MiB, job directory at most256MiB including copied inputs/output/probes. Enforce bounds during writes and kill/wait/cleanup on failure; check free space before starting. No automatic retry, no fallback codec, no replacement of baseline. Keep failed receipts and partial output explicitly unqualified.

Before acoustic or playback acceptance, independently verify original source identities and output bytes/hash, MP4+H.264+Opus actual codecs, exactly one video and one audio track, mono audio, and actual bitrate/duration. Require copied video sample payload SHA, sample count, ordered PTS/DTS and per-sample duration to equal the baseline exactly. A changed video timeline is a failed controlled experiment even if pixels look similar. Check audio start/end and A/V synchronization against source and AAC baseline; do not silently compensate delay. Capture decoded frames at matched timestamps to confirm muxing did not change presentation.

Then compare intelligibility, ambience/music preservation and audible artifacts with the retained HQ and AAC96 baseline. Actual desktop decode and declared target iPhone/PWA playback/seek/offline support are separate evidence. If target support or content quality fails, preserve the rejected Opus candidate and existing AAC delivery; no codec substitution or AAC bitrate selection is implicit. Only after independent acceptance may this audio choice be combined with a separately accepted resolution/framerate candidate and the final artifact requalified.

## User-directed proportional bitrate and channel policy — proposed successor

This section supersedes any interpretation that16kbps is universal. The user requires bitrate and mono/stereo choice to scale with video budget. No numerical ratio, intelligibility minimum or stereo threshold has been established. Proposed values below are bounded experimental candidates, not production defaults.

Use nominal video payload budget V, not observed total file size. For voice-dominant content whose mono downmix preserves meaningful content, propose `Avoice(V)=clamp(round_to_1000(V×16000/450000),8000,32000)` bits/s. The3.56% ratio is anchored at existing voice-medium16kbps/450kbps video. The8–32kbps endpoints are implemented low/high recipe anchors, not proven universal intelligibility bounds. At200kbps raw7.11kbps clamps8kbps; at337.5kbps it is12kbps;450→16;675→24;900→32. Apply the actual video budget for480/540 renditions, not their resolution label. Do not force both to16kbps with an unmeasured floor.

For a bounded8/12/16kbps speech comparison, distinguish recipe quality changes:8kbps uses the existing low8kHz mono/libopus/VBR/voip recipe;16kbps uses existing medium16kHz mono/libopus/VBR/audio;12kbps is a new intermediate candidate at16kHz mono/libopus/VBR/audio. These are named treatments, not a pure bitrate-only comparison. Reject unintelligible or damaging results; raise a future floor only from observed content/listening evidence, not presumed safety.32kbps uses existing high24kHz/audio anchor;24kbps is proposed intermediate recipe data, not currently deployed. Decoded Opus metadata may report48kHz; that does not alter the input-resampling declaration.

Channels require both budget and content judgment. Small voice budgets favor mono only after checking intelligibility and meaningful spatial information. Larger budgets make stereo eligible when the retained source actually benefits; a mono voice source does not gain useful stereo merely by doubling channels. For this first bounded policy, provisional stereo eligibility begins only when the computed audio allocation reaches32kbps (V≥900kbps), and eligibility is not acoustic acceptance at32kbps stereo. If source music/ambience or meaningful spatial cues make low-budget mono unacceptable, keep that rendition unqualified or preserve the existing explicitly budgeted stereo baseline. Do not silently discard content. No broad music curve is selected before source classification; documented-but-unimplemented64/96/128kbps music presets are reference anchors only.

AAC has no implemented optimized voice preset in this service. ExistingAAC96kbps stereo remains a compatibility baseline, not the proportional target. Do not reuse the Opus ratio/floor for AAC without codec-specific evidence. If MP4+Opus fails target playback, retain baseline and separately qualify AAC content/channel/budget candidates. NoAAC minimum or ratio is accepted here. WebM/video re-encoding remains outside the minimal audio slice.

The already concrete one-job a13 candidate at450kbps video still uses exact Opus16kbps mono, one point on this proposed curve. Arithmetic checks may cover200/337.5/450/675/900kbps without encoding. The proposed subsequent8/12/16 comparison is bounded to three named audio candidates with identical copied video and original HQ audio, but requires its own exact source/listening plan and independently reviewed execution contract before running; it is not an automatic expansion of the current one-job authorization. Content listening gates selection, not a renewed user-permission request. Current resolution/framerate experiments keep audio byte-identical; compare audio separately, then combine independently accepted choices and requalify total size/A/V sync/target playback. No production default or automatic retry follows from this proposal.
