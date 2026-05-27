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

  /* Checkbox pill groups for multi-select controls */
  .checkbox-group {
    display: flex; flex-wrap: wrap; gap: 4px;
  }

  /* Multi-select dropdown — compact trigger that opens a checkbox popover */
  .dropdown-multiselect { position: relative; }
  .dropdown-trigger {
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 7px 10px; font-size: 13px; font-family: inherit;
    cursor: pointer; min-width: 160px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; font-weight: 500;
  }
  .dropdown-trigger:hover { border-color: var(--accent); }
  .dropdown-trigger[aria-expanded="true"] { border-color: var(--accent); }
  .dropdown-summary { color: var(--text); }
  .dropdown-caret { color: var(--text-dim); font-size: 10px; }
  .dropdown-popover {
    position: absolute; top: calc(100% + 4px); left: 0;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px;
    min-width: 280px; max-width: 360px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    z-index: 50;
  }
  .dropdown-popover-header {
    display: flex; gap: 12px;
    padding-bottom: 8px; margin-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .dropdown-link {
    background: transparent; color: var(--accent);
    border: 0; padding: 2px 4px;
    font-size: 12px; cursor: pointer;
    font-weight: 500;
  }
  .dropdown-link:hover { color: var(--text); background: transparent; }
  .dropdown-checkboxes { gap: 4px; }
  .checkbox-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 4px; padding: 4px 8px;
    font-size: 12px; color: var(--text-dim);
    cursor: pointer; user-select: none;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
  }
  .checkbox-pill:hover { border-color: var(--accent); color: var(--text); }
  .checkbox-pill input[type="checkbox"] {
    width: 12px; height: 12px; accent-color: var(--accent);
    margin: 0;
  }
  .checkbox-pill:has(input:checked) {
    background: rgba(122, 184, 255, 0.12);
    border-color: var(--accent);
    color: var(--text);
  }

  /* View mode toggle */
  .view-toggle {
    display: flex; gap: 0; background: var(--panel-2);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 2px; width: fit-content;
  }
  .view-btn {
    background: transparent; color: var(--text-dim);
    border: 0; padding: 6px 12px; font-size: 13px;
    cursor: pointer; border-radius: 4px;
    font-weight: 500;
  }
  .view-btn:hover { color: var(--text); background: transparent; }
  .view-btn.active {
    background: var(--accent); color: #0a1320;
  }
  .view-btn.active:hover { background: var(--accent); color: #0a1320; }

  /* Progress bar shown while batch is loading */
  .progress-bar {
    position: relative;
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 6px; height: 28px; margin-bottom: 16px;
    overflow: hidden;
  }
  .progress-fill {
    background: var(--accent); height: 100%; width: 0%;
    transition: width 0.2s;
  }
  .progress-label {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-family: var(--mono); color: var(--text);
    mix-blend-mode: difference;
  }

  /* Results table view */
  .table-wrap {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; overflow: auto;
  }
  .results-table {
    width: 100%; border-collapse: collapse;
    font-family: var(--mono); font-size: 12px;
  }
  .results-table th,
  .results-table td {
    padding: 8px 12px; text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .results-table th {
    background: var(--panel-2); color: var(--text-dim);
    font-weight: 600; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.04em;
    cursor: pointer; user-select: none;
    position: sticky; top: 0; z-index: 1;
  }
  .results-table th:hover { color: var(--text); }
  .results-table th.sort-active { color: var(--accent); }
  .results-table th.sort-active::after { content: " ▾"; font-size: 9px; }
  .results-table th.sort-active.sort-asc::after { content: " ▴"; }
  .results-table td { color: var(--text); }
  .results-table tr.row-binding-target td:first-child { border-left: 3px solid var(--accent); }
  .results-table tr.row-binding-source td:first-child { border-left: 3px solid var(--accent-2); }
  .results-table tr.row-binding-equal td:first-child { border-left: 3px solid var(--warn); }
  .results-table tbody tr {
    cursor: pointer;
    transition: background 0.1s;
  }
  .results-table tbody tr:hover { background: var(--panel-2); }
  .results-table .preview-cell {
    width: 80px; padding: 4px 8px;
  }
  .results-table .preview-cell img {
    width: 64px; height: 48px; object-fit: cover;
    border-radius: 3px; display: block;
  }
  .results-table .ratio-better { color: var(--accent-2); }
  .results-table .ratio-worse { color: var(--warn); }

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
    width: 100%; /* default — JS overrides to (zoom × 100)% to scale both panels */
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
    <label>Quality presets</label>
    <div class="checkbox-group" id="quality-group">
      <label class="checkbox-pill"><input type="checkbox" value="low" checked> low (q=20)</label>
      <label class="checkbox-pill"><input type="checkbox" value="medium" checked> medium (q=50)</label>
      <label class="checkbox-pill"><input type="checkbox" value="high" checked> high (q=80)</label>
    </div>
  </div>
  <div class="control-group">
    <label>Output formats</label>
    <div class="checkbox-group" id="format-group">
      <label class="checkbox-pill"><input type="checkbox" value="avif" checked> avif</label>
      <label class="checkbox-pill"><input type="checkbox" value="webp" checked> webp</label>
      <label class="checkbox-pill"><input type="checkbox" value="jpeg" checked> jpeg</label>
    </div>
  </div>
  <div class="control-group" style="min-width: 200px;">
    <label>Target size (shortest side)</label>
    <div class="dropdown-multiselect" id="target-dropdown">
      <button type="button" class="dropdown-trigger" id="target-trigger" aria-expanded="false" aria-haspopup="true">
        <span class="dropdown-summary" id="target-summary">6 sizes</span>
        <span class="dropdown-caret">▾</span>
      </button>
      <div class="dropdown-popover" id="target-popover" hidden>
        <div class="dropdown-popover-header">
          <button type="button" class="dropdown-link" id="target-all">all</button>
          <button type="button" class="dropdown-link" id="target-none">none</button>
          <button type="button" class="dropdown-link" id="target-default">default</button>
        </div>
        <div class="checkbox-group dropdown-checkboxes" id="target-group">
          <label class="checkbox-pill"><input type="checkbox" value="320" checked> 320</label>
          <label class="checkbox-pill"><input type="checkbox" value="480" checked> 480</label>
          <label class="checkbox-pill"><input type="checkbox" value="640"> 640</label>
          <label class="checkbox-pill"><input type="checkbox" value="720" checked> 720</label>
          <label class="checkbox-pill"><input type="checkbox" value="854"> 854</label>
          <label class="checkbox-pill"><input type="checkbox" value="960"> 960</label>
          <label class="checkbox-pill"><input type="checkbox" value="1080" checked> 1080</label>
          <label class="checkbox-pill"><input type="checkbox" value="1280"> 1280</label>
          <label class="checkbox-pill"><input type="checkbox" value="1600"> 1600</label>
          <label class="checkbox-pill"><input type="checkbox" value="1920"> 1920</label>
          <label class="checkbox-pill"><input type="checkbox" value="2160" checked> 2160</label>
          <label class="checkbox-pill"><input type="checkbox" value="2560"> 2560</label>
          <label class="checkbox-pill"><input type="checkbox" value="3840" checked> 3840 (4K)</label>
        </div>
      </div>
    </div>
  </div>
  <div class="control-group">
    <label for="sort-select">Sort by</label>
    <select id="sort-select">
      <option value="bpp" selected>bytes / pixel (efficiency)</option>
      <option value="size">file size (smallest first)</option>
      <option value="size-desc">file size (largest first)</option>
      <option value="target">target resolution</option>
      <option value="quality">quality preset</option>
      <option value="format">format</option>
      <option value="encode">encode dimension</option>
      <option value="binding">binding term</option>
      <option value="ratio">vs baseline</option>
    </select>
  </div>
  <div class="control-group">
    <label>View</label>
    <div class="view-toggle">
      <button class="view-btn active" data-view="grid" id="view-grid-btn">Grid</button>
      <button class="view-btn" data-view="table" id="view-table-btn">Table</button>
    </div>
  </div>
  <div style="display: flex; gap: 8px; flex-shrink: 0;">
    <button id="reload">Reload</button>
    <button id="share-link" class="btn-secondary" title="Copy a shareable link to this view">Share link</button>
  </div>
</div>

<div id="source-info" class="source-info">Loading source…</div>

<div id="baseline-wrap" class="baseline-wrap"></div>

<div id="progress-bar" class="progress-bar" hidden>
  <div class="progress-fill" id="progress-fill"></div>
  <div class="progress-label" id="progress-label">0 / 0</div>
</div>

<div id="grid" class="grid"></div>

<div id="table-wrap" class="table-wrap" hidden>
  <table class="results-table">
    <thead>
      <tr>
        <th data-sort-key="target">shortest side</th>
        <th data-sort-key="encode">encode</th>
        <th data-sort-key="quality">q</th>
        <th data-sort-key="format">format</th>
        <th data-sort-key="binding">binds</th>
        <th data-sort-key="size">size</th>
        <th data-sort-key="bpp">bytes/px</th>
        <th data-sort-key="ratio">vs baseline</th>
        <th>preview</th>
      </tr>
    </thead>
    <tbody id="table-body"></tbody>
  </table>
</div>

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
const ALL_TARGETS = [320, 480, 640, 720, 854, 960, 1080, 1280, 1600, 1920, 2160, 2560, 3840];
const DEFAULT_TARGETS = [320, 480, 720, 1080, 2160, 3840];
const ALL_QUALITIES = ['low', 'medium', 'high'];
const ALL_FORMATS = ['avif', 'webp', 'jpeg'];
const FETCH_CONCURRENCY = 6;

const sourceSelect = document.getElementById('source-select');
const customUrl = document.getElementById('custom-url');
const qualityGroup = document.getElementById('quality-group');
const formatGroup = document.getElementById('format-group');
const targetGroup = document.getElementById('target-group');
const targetDropdown = document.getElementById('target-dropdown');
const targetTrigger = document.getElementById('target-trigger');
const targetPopover = document.getElementById('target-popover');
const targetSummary = document.getElementById('target-summary');
const targetAllBtn = document.getElementById('target-all');
const targetNoneBtn = document.getElementById('target-none');
const targetDefaultBtn = document.getElementById('target-default');
const sortSelect = document.getElementById('sort-select');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewTableBtn = document.getElementById('view-table-btn');
const reloadBtn = document.getElementById('reload');
const sourceInfo = document.getElementById('source-info');
const grid = document.getElementById('grid');
const tableWrap = document.getElementById('table-wrap');
const tableBody = document.getElementById('table-body');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

// All loaded results, accumulated as fetches complete. Each entry holds the
// metadata we need to render either a tile or a table row, plus everything
// the compare modal needs.
let explorerResults = [];
let currentViewMode = 'grid';
let currentSortKey = 'bpp';
let currentSortDir = 'asc';
let baselineBytes = 0; // For "vs baseline" ratios in table view
// Incremented on each loadExplorer() call. Workers from a prior invocation
// check their captured generation against this and abort their writes if
// stale, preventing mixed results when the user changes source/filters
// while fetches are still in flight.
let explorerGeneration = 0;
// rAF-coalesced render flag — many concurrent fetches all completing in
// the same frame collapse to a single DOM rebuild instead of N rebuilds.
let renderScheduled = false;

function getCheckedValues(group) {
  return Array.from(group.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}
function setCheckedValues(group, values) {
  const set = new Set(values);
  group.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = set.has(cb.value);
  });
}

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

// Resolves with the natural pixel dimensions of an image URL. Returns
// { w: 0, h: 0 } if the image fails to load — caller can treat that as
// "unknown" and fall back to interpreting target as width directly.
function getNaturalDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = url;
  });
}

// Converts a "shortest side = S" target into the proxy w= value, given the
// source's aspect ratio. The proxy's w parameter resizes the image to that
// width while preserving aspect — so for landscape sources we send the longer
// side, for portrait we send w=S directly (since w IS the shorter side then).
function shortestSideToWidth(shortestSide, sourceW, sourceH) {
  if (!sourceW || !sourceH) return shortestSide; // Unknown source — fall back
  if (sourceW >= sourceH) {
    // Landscape (or square): height is the shorter side, so w = S × aspect
    return Math.round(shortestSide * (sourceW / sourceH));
  }
  // Portrait: width is the shorter side, so w = S directly
  return shortestSide;
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
    // The tile is usable for compare-mode as soon as the path is set; the
    // dimensions just enhance its own display tile but aren't required for
    // the picker to include it.
    tile.classList.remove('loading');
    tile.dataset.path = path;
    tile.dataset.size = String(result.size);
    tile.dataset.cache = cache;
    tile.dataset.format = contentType;
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', 'Open original source preview');

    // Fill in heading + meta immediately. Dimensions get added once the image
    // decodes and we read naturalWidth/Height.
    const heading0 = tile.querySelector('h2');
    if (heading0) heading0.textContent = 'Original source';
    const meta0 = tile.querySelector('.baseline-meta');
    if (meta0) {
      meta0.innerHTML = \`
        <div class="row"><span>format</span><strong>\${contentType}</strong></div>
        <div class="row"><span>size</span><strong>\${formatBytes(result.size)}</strong></div>
        <div class="row"><span>delivery</span><strong>\${encodeMarker || 'passthrough'}</strong></div>
        <div class="row"><span>cache</span><strong>\${cache}</strong></div>
      \`;
    }

    const img = document.createElement('img');
    img.src = path;
    img.alt = 'original source';
    img.onload = () => {
      tile.dataset.sourceW = String(img.naturalWidth);
      tile.dataset.sourceH = String(img.naturalHeight);
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

// ---------------------------------------------------------------------------
// Explorer — multi-select matrix loader, sortable grid + table render

function getSelectedCombinations() {
  const targets = getCheckedValues(targetGroup).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  const qualities = getCheckedValues(qualityGroup);
  const formats = getCheckedValues(formatGroup);
  const combos = [];
  for (const t of targets) {
    for (const q of qualities) {
      for (const f of formats) {
        combos.push({ target: t, quality: q, format: f });
      }
    }
  }
  return combos;
}

function comboId(c) {
  return c.target + ':' + c.quality + ':' + c.format;
}

function setProgress(loaded, total) {
  if (total === 0) {
    progressBar.hidden = true;
    return;
  }
  progressBar.hidden = false;
  const pct = Math.round((loaded / total) * 100);
  progressFill.style.width = pct + '%';
  progressLabel.textContent = loaded + ' / ' + total + ' loaded';
  if (loaded >= total) {
    // Briefly show 100% then hide
    setTimeout(() => { progressBar.hidden = true; }, 600);
  }
}

// Run an array of async work with a concurrency cap. onProgress(done, total)
// fires after each completion.
async function runWithConcurrency(items, worker, maxConcurrent, onProgress) {
  let index = 0;
  let done = 0;
  const total = items.length;
  if (onProgress) onProgress(0, total);

  async function runOne() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      try {
        await worker(items[i], i);
      } catch (_err) {
        // Worker handles its own errors; we just continue the queue
      }
      done++;
      if (onProgress) onProgress(done, total);
    }
  }

  const runners = Array.from({ length: Math.min(maxConcurrent, items.length) }, runOne);
  await Promise.all(runners);
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderExplorer();
  });
}

async function loadExplorer() {
  const myGeneration = ++explorerGeneration;
  const source = currentSource();
  const combos = getSelectedCombinations();

  sourceInfo.innerHTML = 'Source: <strong>' + escapeHtml(source) + '</strong> · ' +
    '<span style="color: var(--text-dim);">' + combos.length + ' combinations to evaluate</span>';

  // Reset state
  explorerResults = [];
  baselineBytes = 0;
  grid.innerHTML = '';
  tableBody.innerHTML = '';

  // Load baseline first — gives us bytes & source dimensions for ratio columns
  await loadBaseline(source);
  if (myGeneration !== explorerGeneration) return;
  // Pick up baseline state from its tile dataset for ratio metrics
  const baselineTile = document.querySelector('.baseline-tile');
  if (baselineTile && baselineTile.dataset.size) {
    baselineBytes = parseInt(baselineTile.dataset.size, 10) || 0;
  }

  if (combos.length === 0) {
    setProgress(0, 0);
    return;
  }

  // Resolve source aspect ratio so we can interpret target as "shortest side".
  // We need the natural dimensions of the unmodified source. Try the baseline
  // tile's dataset first (it may already have them from img.onload); if not
  // there yet, load them via the passthrough URL directly.
  let srcW = parseInt((baselineTile && baselineTile.dataset.sourceW) || '0', 10);
  let srcH = parseInt((baselineTile && baselineTile.dataset.sourceH) || '0', 10);
  if (!srcW || !srcH) {
    const dims = await getNaturalDimensions('/image/' + source);
    if (myGeneration !== explorerGeneration) return;
    srcW = dims.w;
    srcH = dims.h;
  }

  setProgress(0, combos.length);

  await runWithConcurrency(combos, async (combo) => {
    // combo.target is the shortest-side target. Convert to proxy w= for this
    // source's aspect ratio.
    const proxyW = shortestSideToWidth(combo.target, srcW, srcH);
    const path = buildProxyPath(source, proxyW, combo.quality, combo.format);
    const fullUrl = window.location.origin + path;
    try {
      const result = await fetchHead(fullUrl);
      if (myGeneration !== explorerGeneration) return;
      const h = result.headers;
      const encodeW = parseInt(h['x-transcode-encode-w'] || '0', 10);
      const encodeH = parseInt(h['x-transcode-encode-h'] || '0', 10);
      const sourceW = parseInt(h['x-transcode-source-w'] || '0', 10);
      const sourceH = parseInt(h['x-transcode-source-h'] || '0', 10);
      const binding = h['x-transcode-binding'] || '';
      const quality = h['x-transcode-quality'] || '';
      const format = (h['x-transcode-format'] || h['content-type'] || '').replace('image/', '');
      const cache = h['x-transcode-cache'] || '';
      const pixels = encodeW * encodeH;
      const bpp = pixels > 0 ? (result.size / pixels) : 0;
      const entry = {
        id: comboId(combo),
        target: combo.target,             // The shortest-side target (UI semantics)
        requestedW: proxyW,               // The actual proxy w= we sent
        requestedQuality: combo.quality,
        requestedFormat: combo.format,
        path,
        size: result.size,
        bpp,
        sourceW, sourceH,
        encodeW, encodeH,
        binding,
        quality,
        format,
        cache,
      };
      explorerResults.push(entry);
      scheduleRender();
    } catch (err) {
      if (myGeneration !== explorerGeneration) return;
      explorerResults.push({
        id: comboId(combo),
        target: combo.target,
        requestedW: proxyW,
        requestedQuality: combo.quality,
        requestedFormat: combo.format,
        path: '',
        size: 0, bpp: 0,
        sourceW: 0, sourceH: 0,
        encodeW: 0, encodeH: 0,
        binding: 'error',
        quality: '',
        format: '',
        cache: '',
        error: err && err.message ? err.message : 'fetch failed',
      });
      scheduleRender();
    }
  }, FETCH_CONCURRENCY, setProgress);
}

// Sort comparator factory
function compareResults(a, b, key, dir) {
  const sign = dir === 'desc' ? -1 : 1;
  let va, vb;
  switch (key) {
    case 'bpp':       va = a.bpp;       vb = b.bpp;       break;
    case 'size':      va = a.size;      vb = b.size;      break;
    case 'target':    va = a.target;    vb = b.target;    break;
    case 'quality':
      // Map to numeric for sort: low < medium < high
      const qrank = { low: 0, medium: 1, high: 2 };
      va = qrank[a.requestedQuality] ?? -1;
      vb = qrank[b.requestedQuality] ?? -1;
      break;
    case 'format':    va = a.format;    vb = b.format;    break;
    case 'encode':    va = a.encodeW;   vb = b.encodeW;   break;
    case 'binding':   va = a.binding;   vb = b.binding;   break;
    case 'ratio':
      va = baselineBytes > 0 ? a.size / baselineBytes : 0;
      vb = baselineBytes > 0 ? b.size / baselineBytes : 0;
      break;
    default:          va = a.target;    vb = b.target;
  }
  if (va < vb) return -1 * sign;
  if (va > vb) return  1 * sign;
  return 0;
}

function sortedResults() {
  const out = explorerResults.slice();
  out.sort((a, b) => compareResults(a, b, currentSortKey, currentSortDir));
  return out;
}

function renderExplorer() {
  const items = sortedResults();
  if (currentViewMode === 'grid') {
    renderExplorerGrid(items);
  } else {
    renderExplorerTable(items);
  }
}

function renderExplorerGrid(items) {
  // Rebuild the grid in sorted order. Reusing existing tiles avoids image
  // re-fetching since the proxy URL is the same and browser caches it.
  // We just replace the contents in the right order.
  grid.innerHTML = '';
  for (const e of items) {
    const tile = document.createElement('div');
    if (e.error) {
      tile.className = 'tile error';
      tile.innerHTML = '<div class="tile-header"><span class="target">' + e.target +
        'px (shortest)</span><span class="formula">q=' + e.requestedQuality + ',f=' + e.requestedFormat +
        '</span></div><div class="tile-image">failed: ' + escapeHtml(e.error) +
        '</div><div class="tile-meta"></div>';
      grid.appendChild(tile);
      continue;
    }
    tile.className = 'tile ' + bindingClass(e.binding);
    // Same dataset shape the modal expects
    tile.dataset.target = String(e.target);
    tile.dataset.path = e.path;
    tile.dataset.sourceW = String(e.sourceW);
    tile.dataset.sourceH = String(e.sourceH);
    tile.dataset.encodeW = String(e.encodeW);
    tile.dataset.encodeH = String(e.encodeH);
    tile.dataset.binding = e.binding;
    tile.dataset.quality = e.quality;
    tile.dataset.format = e.format;
    tile.dataset.cache = e.cache;
    tile.dataset.size = String(e.size);
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', 'Open ' + e.target + 'px shortest-side preview');

    const bppStr = e.bpp > 0 ? e.bpp.toFixed(3) : '?';
    // For display, show what the user asked for (shortest side) + the
    // actual proxy w= we sent (only meaningfully different on landscape).
    const wHint = e.requestedW && e.requestedW !== e.target ? '  (w=' + e.requestedW + ')' : '';
    tile.innerHTML =
      '<div class="tile-header">' +
        '<span class="target">' + e.target + 'px shortest</span>' +
        '<span class="formula">q=' + e.requestedQuality + ',f=' + e.requestedFormat + wHint + '</span>' +
      '</div>' +
      '<div class="tile-image"><img loading="lazy" src="' + escapeHtml(e.path) + '" alt="' + e.target + 'px shortest side"></div>' +
      '<div class="tile-meta">' +
        '<div class="row"><span>encode</span><strong>' + e.encodeW + ' × ' + e.encodeH + '</strong></div>' +
        '<div class="row"><span>binds</span><strong>' + (e.binding || '—') + '</strong></div>' +
        '<div class="row"><span>quality</span><strong>' + (e.quality || '?') + '</strong></div>' +
        '<div class="row"><span>format</span><strong>' + (e.format || '?') + '</strong></div>' +
        '<div class="row"><span>size</span><strong>' + formatBytes(e.size) + '</strong></div>' +
        '<div class="row"><span>bytes/px</span><strong>' + bppStr + '</strong></div>' +
      '</div>';
    grid.appendChild(tile);
  }
}

function renderExplorerTable(items) {
  tableBody.innerHTML = '';
  // Update sort indicator on headers
  document.querySelectorAll('.results-table th[data-sort-key]').forEach(th => {
    th.classList.remove('sort-active', 'sort-asc');
    if (th.dataset.sortKey === currentSortKey ||
       (currentSortKey === 'size-desc' && th.dataset.sortKey === 'size')) {
      th.classList.add('sort-active');
      if (currentSortDir === 'asc' && currentSortKey !== 'size-desc') {
        th.classList.add('sort-asc');
      }
    }
  });
  for (const e of items) {
    const tr = document.createElement('tr');
    if (e.error) {
      tr.innerHTML = '<td>' + e.target + '</td><td colspan="8">failed: ' + escapeHtml(e.error) + '</td>';
      tableBody.appendChild(tr);
      continue;
    }
    tr.classList.add('row-binding-' + (e.binding || 'unknown'));
    tr.dataset.target = String(e.target);
    tr.dataset.path = e.path;
    tr.dataset.sourceW = String(e.sourceW);
    tr.dataset.sourceH = String(e.sourceH);
    tr.dataset.encodeW = String(e.encodeW);
    tr.dataset.encodeH = String(e.encodeH);
    tr.dataset.binding = e.binding;
    tr.dataset.quality = e.quality;
    tr.dataset.format = e.format;
    tr.dataset.cache = e.cache;
    tr.dataset.size = String(e.size);
    tr.setAttribute('role', 'button');
    tr.setAttribute('tabindex', '0');

    const ratio = baselineBytes > 0 ? (e.size / baselineBytes) : 0;
    const ratioStr = ratio > 0 ? (ratio * 100).toFixed(1) + '%' : '—';
    const ratioCls = ratio > 0 && ratio < 0.5 ? 'ratio-better' : ratio > 1 ? 'ratio-worse' : '';
    const bppStr = e.bpp > 0 ? e.bpp.toFixed(3) : '?';

    tr.innerHTML =
      '<td>' + e.target + 'px</td>' +
      '<td>' + e.encodeW + ' × ' + e.encodeH + '</td>' +
      '<td>' + (e.quality || '?') + '</td>' +
      '<td>' + (e.format || '?') + '</td>' +
      '<td>' + (e.binding || '—') + '</td>' +
      '<td>' + formatBytes(e.size) + '</td>' +
      '<td>' + bppStr + '</td>' +
      '<td class="' + ratioCls + '">' + ratioStr + '</td>' +
      '<td class="preview-cell"><img loading="lazy" src="' + escapeHtml(e.path) + '" alt=""></td>';
    tableBody.appendChild(tr);
  }
}

function setViewMode(mode) {
  currentViewMode = mode;
  if (mode === 'grid') {
    grid.hidden = false;
    tableWrap.hidden = true;
    viewGridBtn.classList.add('active');
    viewTableBtn.classList.remove('active');
  } else {
    grid.hidden = true;
    tableWrap.hidden = false;
    viewGridBtn.classList.remove('active');
    viewTableBtn.classList.add('active');
  }
  renderExplorer();
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

  // Every loaded transcoded tile (from grid view) or table row
  const selector = currentViewMode === 'grid' ? '.tile' : '.results-table tbody tr';
  document.querySelectorAll(selector).forEach(el => {
    if (el.classList.contains('loading') || el.classList.contains('error')) return;
    if (!el.dataset.path) return; // header row or non-result row
    const d = el.dataset;
    const target = parseInt(d.target, 10);
    const encodeW = parseInt(d.encodeW || '0', 10);
    const encodeH = parseInt(d.encodeH || '0', 10);
    const id = 'tile-' + target + '-' + (d.quality || '?') + '-' + (d.format || '?');
    entries.push({
      id,
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

function applyZoom() {
  // Canvas width as a percentage of the viewport. At 100%, canvas fits the
  // viewport. At 200%, canvas is twice as wide and the viewport scrolls.
  // Each cell is 50% of canvas (grid-template-columns: 1fr 1fr), so both
  // panels stay the same display size at every zoom level.
  // Using a percentage instead of measuring clientWidth avoids a timing bug
  // where the modal layout hasn't run yet when renderCompare first fires
  // (display:none → display:flex doesn't synchronously trigger layout, so
  // clientWidth returned 0 and the canvas stayed widthless).
  const pct = Math.max(1, Math.round(compareState.zoom * 100));
  compareCanvas.style.width = pct + '%';
  zoomReadout.textContent = pct + '%';
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

// Tile click → open compare modal with that tile pre-selected on the right
function tileEntryId(el) {
  const target = el.dataset.target;
  const q = el.dataset.quality || '?';
  const f = el.dataset.format || '?';
  return target ? 'tile-' + target + '-' + q + '-' + f : null;
}

grid.addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('loading') || tile.classList.contains('error')) return;
  openCompareModal(tileEntryId(tile));
});
grid.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('loading') || tile.classList.contains('error')) return;
  e.preventDefault();
  openCompareModal(tileEntryId(tile));
});

// Table row click → open compare modal with that row as right panel
tableBody.addEventListener('click', (e) => {
  const row = e.target.closest('tr');
  if (!row || !row.dataset.path) return;
  openCompareModal(tileEntryId(row));
});
tableBody.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest('tr');
  if (!row || !row.dataset.path) return;
  e.preventDefault();
  openCompareModal(tileEntryId(row));
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
    q: params.get('q'),       // comma-separated list of qualities
    f: params.get('f'),       // comma-separated list of formats
    w: params.get('w'),       // comma-separated list of target widths
    sort: params.get('sort'), // sort key
    view: params.get('view'), // 'grid' or 'table'
  };
}

function writeUrlState() {
  const params = new URLSearchParams();
  const sourceVal = currentSource();
  if (sourceVal) params.set('source', sourceVal);

  // Only encode arrays when they differ from "all checked" (the default).
  // Keeps shareable URLs short for the common case.
  const q = getCheckedValues(qualityGroup);
  const f = getCheckedValues(formatGroup);
  const w = getCheckedValues(targetGroup).map(Number);
  if (q.length !== ALL_QUALITIES.length) params.set('q', q.join(','));
  if (f.length !== ALL_FORMATS.length) params.set('f', f.join(','));
  // Targets: only encode if different from the default selection (not "all")
  const defaultTargetsSorted = DEFAULT_TARGETS.slice().sort((a, b) => a - b).join(',');
  const wSorted = w.slice().sort((a, b) => a - b).join(',');
  if (wSorted !== defaultTargetsSorted) params.set('w', w.join(','));
  if (currentSortKey !== 'bpp') {
    const sortValue = currentSortKey === 'size' && currentSortDir === 'desc' ? 'size-desc' : currentSortKey;
    params.set('sort', sortValue);
  }
  if (currentViewMode !== 'grid') params.set('view', currentViewMode);

  const qs = params.toString();
  const newUrl = window.location.pathname + (qs ? '?' + qs : '');
  history.replaceState(null, '', newUrl);
}

function applyUrlState() {
  const { source, q, f, w, sort, view } = readUrlState();
  if (source) {
    const matchingOption = Array.from(sourceSelect.options).find(opt => opt.value === source);
    if (matchingOption) {
      sourceSelect.value = source;
      customUrl.value = '';
    } else {
      customUrl.value = source;
    }
  }
  if (q !== null) {
    setCheckedValues(qualityGroup, q.split(',').filter(s => ALL_QUALITIES.includes(s)));
  }
  if (f !== null) {
    setCheckedValues(formatGroup, f.split(',').filter(s => ALL_FORMATS.includes(s)));
  }
  if (w !== null) {
    setCheckedValues(targetGroup, w.split(',').filter(s => ALL_TARGETS.includes(parseInt(s, 10))));
  }
  if (sort) {
    const validSorts = ['bpp', 'size', 'size-desc', 'target', 'quality', 'format', 'encode', 'binding', 'ratio'];
    if (validSorts.includes(sort)) {
      if (sort === 'size-desc') {
        currentSortKey = 'size';
        currentSortDir = 'desc';
        sortSelect.value = 'size-desc';
      } else {
        currentSortKey = sort;
        sortSelect.value = sort;
      }
    }
  }
  if (view === 'table') {
    setViewMode('table');
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

// Debounce checkbox changes so toggling several pills doesn't fire N reloads
let reloadTimer = null;
function scheduleReload() {
  writeUrlState();
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { loadExplorer(); }, 280);
}

// Update the dropdown summary ("6 widths") based on what's selected
function updateTargetSummary() {
  const checked = getCheckedValues(targetGroup);
  const n = checked.length;
  if (n === 0) {
    targetSummary.textContent = 'none selected';
  } else if (n === ALL_TARGETS.length) {
    targetSummary.textContent = 'all ' + n + ' sizes';
  } else {
    targetSummary.textContent = n + ' size' + (n === 1 ? '' : 's');
  }
}

// Dropdown open/close + outside-click + Esc to close
function setTargetDropdownOpen(open) {
  targetTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  targetPopover.hidden = !open;
}
targetTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  setTargetDropdownOpen(targetPopover.hidden);
});
document.addEventListener('click', (e) => {
  if (targetPopover.hidden) return;
  if (!targetDropdown.contains(e.target)) setTargetDropdownOpen(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !targetPopover.hidden) setTargetDropdownOpen(false);
});

// Quick-set buttons
targetAllBtn.addEventListener('click', () => {
  setCheckedValues(targetGroup, ALL_TARGETS.map(String));
  updateTargetSummary();
  scheduleReload();
});
targetNoneBtn.addEventListener('click', () => {
  setCheckedValues(targetGroup, []);
  updateTargetSummary();
  scheduleReload();
});
targetDefaultBtn.addEventListener('click', () => {
  setCheckedValues(targetGroup, DEFAULT_TARGETS.map(String));
  updateTargetSummary();
  scheduleReload();
});

reloadBtn.addEventListener('click', () => { loadExplorer(); });
sourceSelect.addEventListener('change', () => {
  customUrl.value = '';
  writeUrlState();
  loadExplorer();
});
customUrl.addEventListener('change', () => {
  writeUrlState();
  loadExplorer();
});
qualityGroup.addEventListener('change', scheduleReload);
formatGroup.addEventListener('change', scheduleReload);
targetGroup.addEventListener('change', () => {
  updateTargetSummary();
  scheduleReload();
});

// Sort dropdown — re-renders without re-fetching
sortSelect.addEventListener('change', () => {
  const v = sortSelect.value;
  if (v === 'size-desc') {
    currentSortKey = 'size';
    currentSortDir = 'desc';
  } else {
    currentSortKey = v;
    currentSortDir = 'asc';
  }
  writeUrlState();
  renderExplorer();
});

// View mode toggle
viewGridBtn.addEventListener('click', () => { setViewMode('grid'); writeUrlState(); });
viewTableBtn.addEventListener('click', () => { setViewMode('table'); writeUrlState(); });

// Table header click → sort by that column
document.querySelectorAll('.results-table th[data-sort-key]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sortKey;
    if (key === currentSortKey) {
      currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortKey = key;
      currentSortDir = 'asc';
    }
    sortSelect.value = currentSortKey === 'size' && currentSortDir === 'desc' ? 'size-desc' : currentSortKey;
    writeUrlState();
    renderExplorer();
  });
});

// Initial load
applyUrlState();
updateTargetSummary();
loadExplorer();
writeUrlState();
</script>

</body>
</html>`;
