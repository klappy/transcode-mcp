import { describe, expect, test } from "bun:test";
import { DEMO_PAGE_HTML } from "./demo-page";

// The demo page is a single big template literal. TypeScript's typecheck
// treats its contents as an opaque string, so a JS syntax error *inside* the
// emitted <script> (for example a botched backslash escape that collapses
// '\\' to '\' and breaks a string literal) passes typecheck but crashes the
// page at load — no images, no controls, nothing. These tests parse the
// emitted artifact the way a browser would, catching that class of bug.

describe("demo page emitted script", () => {
  test("contains exactly one inline <script> block", () => {
    const matches = DEMO_PAGE_HTML.match(/<script>[\s\S]*?<\/script>/g) || [];
    expect(matches.length).toBe(1);
  });

  test("the emitted inline script parses as valid JavaScript", () => {
    const m = DEMO_PAGE_HTML.match(/<script>([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    const js = m![1];
    // new Function throws SyntaxError if the script body is not parseable.
    // This is the same parse step the browser performs before execution.
    expect(() => new Function(js)).not.toThrow();
  });

  test("references only DOM ids that exist in the markup", () => {
    // Every getElementById('x') must have a matching id="x" in the HTML, or
    // the ref is null and the first .addEventListener on it throws at load.
    const ids = new Set<string>();
    for (const mm of DEMO_PAGE_HTML.matchAll(/id="([^"]+)"/g)) ids.add(mm[1]);
    const missing: string[] = [];
    for (const mm of DEMO_PAGE_HTML.matchAll(/getElementById\('([^']+)'\)/g)) {
      if (!ids.has(mm[1])) missing.push(mm[1]);
    }
    expect(missing).toEqual([]);
  });
});
