# Changelog

All notable changes to transcode-mcp. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/) (0.x — the URL contract is not yet frozen;
1.0 marks the contract freeze, an operator decision).

This file was bootstrapped 2026-07-06 by reconstructing history from merged
PRs and the two version-bump commits (`92f8657` → 0.2.0, `d5da6e3` → 0.3.0).
Earlier granularity lives in `canon/handoffs/` and the PR record.

## [Unreleased]

Shipped to production without a version bump (production still reports 0.3.0);
cutting the next version is an operator call.

### Added
- Audio transcoding to image parity — voice preset + Opus, ffmpeg Container
  behind a Durable Object, R2 content-addressed cache (Slice 1). (#25)
- Savings headers (`X-Transcode-Source-Bytes`, `X-Transcode-Encoded-Bytes`)
  and CORS on every served response, so consuming pages can read what the
  proxy saved. (#27)
- Three-tier deploy: additive production instance (#29), then a main-fed
  development tier replacing the old preview tier (#31). Promotion runs
  development(main) → staging → production; each tier is its own Worker with
  its own bindings. See `canon/governance/deploy-architecture.md`.

### Changed
- Hardcoded production URL repointed to the custom domain
  transcode.klappy.dev. (#30)

## [0.3.0] — 2026-05-28

### Added
- Shortest-side `s=` sizing — stable across phone rotation, replacing literal
  width as the primary size input. (#15)
- Layered MCP testing: unit + live smoke (`smoke-mcp.ts`) + client docs. (#16)
- Explorer true-size render mode, checkbox comparison, inline source
  ranking. (#14)
- Three-page demo SPA with shared nav; film demo at root (#18); pixel-peeping
  compare modal (#9); shareable URL state (#10); multi-select explorer
  matrix (#12); real Aquifer pericope images with re-measured bytes (#23);
  three-lane cold-start race demo (#22).
- Pricing model canon + admin dashboard at `/admin`. (#21)

### Changed
- MCP tool simplified to a URL builder: it teaches the URL convention rather
  than acting on media. (#15)
- Demo mobile responsiveness; race-lane prose matched to measured
  behavior. (#20)

## [0.2.0] — 2026-05-27

### Added
- Real image transcoding: `env.IMAGES` binding wired, URL options parsing,
  first demo page. (#5)
- Demo evolution: click-to-zoom at target display size (#7), baseline source
  tile, side-by-side compare.
- Canon governance pass: writing conventions, project goal, encode
  arithmetic + wrong-turn handoff. (#2, #3, #4)

## [0.1.0] — 2026-05-26

### Added
- Initial scaffold: Worker skeleton (passthrough proxy), URL vocabulary and
  preset canon, exploration + planning journals, MCP server surface.
