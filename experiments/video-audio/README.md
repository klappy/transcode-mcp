# One private video-audio experiment

Implements accepted canon/planning/2026-10-05-video-audio-reuse.md only. Manual dispatch reuses artifact11324160558 from run37258408345; no origin fetch. Exactly one original-HQ-audio Opus medium encode with copied baseline H.264. No runtime changes, TTS, retries or extra8/12kbps encodes.

120-second process, five-minute proof,60MiB OS output bound;256MiB aggregate prior/output evidence budget reserved before encoding. Existing bounded process waits for termination; partial output is preserved unqualified on failure. Docker has no network.

Actual video sample hash/count and ordered packet PTS/DTS/duration must remain identical. Receipt preserves source/baseline/output probes including audio delay/start/end; this is measurement, not A/V synchronization or acoustic acceptance. Decoded frame, listening and physical target playback review remain required. Arithmetic fixtures do not qualify the provisional proportional curve.
