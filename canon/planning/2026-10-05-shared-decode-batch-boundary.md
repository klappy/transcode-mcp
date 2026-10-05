# Future shared-decode batch boundary

This records a future optimization, not an implementation or dependency of the current release. The existing service remains the approved bounded per-output pipeline.

For one qualified source and a bounded set of outputs, a future batch can decode the source once per pass, apply the qualified cadence cap, split frames, then scale and encode each output. A two-pass job therefore uses two source decodes in total, not one overall, unless a separately specified intermediate is retained. No intermediate is proposed here.

Five outputs still need five distinct first-pass encodes and five second-pass encodes. Each output owns its first-pass statistics, rate target, geometry, audio policy, output verification and publication identity. Statistics are not reused across resolutions or bitrate targets. Sharing decoded frames does not establish that encoded motion statistics are interchangeable.

The prospective benefit is avoiding repeated expensive high-resolution decoding: two source decodes rather than ten for five independently encoded two-pass outputs. It does not guarantee proportional wall-time or monetary savings; concurrent branches compete for CPU and memory, and slow branches can retain frames. A future implementation must separately bound selected outputs, aggregate frames/memory/disk, shared deadline, per-output statistics, failure isolation and publication. Existing rights/source hashes, no-blending cadence and exact output identity checks remain mandatory.

The current 4K-to480 control and 4K-to912 comparison are separate measurements, not a shared-decode implementation. No new batch endpoint, infrastructure, large-core allocation or automatic encode is authorized by this design note.
