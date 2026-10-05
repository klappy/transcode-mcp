---
title: Fixed bundled-video reference range adaptation
date: 2026-10-05
status: working
mode: planning
derives_from: canon/planning/2026-10-05-fia-video-showcase.md
---

# Fixed bundled-reference range adaptation

> Preserve verified reference identities while adapting the fixed bundled origin, which returns the complete representation instead of honoring byte ranges.

## Summary — One fixed reference, streamed range slicing

This narrow amendment changes only the accepted FIA showcase reference transport. No encoder, source identity, storage, or general proxy change.

Actual root proof at `integration/reference-handler-proof/receipt.json` verified both full reference bodies: HQ49,851,846bytes/SHA257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718 and bundled2,547,817bytes/SHA47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8. S3 honors byte ranges. The bundled origin ignores the Range request and returns200 with the full pinned representation, strong ETag `"4a3684d646c70e494c9f87b1a920458f"`, MP4 MIME and full Content-Length. Preserve that failed initial range proof; it is not a successful206 test.

Permit one explicit transport adaptation for `/reference/video/a13-bundled` only. Continue sending the validated single Range and exact If-Match. If origin returns206, retain existing exact range validation. If it returns200, require the pinned strong validator, MP4 MIME, no content encoding, no Content-Range, and exact full Content-Length2,547,817. Stream through a counted reader: discard bytes before the requested offset, emit only the requested interval, and cancel/abort upstream immediately after the interval completes. Never buffer the full file. Reject truncation before the interval completes or bytes received exceeding the pinned full size. Preserve25second header and120second total deadlines and consumer cancellation. HEAD may synthesize the requested206 metadata after matching the validator using the already reviewed length allowance; it does not verify content.

Return206 with exact requested Content-Range and Content-Length. Expose an `X-Reference-Range-Mode` value distinguishing native ranges from `full-origin-slice`. Do not claim efficient upstream range transfer: a suffix seek may require fetching nearly the entire2.55MB reference, although the client receives only its requested interval. This is not geographic edge caching and creates no new cache. Partial responses rely on the strong validator bound to the independently verified full source; they do not prove the whole-file SHA anew.

Other references still reject unexpected200 for a range. No redirects, additional source URLs, user-controlled origin, automatic validator refresh, fallback encoding or storage. Keep existing full-response SHA checks. Test prefix/middle/suffix slicing across chunk boundaries, early cancellation, overrun/truncation, wrong full length/validator, HEAD metadata, and refusal on the HQ route. Root performs one bounded actual bundled range proof and browser seek after independent code review; no full source re-acquisition is required merely to update the unit tests.

Rollback removes this one flagged adaptation and restores fail-closed range handling. No existing cached media is deleted.
