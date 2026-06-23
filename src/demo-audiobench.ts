// Audio measurement bench page for transcode-mcp.
//
// Like the other demo pages, this lives as a REAL .html file (not a JS template
// literal) so there is nothing to hand-escape, and is imported as a string.
// Wrangler imports .html as a string by default; Bun resolves the same import
// to a string at runtime. The ambient type can be HTMLBundle, so we normalize
// to string via `unknown`.
//
// Served at /bench/audio (see worker.ts). It is the audio sibling of the image
// bench at /bench: it fetches /audio/... variants, reads the live
// X-Transcode-* headers, and plays the bytes the proxy returned. The homepage
// can link to it once the audio path is live.
import html from "./demo-audiobench.html" with { type: "text" };

export const DEMO_AUDIOBENCH_HTML: string = html as unknown as string;
