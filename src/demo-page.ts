// Demo page for transcode-mcp.
// The page consumes the deployed proxy — it does no client-side image math.
// Each rendered tile is an <img> whose src is a /image/... proxy URL.
// Headers from the proxy (X-Transcode-*) drive the metadata display.

export const DEMO_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>transcode-mcp — Demo</title>
<style>
  :root {
    --bg: #0f1115;
    --panel: #161922;
    --panel-2: #1d212c;
    --text: #e6e8ec;
    --text-dim: #9aa0aa;
    --accent: #7ab8ff;
    --accent-2: #c7f7c5;
    --warn: #ffb86b;
    --border: #2a2f3a;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  body { padding: 24px; max-width: 1600px; margin: 0 auto; line-height: 1.5; }
  h1 { margin: 0 0 6px; font-size: 22px; font-weight: 600; }
  h1 small { color: var(--text-dim); font-weight: 400; font-size: 14px; }
  p.lead { color: var(--text-dim); margin: 0 0 20px; font-size: 14px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .controls {
    display: flex; flex-wrap: wrap; gap: 16px; align-items: end;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 16px; margin-bottom: 24px;
  }
  .control-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 200px; }
  label { font-size: 12px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; }
  select, input[type="text"] {
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 10px; font-size: 14px; font-family: inherit;
  }
  input[type="text"] { font-family: var(--mono); font-size: 12px; }
  button {
    background: var(--accent); color: #0a1320; border: 0;
    border-radius: 6px; padding: 8px 16px; font-weight: 600;
    cursor: pointer; font-size: 14px;
  }
  button:hover { background: #95c8ff; }
  button.btn-secondary {
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border);
  }
  button.btn-secondary:hover { background: var(--border); color: var(--text); }
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: var(--panel); color: var(--text);
    border: 1px solid var(--accent-2);
    border-radius: 6px; padding: 10px 16px;
    font-size: 13px; box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s, transform 0.2s;
    z-index: 200;
  }
  .toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
  .quality-row { display: flex; gap: 8px; align-items: center; }
  .quality-row label { font-size: 14px; color: var(--text); text-transform: none; letter-spacing: 0; }
  .source-info {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;
    font-family: var(--mono); font-size: 12px; color: var(--text-dim);
  }
  .source-info strong { color: var(--text); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .tile {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;
    cursor: pointer; transition: border-color 0.15s, transform 0.15s;
  }
  .tile:hover { border-color: var(--accent); transform: translateY(-1px); }
  .tile.loading, .tile.error { cursor: default; }
  .tile.loading:hover, .tile.error:hover { border-color: var(--border); transform: none; }
  .tile-header {
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    background: var(--panel-2); font-size: 13px; font-weight: 600;
  }
  .tile-header .target { color: var(--accent); }
  .tile-header .formula { color: var(--text-dim); font-weight: 400; font-size: 11px; font-family: var(--mono); margin-top: 2px; display: block; }
  .tile-image {
    background: #000; display: flex; align-items: center; justify-content: center;
    min-height: 160px; position: relative;
  }
  .tile-image img { max-width: 100%; height: auto; display: block; }
  .tile-meta {
    padding: 10px 12px; font-family: var(--mono); font-size: 11px;
    color: var(--text-dim); border-top: 1px solid var(--border);
  }
  .tile-meta .row { display: flex; justify-content: space-between; gap: 8px; }
  .tile-meta .row strong { color: var(--text); font-weight: 500; }
  .tile.error .tile-image { background: #2a1a1a; color: #ff8b8b; font-size: 12px; padding: 16px; text-align: center; }
  .tile.loading .tile-image::before {
    content: "loading…"; color: var(--text-dim); font-size: 12px;
  }
  .file-size.ok { color: var(--accent-2); }
  .file-size.high { color: var(--warn); }

  /* Baseline tile — the unmodified source for comparison */
  .baseline-wrap { margin-bottom: 20px; }
  .baseline-tile {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; overflow: hidden;
    display: grid; grid-template-columns: 1fr 1fr;
    cursor: pointer; transition: border-color 0.15s;
  }
  .baseline-tile:hover { border-color: var(--accent-2); }
  .baseline-tile.loading, .baseline-tile.error { cursor: default; }
  .baseline-tile.loading:hover, .baseline-tile.error:hover { border-color: var(--border); }
  .baseline-tile .baseline-image {
    background: #000;
    display: flex; align-items: center; justify-content: center;
    min-height: 200px; max-height: 360px; overflow: hidden;
  }
  .baseline-tile .baseline-image img {
    max-width: 100%; max-height: 360px; display: block; object-fit: contain;
  }
  .baseline-tile .baseline-info {
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .baseline-tile .baseline-label {
    color: var(--accent-2); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .baseline-tile h2 {
    margin: 0; font-size: 16px; font-weight: 600;
  }
  .baseline-tile .baseline-meta {
    margin-top: 6px;
    font-family: var(--mono); font-size: 11px;
    color: var(--text-dim);
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 6px 16px;
  }
  .baseline-tile .baseline-meta .row { display: flex; justify-content: space-between; gap: 8px; }
  .baseline-tile .baseline-meta strong { color: var(--text); font-weight: 500; }
  .baseline-tile .baseline-note {
    font-size: 11px; color: var(--text-dim); line-height: 1.5;
    border-top: 1px solid var(--border); padding-top: 10px; margin-top: 4px;
  }
  .baseline-tile.error .baseline-image { background: #2a1a1a; color: #ff8b8b; font-size: 12px; padding: 16px; text-align: center; }
  .baseline-tile.loading .baseline-image::before {
    content: "loading…"; color: var(--text-dim); font-size: 12px;
  }
  @media (max-width: 720px) {
    .baseline-tile { grid-template-columns: 1fr; }
  }

  /* Modal */
  .modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    display: none;
    z-index: 100;
    overflow-y: auto;
    padding: 24px;
  }
  .modal-backdrop.open { display: flex; align-items: flex-start; justify-content: center; }
  .modal {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 12px;
    max-width: calc(100vw - 48px);
    width: auto;
    margin: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    display: flex; flex-direction: column;
  }
  .compare-modal {
    width: min(1600px, calc(100vw - 48px));
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    gap: 16px;
  }
  .modal-title { font-size: 15px; font-weight: 600; flex: 1; }
  .modal-title .target { color: var(--accent); }
  .modal-title .display-info { color: var(--text-dim); font-weight: 400; font-size: 12px; margin-left: 8px; }
  .modal-close {
    background: var(--panel-2); border: 1px solid var(--border);
    color: var(--text); width: 32px; height: 32px;
    border-radius: 6px; cursor: pointer; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .modal-close:hover { background: var(--border); }

  /* Zoom controls */
  .zoom-controls {
    display: flex; align-items: center; gap: 6px;
    flex-shrink: 0;
  }
  .zoom-btn {
    background: var(--panel-2); border: 1px solid var(--border);
    color: var(--text); border-radius: 6px; padding: 6px 10px;
    cursor: pointer; font-size: 13px; font-weight: 500;
    min-width: 32px; line-height: 1.2;
  }
  .zoom-btn:hover { background: var(--border); }
  .zoom-readout {
    color: var(--text-dim); font-family: var(--mono); font-size: 12px;
    min-width: 52px; text-align: center; user-select: none;
  }
  .zoom-fit { font-size: 12px; padding: 6px 8px; }

  /* Compare panel headers */
  .compare-panels {
    display: grid; grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--border);
  }
  .compare-panel {
    padding: 12px 14px;
    border-right: 1px solid var(--border);
  }
  .compare-panel:last-child { border-right: 0; }
  .compare-panel-header {
    display: flex; flex-direction: column; gap: 6px;
  }
  .compare-picker-label {
    font-size: 10px; color: var(--text-dim);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .compare-picker {
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 8px; font-size: 12px; font-family: var(--mono);
    width: 100%;
  }
  .compare-panel-meta {
    font-family: var(--mono); font-size: 10px;
    color: var(--text-dim);
    display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 3px 12px;
    margin-top: 4px;
  }
  .compare-panel-meta .row { display: flex; justify-content: space-between; gap: 6px; }
  .compare-panel-meta strong { color: var(--text); font-weight: 500; }

  /* The shared scrolling viewport: one container, two image cells side by side.
     Pan/zoom is "free" because they share the scroll position. */
  .compare-viewport {
    background: #000;
    overflow: auto;
    max-height: calc(100vh - 380px);
    min-height: 320px;
    position: relative;
  }
  .compare-canvas {
    display: grid; grid-template-columns: 1fr 1fr;
    /* width is set inline by JS based on zoom factor; both cells inherit
       the same column width so images stay aligned spatially. */
  }
  .compare-image-cell {
    display: flex; align-items: flex-start; justify-content: center;
    background: #000;
    position: relative;
    overflow: hidden;
  }
  .compare-image-cell::before {
    content: attr(data-side);
    position: absolute; top: 6px; left: 6px;
    background: rgba(0,0,0,0.65); color: var(--text);
    font-size: 10px; font-family: var(--mono);
    padding: 2px 6px; border-radius: 3px;
    text-transform: uppercase; letter-spacing: 0.08em;
    z-index: 2;
  }
  .compare-image-cell img {
    display: block; width: 100%; height: auto;
  }
  .modal-explanation {
    padding: 14px 18px;
    font-size: 12px;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    line-height: 1.6;
  }
  .modal-explanation code {
    background: var(--panel-2); padding: 1px 5px;
    border-radius: 3px; font-size: 11px;
    color: var(--text);
  }
  details { margin-top: 24px; }
  summary { cursor: pointer; color: var(--text-dim); font-size: 13px; padding: 8px 0; }
  details[open] summary { color: var(--text); }
  pre {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 6px; padding: 12px; font-size: 11px;
    overflow-x: auto; color: var(--text-dim);
  }
  .canon-link { font-size: 12px; color: var(--text-dim); }
  .legend {
    display: flex; gap: 16px; flex-wrap: wrap; font-size: 11px;
    color: var(--text-dim); margin-top: 12px;
  }
  .legend .target::before,
  .legend .source::before,
  .legend .equal::before {
    content: "■"; margin-right: 4px;
  }
  .legend .target::before { color: var(--accent); }
  .legend .source::before { color: var(--accent-2); }
  .legend .equal::before { color: var(--warn); }
</style>
</head>
<body>

<h1>transcode-mcp <small>— half-class overshoot, live</small></h1>
<p class="lead">
  Each tile below requests the source image through the proxy at a different target width.
  The proxy computes the encode dimension via
  <code>ceil_to_mod16(min(target × 1.5, source × 1.5))</code>
  and returns the transcoded image. The displayed dimensions and file size come from the
  <code>X-Transcode-*</code> response headers — nothing here is calculated client-side.
  <span class="canon-link">Spec: <a href="https://github.com/klappy/transcode-mcp/blob/main/canon/planning/2026-05-27-encode-resolution-arithmetic.md">encode-resolution-arithmetic.md</a></span>
</p>

<div class="controls">
  <div class="control-group">
    <label for="source-select">Source image</label>
    <select id="source-select">
      <option value="https://images.unsplash.com/photo-1495020689067-958852a7765e">Person reading newspaper, 6016×4016 (text on paper, real-world test)</option>
      <option value="https://images.unsplash.com/photo-1457369804613-52c61a468e7d">Wall of open books, 5472×3648 (dense small text)</option>
      <option value="https://images.unsplash.com/photo-1554224155-6726b3ff858f">Tax forms with calculator, 5563×3192 (forms, text, mixed objects)</option>
      <option value="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e">Portrait of person, 3840×5760 (face detail, fabric pattern)</option>
      <option value="https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07">Field of poppies, 4928×3264 (the "confetti" case from canon)</option>
      <option value="https://images.unsplash.com/photo-1568667256549-094345857637">Library bookshelves, 4000×5600 (portrait, fine detail)</option>
      <option value="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=850&h=600&fit=crop">Source near target, 850×600 (canon Example 2)</option>
      <option value="https://images.unsplash.com/photo-1495020689067-958852a7765e?w=400&h=300&fit=crop">Small thumbnail, 400×300 (source × 1.5 binds)</option>
      <option value="https://picsum.photos/id/1059/64/64">Tiny icon, 64×64 (cap kicks in)</option>
      <option value="https://picsum.photos/id/237/16/16">Pixel art, 16×16 (extreme cap case)</option>
    </select>
  </div>
  <div class="control-group">
    <label for="custom-url">Or paste a URL</label>
    <input type="text" id="custom-url" placeholder="https://example.com/photo.jpg — or pass ?source=URL in this page's URL" autocomplete="off">
  </div>
  <div class="control-group">
    <label for="quality-select">Quality preset</label>
    <select id="quality-select">
      <option value="low">low (q=20)</option>
      <option value="medium" selected>medium (q=50)</option>
      <option value="high">high (q=80)</option>
    </select>
  </div>
  <div class="control-group">
    <label for="format-select">Output format</label>
    <select id="format-select">
      <option value="auto" selected>auto (negotiate)</option>
      <option value="avif">avif</option>
      <option value="webp">webp</option>
      <option value="jpeg">jpeg</option>
    </select>
  </div>
  <div style="display: flex; gap: 8px;">
    <button id="reload">Reload grid</button>
    <button id="share-link" class="btn-secondary" title="Copy a shareable link to this view">Share link</button>
  </div>
</div>

<div id="source-info" class="source-info">Loading source…</div>

<div id="baseline-wrap" class="baseline-wrap"></div>

<div id="grid" class="grid"></div>

<div id="modal-backdrop" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal compare-modal" id="modal">
    <div class="modal-header">
      <div class="modal-title" id="modal-title">Compare</div>
      <div class="zoom-controls" id="zoom-controls">
        <button class="zoom-btn" id="zoom-out" aria-label="Zoom out" title="Zoom out (−)">−</button>
        <span class="zoom-readout" id="zoom-readout">100%</span>
        <button class="zoom-btn" id="zoom-in" aria-label="Zoom in" title="Zoom in (+)">+</button>
        <button class="zoom-btn zoom-fit" id="zoom-fit" title="Reset zoom (0)">Reset</button>
      </div>
      <button class="modal-close" id="modal-close" aria-label="Close">×</button>
    </div>

    <div class="compare-panels">
      <div class="compare-panel" data-side="left">
        <div class="compare-panel-header">
          <label class="compare-picker-label">A — left</label>
          <select class="compare-picker" id="compare-picker-left"></select>
          <div class="compare-panel-meta" id="compare-meta-left"></div>
        </div>
      </div>
      <div class="compare-panel" data-side="right">
        <div class="compare-panel-header">
          <label class="compare-picker-label">B — right</label>
          <select class="compare-picker" id="compare-picker-right"></select>
          <div class="compare-panel-meta" id="compare-meta-right"></div>
        </div>
      </div>
    </div>

    <div class="compare-viewport" id="compare-viewport">
      <div class="compare-canvas" id="compare-canvas">
        <div class="compare-image-cell" data-side="left">
          <img id="compare-img-left" alt="left comparison">
        </div>
        <div class="compare-image-cell" data-side="right">
          <img id="compare-img-right" alt="right comparison">
        </div>
      </div>
    </div>

    <div class="modal-explanation" id="modal-explanation"></div>
  </div>
</div>

<div id="toast" class="toast" role="status" aria-live="polite"></div>

<div class="legend">
  <span class="target">target × 1.5 binds (normal case)</span>
  <span class="source">source × 1.5 binds (tiny-source cap)</span>
  <span class="equal">source equals target</span>
  <span style="color: var(--accent); margin-left: auto;">→ click any tile to view at target size</span>
</div>

<details>
  <summary>Test matrix — target widths</summary>
  <pre id="matrix-info">320, 480, 640, 720, 800, 854, 960, 1080, 1280, 1600, 1920, 2560</pre>
</details>

<details>
  <summary>How to read the tile metadata</summary>
  <pre>source  — original dimensions (from X-Transcode-Source-W/H)
encode  — what the proxy actually rendered (from X-Transcode-Encode-W/H)
binds   — which term of min(target × 1.5, source × 1.5) bound the result
quality — numeric quality parameter passed to the encoder
format  — image format negotiated
size    — Content-Length of the response body
cache   — X-Transcode-Cache: HIT, MISS, or PASS (passthrough)</pre>
</details>

<script>
const TARGETS = [320, 480, 640, 720, 800, 854, 960, 1080, 1280, 1600, 1920, 2560];

const sourceSelect = document.getElementById('source-select');
const customUrl = document.getElementById('custom-url');
const qualitySelect = document.getElementById('quality-select');
const formatSelect = document.getElementById('format-select');
const reloadBtn = document.getElementById('reload');
const sourceInfo = document.getElementById('source-info');
const grid = document.getElementById('grid');

function currentSource() {
  const custom = customUrl.value.trim();
  if (custom) return custom;
  return sourceSelect.value;
}

function buildProxyPath(sourceUrl, w, q, f) {
  const opts = [];
  if (w !== undefined && w !== null) opts.push('w=' + w);
  if (q && q !== 'medium') opts.push('q=' + q);
  if (f && f !== 'auto') opts.push('f=' + f);
  const optionsSegment = opts.length ? opts.join(',') + '/' : '';
  return '/image/' + optionsSegment + sourceUrl;
}

async function fetchHead(url) {
  // The proxy doesn't support HEAD; do a GET and read headers only.
  const res = await fetch(url, { method: 'GET' });
  const headers = {};
  res.headers.forEach((v, k) => headers[k] = v);
  // Read body length from Content-Length, or measure if absent
  let size = parseInt(headers['content-length'] || '0', 10);
  if (!size) {
    const buf = await res.arrayBuffer();
    size = buf.byteLength;
  }
  return { status: res.status, headers, size };
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function bindingClass(binding) {
  if (binding === 'target') return 'target';
  if (binding === 'source') return 'source';
  if (binding === 'equal') return 'equal';
  return '';
}

function fileSizeClass(bytes, target) {
  // Heuristic only — flag if the file is unusually large for the target
  const expected = target * target * 0.5; // very loose envelope
  if (bytes > expected * 4) return 'high';
  return 'ok';
}

const baselineWrap = document.getElementById('baseline-wrap');

async function loadBaseline(source) {
  // Passthrough URL: no options, worker just streams the source bytes through.
  // This gives us source dimensions and original file size as a baseline for
  // comparing what the transcoded tiles deliver.
  const path = '/image/' + source;
  const fullUrl = window.location.origin + path;

  // Skeleton
  baselineWrap.innerHTML = \`
    <div class="baseline-tile loading">
      <div class="baseline-image"></div>
      <div class="baseline-info">
        <span class="baseline-label">Baseline — Original Source</span>
        <h2>Loading source…</h2>
        <div class="baseline-meta"></div>
      </div>
    </div>
  \`;

  const tile = baselineWrap.querySelector('.baseline-tile');

  try {
    const result = await fetchHead(fullUrl);
    const h = result.headers;
    const contentType = (h['content-type'] || 'image/?').replace('image/', '');
    const cache = h['x-transcode-cache'] || '—';
    const encodeMarker = h['x-transcode-encode'] || '';

    // For the baseline we need the natural dimensions of the source. The
    // passthrough path doesn't set X-Transcode-Source-* headers (because no
    // transform was attempted), so we measure from the loaded image instead.
    // We'll fill these in once the image loads.
    tile.dataset.path = path;
    tile.dataset.size = String(result.size);
    tile.dataset.cache = cache;
    tile.dataset.format = contentType;
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', 'Open original source preview');

    const img = document.createElement('img');
    img.src = path;
    img.alt = 'original source';
    img.onload = () => {
      tile.dataset.sourceW = String(img.naturalWidth);
      tile.dataset.sourceH = String(img.naturalHeight);
      tile.classList.remove('loading');
      const heading = tile.querySelector('h2');
      heading.innerHTML = \`Original source <span style="color: var(--text-dim); font-weight: 400; font-size: 13px;">\${img.naturalWidth} × \${img.naturalHeight}</span>\`;
      const meta = tile.querySelector('.baseline-meta');
      meta.innerHTML = \`
        <div class="row"><span>dimensions</span><strong>\${img.naturalWidth} × \${img.naturalHeight}</strong></div>
        <div class="row"><span>format</span><strong>\${contentType}</strong></div>
        <div class="row"><span>size</span><strong>\${formatBytes(result.size)}</strong></div>
        <div class="row"><span>delivery</span><strong>\${encodeMarker || 'passthrough'}</strong></div>
        <div class="row"><span>cache</span><strong>\${cache}</strong></div>
      \`;
    };
    img.onerror = () => {
      tile.classList.add('error');
      tile.querySelector('.baseline-image').textContent = 'failed to load source';
    };
    tile.querySelector('.baseline-image').appendChild(img);

    // Add a small note explaining the comparison
    const info = tile.querySelector('.baseline-info');
    const note = document.createElement('div');
    note.className = 'baseline-note';
    note.textContent =
      'Served through the proxy without any options applied — the worker ' +
      'streams the origin bytes through unchanged. This is the comparison ' +
      'baseline: every transcoded tile below is what the proxy delivers when ' +
      'asked to transform this source for the corresponding target width.';
    info.appendChild(note);
  } catch (err) {
    tile.classList.remove('loading');
    tile.classList.add('error');
    tile.querySelector('.baseline-image').textContent = 'failed: ' + err.message;
  }
}

async function loadGrid() {
  const source = currentSource();
  const q = qualitySelect.value;
  const f = formatSelect.value;

  sourceInfo.innerHTML = 'Source: <strong>' + escapeHtml(source) + '</strong>';
  grid.innerHTML = '';

  // Build and load the baseline tile (source through proxy passthrough — no
  // options applied means the worker streams the source unmodified).
  loadBaseline(source);

  // Build tiles up front so they appear immediately
  const tiles = TARGETS.map(target => {
    const tile = document.createElement('div');
    tile.className = 'tile loading';
    const path = buildProxyPath(source, target, q, f);
    tile.innerHTML = \`
      <div class="tile-header">
        <span class="target">target \${target}px</span>
        <span class="formula">w=\${target},q=\${q},f=\${f}</span>
      </div>
      <div class="tile-image"></div>
      <div class="tile-meta" data-target="\${target}"><div class="row"><span>loading…</span></div></div>
    \`;
    grid.appendChild(tile);
    return { tile, target, path };
  });

  // Load all in parallel
  await Promise.all(tiles.map(async ({ tile, target, path }) => {
    const fullUrl = window.location.origin + path;
    try {
      const result = await fetchHead(fullUrl);
      const h = result.headers;
      const sourceW = h['x-transcode-source-w'];
      const sourceH = h['x-transcode-source-h'];
      const encodeW = h['x-transcode-encode-w'];
      const encodeH = h['x-transcode-encode-h'];
      const binding = h['x-transcode-binding'] || '';
      const quality = h['x-transcode-quality'];
      const format = (h['x-transcode-format'] || h['content-type'] || '').replace('image/', '');
      const cache = h['x-transcode-cache'] || '';

      tile.classList.remove('loading');
      tile.classList.add(bindingClass(binding));
      // Store metadata for the modal
      tile.dataset.target = String(target);
      tile.dataset.path = path;
      tile.dataset.sourceW = sourceW || '';
      tile.dataset.sourceH = sourceH || '';
      tile.dataset.encodeW = encodeW || '';
      tile.dataset.encodeH = encodeH || '';
      tile.dataset.binding = binding;
      tile.dataset.quality = quality || '';
      tile.dataset.format = format;
      tile.dataset.cache = cache;
      tile.dataset.size = String(result.size);
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('aria-label', 'Open ' + target + 'px preview');

      const img = document.createElement('img');
      img.src = path;
      img.alt = 'target ' + target;
      img.loading = 'lazy';
      const imgWrap = tile.querySelector('.tile-image');
      imgWrap.innerHTML = '';
      imgWrap.appendChild(img);

      const meta = tile.querySelector('.tile-meta');
      const sizeCls = fileSizeClass(result.size, target);
      meta.innerHTML = \`
        <div class="row"><span>source</span><strong>\${sourceW || '?'} × \${sourceH || '?'}</strong></div>
        <div class="row"><span>encode</span><strong>\${encodeW || '?'} × \${encodeH || '?'}</strong></div>
        <div class="row"><span>binds</span><strong>\${binding || '—'}</strong></div>
        <div class="row"><span>quality</span><strong>\${quality || '?'}</strong></div>
        <div class="row"><span>format</span><strong>\${format || '?'}</strong></div>
        <div class="row"><span>size</span><strong class="file-size \${sizeCls}">\${formatBytes(result.size)}</strong></div>
        <div class="row"><span>cache</span><strong>\${cache || '—'}</strong></div>
      \`;
    } catch (err) {
      tile.classList.remove('loading');
      tile.classList.add('error');
      tile.querySelector('.tile-image').textContent = 'failed: ' + err.message;
    }
  }));
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Compare modal
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const modalExplanation = document.getElementById('modal-explanation');
const modalCloseBtn = document.getElementById('modal-close');
const comparePickerLeft = document.getElementById('compare-picker-left');
const comparePickerRight = document.getElementById('compare-picker-right');
const compareMetaLeft = document.getElementById('compare-meta-left');
const compareMetaRight = document.getElementById('compare-meta-right');
const compareImgLeft = document.getElementById('compare-img-left');
const compareImgRight = document.getElementById('compare-img-right');
const compareViewport = document.getElementById('compare-viewport');
const compareCanvas = document.getElementById('compare-canvas');
const zoomReadout = document.getElementById('zoom-readout');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomFitBtn = document.getElementById('zoom-fit');

// Comparison entries built from baseline + all loaded tiles. The id is a
// short stable string used in the picker dropdowns.
let compareEntries = [];
const compareState = {
  leftId: null,
  rightId: null,
  zoom: 1.0,
};
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 16;

function gatherCompareEntries() {
  const entries = [];

  // Baseline (passthrough source) — always entry #1 if loaded
  const baselineTile = document.querySelector('.baseline-tile');
  if (baselineTile && !baselineTile.classList.contains('loading') && !baselineTile.classList.contains('error')) {
    const d = baselineTile.dataset;
    entries.push({
      id: 'baseline',
      kind: 'baseline',
      label: 'Source baseline — ' + (d.sourceW || '?') + '×' + (d.sourceH || '?') + ' ' + (d.format || ''),
      path: d.path,
      sourceW: parseInt(d.sourceW || '0', 10),
      sourceH: parseInt(d.sourceH || '0', 10),
      naturalW: parseInt(d.sourceW || '0', 10),
      naturalH: parseInt(d.sourceH || '0', 10),
      target: null,
      encodeW: null,
      encodeH: null,
      binding: 'passthrough',
      quality: 'n/a',
      format: d.format || '?',
      size: parseInt(d.size || '0', 10),
      cache: d.cache || '—',
    });
  }

  // Every loaded transcoded tile
  document.querySelectorAll('.tile').forEach(tile => {
    if (tile.classList.contains('loading') || tile.classList.contains('error')) return;
    const d = tile.dataset;
    const target = parseInt(d.target, 10);
    const encodeW = parseInt(d.encodeW || '0', 10);
    const encodeH = parseInt(d.encodeH || '0', 10);
    entries.push({
      id: 'tile-' + target,
      kind: 'tile',
      label: 'target ' + target + 'px — encode ' + encodeW + '×' + encodeH + ' q=' + d.quality + ' ' + d.format,
      path: d.path,
      sourceW: parseInt(d.sourceW || '0', 10),
      sourceH: parseInt(d.sourceH || '0', 10),
      naturalW: encodeW,
      naturalH: encodeH,
      target: target,
      encodeW: encodeW,
      encodeH: encodeH,
      binding: d.binding,
      quality: d.quality,
      format: d.format,
      size: parseInt(d.size || '0', 10),
      cache: d.cache || '—',
    });
  });

  return entries;
}

function populateCompareDropdowns() {
  const options = compareEntries.map(e =>
    '<option value="' + e.id + '">' + escapeHtml(e.label) + '</option>'
  ).join('');
  comparePickerLeft.innerHTML = options;
  comparePickerRight.innerHTML = options;
  comparePickerLeft.value = compareState.leftId;
  comparePickerRight.value = compareState.rightId;
}

function findEntry(id) {
  return compareEntries.find(e => e.id === id);
}

function formatMetaBlock(entry) {
  if (entry.kind === 'baseline') {
    return '<div class="row"><span>dim</span><strong>' + entry.naturalW + '×' + entry.naturalH + '</strong></div>' +
           '<div class="row"><span>format</span><strong>' + entry.format + '</strong></div>' +
           '<div class="row"><span>size</span><strong>' + formatBytes(entry.size) + '</strong></div>' +
           '<div class="row"><span>delivery</span><strong>passthrough</strong></div>';
  }
  return '<div class="row"><span>target</span><strong>' + entry.target + 'px</strong></div>' +
         '<div class="row"><span>encode</span><strong>' + entry.encodeW + '×' + entry.encodeH + '</strong></div>' +
         '<div class="row"><span>binds</span><strong>' + entry.binding + '</strong></div>' +
         '<div class="row"><span>q</span><strong>' + entry.quality + '</strong></div>' +
         '<div class="row"><span>format</span><strong>' + entry.format + '</strong></div>' +
         '<div class="row"><span>size</span><strong>' + formatBytes(entry.size) + '</strong></div>';
}

function getViewportInnerWidth() {
  // The width available for the canvas = viewport client width (excludes scrollbar)
  return compareViewport.clientWidth;
}

function applyZoom() {
  const vpW = getViewportInnerWidth();
  if (vpW <= 0) return;
  // Canvas width = viewport width × zoom. Each cell gets half.
  const canvasW = Math.max(1, Math.round(vpW * compareState.zoom));
  compareCanvas.style.width = canvasW + 'px';
  zoomReadout.textContent = Math.round(compareState.zoom * 100) + '%';
}

function setZoom(z) {
  compareState.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  applyZoom();
}

function setZoomFit() {
  setZoom(1.0);
}

function renderCompare() {
  const left = findEntry(compareState.leftId);
  const right = findEntry(compareState.rightId);
  if (!left || !right) return;

  compareImgLeft.src = left.path;
  compareImgLeft.alt = left.label;
  compareImgRight.src = right.path;
  compareImgRight.alt = right.label;

  compareMetaLeft.innerHTML = formatMetaBlock(left);
  compareMetaRight.innerHTML = formatMetaBlock(right);

  comparePickerLeft.value = left.id;
  comparePickerRight.value = right.id;

  // Title summarizes what we're comparing
  modalTitle.innerHTML =
    '<span class="target">Compare:</span> ' +
    '<span style="color: var(--accent-2);">' + escapeHtml(left.label.split(' — ')[0]) + '</span> ' +
    'vs ' +
    '<span style="color: var(--accent);">' + escapeHtml(right.label.split(' — ')[0]) + '</span>';

  // Explanation pulled from the right-hand entry's binding (the "strategy")
  let explain = '';
  if (left.kind === 'baseline' && right.kind === 'baseline') {
    explain = 'Both panels show the unmodified source. Pan and zoom to inspect the original.';
  } else if (right.kind === 'baseline') {
    explain = 'Right panel shows the unmodified source. Compare against the left panel'+'\u2019'+'s encode.';
  } else if (right.binding === 'target') {
    explain =
      'Right panel: proxy encoded at <code>' + right.encodeW + '×' + right.encodeH + '</code> ' +
      '(target × 1.5, mod-16). At equal display size, the browser downscales the encode to the panel — ' +
      'that downscale is the artifact filter. Zoom in to compare pixel-level differences against the left panel.';
  } else if (right.binding === 'source') {
    explain =
      'Right panel: source × 1.5 bound the encode at <code>' + right.encodeW + 'px</code>. ' +
      'Zoom in to see whether the modest overshoot preserved detail you can recognize against the baseline.';
  } else if (right.binding === 'equal') {
    explain =
      'Right panel: source dimensions already matched target — no scaling at encoder. The only loss is quality/format.';
  }
  // If comparing two non-baseline encodes, add a strategy hint
  if (left.kind === 'tile' && right.kind === 'tile') {
    const sizeRatio = right.size > 0 ? (left.size / right.size) : 0;
    if (sizeRatio > 0) {
      explain += ' Byte budget: left=' + formatBytes(left.size) + ', right=' + formatBytes(right.size) +
        ' (left is ' + sizeRatio.toFixed(2) + '× right). ' +
        'When file sizes are comparable, look for which encode'+'\u2019'+'s artifacts are easier on the eye.';
    }
  }
  modalExplanation.innerHTML = explain;

  applyZoom();
}

function openCompareModal(initialRightId = null) {
  compareEntries = gatherCompareEntries();
  if (compareEntries.length < 1) return;

  // Default left: baseline if available, otherwise the first entry
  const defaultLeft = compareEntries.find(e => e.kind === 'baseline') || compareEntries[0];
  // Default right: caller's chosen tile, or fall back to the first non-baseline tile
  let defaultRight = initialRightId ? findEntryInArray(compareEntries, initialRightId) : null;
  if (!defaultRight) defaultRight = compareEntries.find(e => e.kind === 'tile') || defaultLeft;

  compareState.leftId = defaultLeft.id;
  compareState.rightId = defaultRight.id;

  populateCompareDropdowns();
  modalBackdrop.classList.add('open');

  // Reset zoom and render
  compareState.zoom = 1.0;
  renderCompare();
  modalCloseBtn.focus();
}

function findEntryInArray(arr, id) {
  return arr.find(e => e.id === id);
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  // Free image bandwidth/memory on close
  compareImgLeft.removeAttribute('src');
  compareImgRight.removeAttribute('src');
}

// Picker change handlers
comparePickerLeft.addEventListener('change', () => {
  compareState.leftId = comparePickerLeft.value;
  renderCompare();
});
comparePickerRight.addEventListener('change', () => {
  compareState.rightId = comparePickerRight.value;
  renderCompare();
});

// Zoom controls
zoomInBtn.addEventListener('click', () => setZoom(compareState.zoom * 1.5));
zoomOutBtn.addEventListener('click', () => setZoom(compareState.zoom / 1.5));
zoomFitBtn.addEventListener('click', setZoomFit);

// Recalculate canvas width if the window resizes (keeps the zoom ratio)
window.addEventListener('resize', () => {
  if (modalBackdrop.classList.contains('open')) applyZoom();
});

// Tile click → open compare modal with that tile pre-selected on the right
grid.addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('loading') || tile.classList.contains('error')) return;
  const target = tile.dataset.target;
  openCompareModal(target ? 'tile-' + target : null);
});
grid.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('loading') || tile.classList.contains('error')) return;
  e.preventDefault();
  const target = tile.dataset.target;
  openCompareModal(target ? 'tile-' + target : null);
});

// Baseline tile click → open compare modal with baseline on both sides initially
baselineWrap.addEventListener('click', (e) => {
  const tile = e.target.closest('.baseline-tile');
  if (!tile || tile.classList.contains('loading') || tile.classList.contains('error')) return;
  openCompareModal('baseline');
});
baselineWrap.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tile = e.target.closest('.baseline-tile');
  if (!tile || tile.classList.contains('loading') || tile.classList.contains('error')) return;
  e.preventDefault();
  openCompareModal('baseline');
});

// Close handlers
modalCloseBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) closeModal();
  if (!modalBackdrop.classList.contains('open')) return;
  // Zoom hotkeys
  if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(compareState.zoom * 1.5); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(compareState.zoom / 1.5); }
  else if (e.key === '0') { e.preventDefault(); setZoomFit(); }
});

// URL state — read on load, write on change. The page URL itself becomes the
// shareable state: ?source=...&q=...&f=... lets anyone link to a specific view.
// Aquifer (or any other system) can deep-link by appending ?source=<image-url>.

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('source'),
    q: params.get('q'),
    f: params.get('f'),
  };
}

function writeUrlState() {
  // Build a clean query string reflecting current control state.
  const params = new URLSearchParams();
  const customVal = customUrl.value.trim();
  const sourceVal = customVal || sourceSelect.value;
  if (sourceVal) params.set('source', sourceVal);
  if (qualitySelect.value && qualitySelect.value !== 'medium') {
    params.set('q', qualitySelect.value);
  }
  if (formatSelect.value && formatSelect.value !== 'auto') {
    params.set('f', formatSelect.value);
  }
  const qs = params.toString();
  const newUrl = window.location.pathname + (qs ? '?' + qs : '');
  // replaceState so the user can hit back and not get stuck in their own state
  history.replaceState(null, '', newUrl);
}

function applyUrlState() {
  const { source, q, f } = readUrlState();
  if (source) {
    // If the source matches a dropdown option, select it. Otherwise put it in
    // the custom URL field. Either way the page loads with their image.
    const matchingOption = Array.from(sourceSelect.options)
      .find(opt => opt.value === source);
    if (matchingOption) {
      sourceSelect.value = source;
      customUrl.value = '';
    } else {
      customUrl.value = source;
    }
  }
  if (q && ['low', 'medium', 'high'].includes(q)) {
    qualitySelect.value = q;
  }
  if (f && ['auto', 'avif', 'webp', 'jpeg'].includes(f)) {
    formatSelect.value = f;
  }
}

// Show toast for feedback (used after Share-link copy)
const toast = document.getElementById('toast');
let toastTimer = null;
function showToast(message, duration = 2200) {
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}

// Share-link button: copies the current URL to clipboard
const shareLinkBtn = document.getElementById('share-link');
shareLinkBtn.addEventListener('click', async () => {
  // Make sure the URL reflects current state first
  writeUrlState();
  const link = window.location.href;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard');
    } else {
      // Fallback: select the link in a temporary element
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Link copied to clipboard');
    }
  } catch (err) {
    // Last fallback: show the link in a prompt so they can copy manually
    showToast('Copy this link manually (clipboard blocked)');
    window.prompt('Copy this link:', link);
  }
});

reloadBtn.addEventListener('click', loadGrid);
sourceSelect.addEventListener('change', () => {
  customUrl.value = '';
  writeUrlState();
  loadGrid();
});
customUrl.addEventListener('change', () => {
  writeUrlState();
  loadGrid();
});
qualitySelect.addEventListener('change', () => {
  writeUrlState();
  loadGrid();
});
formatSelect.addEventListener('change', () => {
  writeUrlState();
  loadGrid();
});

// Initial load: apply URL state to controls, then load grid, then sync URL
// back (so any defaults missing from the URL get reflected if needed).
applyUrlState();
loadGrid();
writeUrlState();
</script>

</body>
</html>`;
