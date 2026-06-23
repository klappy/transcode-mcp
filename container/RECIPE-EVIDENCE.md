# Voice + Opus recipe evidence (Slice 1)

Per the Definition of Done, a recipe is "done" when ffprobe evidence shows
duration / bitrate / sample-rate / channels matching the recipe table. This
file records that evidence for the three voice+opus recipes.

## Method

Source: 5.0s stereo 48 kHz sine (`ffmpeg -f lavfi -i sine=...`), encoded with
each recipe's exact ffmpeg argument list from `recipes.mjs`, then measured with
`ffprobe` plus a byte-parse of the Ogg `OpusHead` identification header.

## Results

| recipe        | channels | sample rate (coded) | bitrate         | duration |
| ------------- | -------- | ------------------- | --------------- | -------- |
| voice:low     | 1 (mono) | 8000 Hz             | ~6.0 kb/s (8k)  | 5.0s     |
| voice:medium  | 1 (mono) | 16000 Hz            | ~14.5 kb/s (16k)| 5.0s     |
| voice:high    | 1 (mono) | 24000 Hz            | ~34.8 kb/s (32k)| 5.0s     |

All channels, sample rates, and durations match the canon recipe table; bitrates
track their targets (a pure sine is trivially compressible, so VBR undershoots
low/medium — real speech tracks closer; this is expected VBR behavior, not a
recipe defect).

## Reading the sample rate correctly (important)

`ffprobe` reports the **Ogg stream** `sample_rate` as **48000 for every Opus
file**, regardless of `-ar`. This is not the recipe failing: per RFC 7845, Opus
always decodes at 48 kHz, and the Ogg page advertises that decode rate. The
recipe's intended coded rate (8000/16000/24000) is faithfully recorded in the
`OpusHead` identification header's *Input Sample Rate* field and governs the
encoder's internal bandwidth (NB/WB/SWB). Verify the coded rate from `OpusHead`,
not from the Ogg stream rate.
