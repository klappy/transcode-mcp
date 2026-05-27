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
  }
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
  .legend span::before {
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
      <option value="https://picsum.photos/id/1015/4000/3000">Phone photo, 4000×3000 (dominant case)</option>
      <option value="https://picsum.photos/id/1043/1920/1080">Scripture screenshot, 1920×1080 (near-target)</option>
      <option value="https://picsum.photos/id/237/2400/1600">Photograph with text, 2400×1600</option>
      <option value="https://picsum.photos/id/1062/400/300">Pericope thumbnail, 400×300 (small source)</option>
      <option value="https://picsum.photos/id/1084/200/300">Portrait thumbnail, 200×300 (tall aspect)</option>
      <option value="https://picsum.photos/id/1059/64/64">Icon, 64×64 (tiny source)</option>
      <option value="https://picsum.photos/id/237/16/16">Pixel art, 16×16 (cap kicks in)</option>
    </select>
  </div>
  <div class="control-group">
    <label for="custom-url">Or paste a URL</label>
    <input type="text" id="custom-url" placeholder="https://example.com/photo.jpg" autocomplete="off">
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
  <div>
    <button id="reload">Reload grid</button>
  </div>
</div>

<div id="source-info" class="source-info">Loading source…</div>

<div id="grid" class="grid"></div>

<div class="legend">
  <span class="target">target × 1.5 binds (normal case)</span>
  <span class="source">source × 1.5 binds (tiny-source cap)</span>
  <span class="equal">source equals target</span>
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

async function loadGrid() {
  const source = currentSource();
  const q = qualitySelect.value;
  const f = formatSelect.value;

  sourceInfo.innerHTML = 'Source: <strong>' + escapeHtml(source) + '</strong>';
  grid.innerHTML = '';

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

reloadBtn.addEventListener('click', loadGrid);
sourceSelect.addEventListener('change', () => { customUrl.value = ''; loadGrid(); });
customUrl.addEventListener('change', loadGrid);
qualitySelect.addEventListener('change', loadGrid);
formatSelect.addEventListener('change', loadGrid);

loadGrid();
</script>

</body>
</html>`;
