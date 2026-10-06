---
title: Collapsed proxy paths are restored once at entry, and every response carries CORS
date: 2026-10-06
status: working
mode: planning
derives_from: canon/planning/2026-05-26-url-vocabulary-and-presets.md
complements:
  - canon/planning/2026-06-22-response-savings-headers.md
  - canon/planning/2026-10-05-legacy-video-pins.md
  - canon/planning/2026-10-05-lazy-video-sources.md
---

# Collapsed proxy paths are restored once at entry, and every response carries CORS

> Some relays merge `//` in a path, so `/video/<options>/https://host/...` arrives as `/video/<options>/https:/host/...`. The Worker restores the second slash once, at entry, using the path parser's rule. The rule applies only to a path with no `http://` or `https://` anywhere, and only to the first `http:/` or `https:/` that starts a segment and is followed by a non-slash. The collapsed URL therefore becomes the canonical request: same parse, allowlist check, legacy pin, cache key, container slot and bytes. Every Worker response, including 4xx/5xx errors and OPTIONS preflight, carries `Access-Control-Allow-Origin: *` and exposes the `X-Transcode-*` headers. No response allows credentials.

---

## Summary — One rewrite at entry, one CORS envelope at exit

**Incident.** Persona test traffic went through a relay that merges slashes. It got `400 Invalid video request`. The error had no CORS headers, so the app could not read it and showed only "Failed to fetch".

**Rule.**

- `normalizeProxyPath` in `src/lib/parse-proxy-path.ts` is the only normalization rule. `parseProxyPath` applies it, and the Worker applies it once to `/image/`, `/audio/` and `/video/` requests before routing, then rewrites the request URL. As a result, every identity check sees the canonical request: the image Cache API key (`request.url`), `legacyPinFor` (the raw path), catalog/lazy selection, the video slot and the audio R2 key.
- **Identity is preserved.** A path the parser already accepted contains `://`, so it is returned byte-identical. The only paths that change are ones that previously failed with `No source URL found in path`. The 14 catalog rows and 3 alpha.13 pins keep the contract hash, `videoKey`, `videoSlot` and pin match recorded from origin/main `c6f3b02` (`src/proxy-path-normalization.test.ts`).
- **The allowlist still applies.** A restored URL goes through the same `isApprovedVideoSource` check as a canonical URL. Requests using encoded slashes, triple slashes, dot segments, userinfo, look-alike hosts or `http:` are rejected with 400 or 403 before any container or source fetch.
- **CORS envelope.** `ensureCors` wraps every response. Responses from routes that already set CORS (video delivery, pinned bytes, reference, MCP) are left unchanged. All other responses get `*` and the `X-Transcode-*` expose list, which now also includes Reason, Error, Pinned and Video-Width/Height. A non-MCP OPTIONS request returns a 204 preflight allowing `GET, HEAD, OPTIONS` and echoing the requested headers (default `Range`), and it never starts a container. An uncaught throw becomes `500 Internal error` with CORS.

**Out of scope.** If the relay also merges a `//` inside the source URL (`https://host/a//b`), the original cannot be recovered. Approved sources contain no `//` after the scheme.
