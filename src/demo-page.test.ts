import { describe, expect, test } from "bun:test";
import { DEMO_VIDEO_HTML } from "./demo-video";
import { DEMO_PAGE_HTML } from "./demo-page";
import { DEMO_FILM_HTML } from "./demo-film";
import { DEMO_CASESTUDY_HTML } from "./demo-casestudy";
import { DEMO_AUDIOBENCH_HTML } from "./demo-audiobench";

// Each demo page is a single self-contained HTML document with one inline
// <script>. TypeScript's typecheck treats the script contents as an opaque
// string, so a JS syntax error *inside* the emitted <script> (for example a
// botched backslash escape that collapses '\\' to '\' and breaks a string
// literal) passes typecheck but crashes the page at load — no images, no
// controls, nothing. These tests parse each emitted artifact the way a browser
// would, catching that class of bug. Run over every page so the film and case
// study get the same protection the bench has always had.
const PAGES: Array<[string, string]> = [
  ["FIA video", DEMO_VIDEO_HTML],
  ["bench (demo-page.html)", DEMO_PAGE_HTML],
  ["film (demo-film.html)", DEMO_FILM_HTML],
  ["case study (demo-casestudy.html)", DEMO_CASESTUDY_HTML],
  ["audio bench (demo-audiobench.html)", DEMO_AUDIOBENCH_HTML],
];

describe.each(PAGES)("demo page emitted script — %s", (_label, htmlDoc) => {
  test("contains exactly one inline <script> block", () => {
    const matches = htmlDoc.match(/<script>[\s\S]*?<\/script>/g) || [];
    expect(matches.length).toBe(1);
  });

  test("the emitted inline script parses as valid JavaScript", () => {
    const m = htmlDoc.match(/<script>([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    const js = m![1];
    // new Function throws SyntaxError if the script body is not parseable.
    // This is the same parse step the browser performs before execution.
    expect(() => new Function(js)).not.toThrow();
  });

  test("references only DOM ids that exist in the markup", () => {
    // Every static id reference — getElementById('x'), getElementById("x"),
    // and the shorthand querySelector('#x') / $("#x") used by the film and
    // casestudy pages — must have a matching id="x" in the HTML, or the ref
    // is null and the first .addEventListener on it throws at load.
    const ids = new Set<string>();
    for (const mm of htmlDoc.matchAll(/id="([^"]+)"/g)) ids.add(mm[1]);
    const missing: string[] = [];
    for (const mm of htmlDoc.matchAll(
      /getElementById\((['"])([^'"]+)\1\)/g,
    )) {
      if (!ids.has(mm[2])) missing.push(mm[2]);
    }
    // Only flag plain `#id` selector literals; combinators, classes, and
    // dynamically-built selectors (`$("#sk"+s)`) cannot be checked statically.
    for (const mm of htmlDoc.matchAll(
      /(?:querySelector(?:All)?|\$)\((['"])#([A-Za-z_][\w-]*)\1\)/g,
    )) {
      if (!ids.has(mm[2])) missing.push(mm[2]);
    }
    expect(missing).toEqual([]);
  });
});

describe("shared cross-page nav", () => {
  test("every page links to all five routes (shared nav)", () => {
    for (const [label, htmlDoc] of PAGES) {
      expect(htmlDoc, `${label} -> /bench/video`).toContain('href="/bench/video"');
      expect(htmlDoc, `${label} -> /film`).toContain('href="/film"');
      expect(htmlDoc, `${label} -> /bench`).toContain('href="/bench"');
      expect(htmlDoc, `${label} -> /bench/audio`).toContain('href="/bench/audio"');
      expect(htmlDoc, `${label} -> /casestudy`).toContain('href="/casestudy"');
    }
  });

  test("each page marks exactly one nav item as current", () => {
    for (const [label, htmlDoc] of PAGES) {
      // Count the attribute on anchor elements only — not the CSS selector
      // `.xnav a[aria-current="page"]` that also contains the string.
      const current = htmlDoc.match(/<a\b[^>]*\baria-current="page"/g) || [];
      expect(current.length, `${label} current-count`).toBe(1);
    }
  });
});

describe('embedded FIA video previews',()=>{
 test('uses visible native controls and preload none without a covering Play button',()=>{
  expect(DEMO_VIDEO_HTML).toContain('video{display:block;');
  expect(DEMO_VIDEO_HTML).toContain('<video controls playsinline preload="none"');
  expect(DEMO_VIDEO_HTML).not.toContain('class="play"');
  expect(DEMO_VIDEO_HTML).not.toContain('video{display:none');
  expect(DEMO_VIDEO_HTML).toContain('video.poster=posters[item.id]');
  expect(DEMO_VIDEO_HTML).toContain('if(publication.ready&&item.url)video.src=item.url');
  expect(DEMO_VIDEO_HTML).toContain("video.addEventListener('play'");
 });
 test('five distinct matched local posters fit the aggregate byte budget and provenance hashes',async()=>{
  const {createHash}=await import('node:crypto');
  const provenance=(await import('./demo-video-posters.json')).default;
  const match=DEMO_VIDEO_HTML.match(/const posters=(\{[^\n]+\});/);expect(match).not.toBeNull();
  const posters=JSON.parse(match![1]);expect(Object.keys(posters).sort()).toEqual(['medium','old','opt','small','source']);
  let total=0;for(const row of provenance.posters){const bytes=Buffer.from(posters[row.id].split(',')[1],'base64');total+=bytes.length;expect(bytes.length).toBe(row.jpeg.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.jpeg.sha256);expect(row.actualSeconds).toBe(10);expect(row.crop).toBe(false);expect(row.resize).toBe(false);}
  expect(total).toBe(provenance.aggregateBytes);expect(total).toBeLessThanOrEqual(200000);
  const old=provenance.posters.find(p=>p.id==='old')!;expect([old.width,old.height]).toEqual([400,224]);
 });
});
