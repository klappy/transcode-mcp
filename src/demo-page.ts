// Demo page for transcode-mcp.
//
// The page lives in demo-page.html as a REAL HTML file — not a JS template
// literal. When it was embedded as a backtick template literal, every
// backtick, ${...}, and backslash across ~1800 lines of HTML/CSS/JS had to be
// hand-escaped; one wrong escape (a regex backslash collapsing) silently broke
// the whole page at load. As a plain .html file there is nothing to escape.
//
// Wrangler imports .html as a string by default (Cloudflare "Bundling" docs:
// .txt/.html/.sql -> string). Bun resolves the same import to a string at
// runtime too. The ambient type can be HTMLBundle (from the toolchain types),
// so we normalize to string via `unknown`.
import html from "./demo-page.html" with { type: "text" };

export const DEMO_PAGE_HTML: string = html as unknown as string;
