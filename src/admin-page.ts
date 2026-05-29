// Admin dashboard for transcode-mcp.
//
// Pattern matches src/demo-page.ts: the HTML lives in src/admin-page.html as a
// real HTML file (no JS template literal escaping), and Wrangler/Bun import it
// as a string via `with { type: "text" }`.
//
// The page itself loads Preact + htm + marked from esm.sh at runtime, then
// fetches the pricing canon and TSVs from raw.githubusercontent.com to render
// the calculator, canon doc, and data tables. Worker-side: no auth (gating is
// Cloudflare Access at the edge per canon/planning/2026-05-29-media-pricing-model.md
// §Decision row "Admin authentication is Cloudflare Access at the edge").
import html from "./admin-page.html" with { type: "text" };

export const ADMIN_PAGE_HTML: string = html as unknown as string;
