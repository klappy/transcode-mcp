# Jordan composite: two closed video comparisons

The user requests a 912p comparison at the existing720p bitrate and a4K-to480 control to measure source-decoding overhead. Reuse the existing pipeline with exactly two additional source/profile rows, not a new service or unrestricted4K source matrix. FIA app choices remain unchanged.

The approved input is the packet-copy Jordan composite: publisher video-only4K VP9 picture plus licensed AAC narration from the approved720p source. It is not the original YouTube audiovisual edition and does not include that edition's music. The composite has225,659,075bytes and SHA256 c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4, at the public hash-addressed URL recorded in the contract. Both source packet payload hashes and timestamps are preserved by the remux;3957video frames and the audio were fully decoded before source acceptance. Source geometry3840×2160,50fps; video79.140seconds, approved audio79.153seconds. Retain the supplied provenance record with the contract.

Allowed comparisons:

- `size=small`: existing480profile,864×480 SAR80:81 DAR16:9,25fps,video300000/max600000/buffer1200000, AAC42667mono.
- `size=xlarge`:1616×912 SAR304:303 DAR16:9,25fps, exactly existing720profile video658536/class675000/max1350000/buffer2700000, AAC96000stereo. This tests the requested higher-raster/same-budget idea; no quality improvement is presumed.

Only this source gets a268,435,456-byte input ceiling. Existing62,914,560-byte output bound and300-second encode/600-second job limits remain unchanged. Source geometry is contract-bound; source URL/hash/length and qualified cadence checks remain mandatory. No other size is admitted for this composite. Existing source/profile contract files remain unchanged.

Internal encoder lookup must resolve the exact allowlisted source URL and size. The composite and original correctly share the a13 attribution ID, so that ID alone cannot select a unique source. Both Worker and container consume the same exact-row catalog. Adapter/catalog hashes advance identities honestly; old fixed showcase files remain retained, and old encoder keys are never aliased.

Root executes at most the two required mechanical qualifications after deployment: cold/HIT/range/full decode, cadence, duration, coded raster/SAR/DAR and actual browser display, plus R2 source/recipe/output identity. Record source transfer, decode/encode pass and cached delivery times separately where observable. Total encode time alone cannot isolate pure decoder CPU cost. No extra perceptual gate or automatic tuning matrix is introduced.
