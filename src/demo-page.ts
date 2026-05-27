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
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    gap: 16px;
  }
  .modal-title { font-size: 15px; font-weight: 600; }
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
  .modal-image-wrap {
    background: #000; display: flex; align-items: center; justify-content: center;
    padding: 0; max-height: calc(100vh - 240px);
    overflow: auto;
  }
  .modal-image-wrap img {
    display: block; height: auto;
    /* width is set inline by JS to match target (or viewport cap) */
  }
  .modal-meta {
    padding: 14px 18px;
    font-family: var(--mono); font-size: 12px;
    color: var(--text-dim);
    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px 24px;
    border-top: 1px solid var(--border);
  }
  .modal-meta .row { display: flex; justify-content: space-between; gap: 8px; }
  .modal-meta .row strong { color: var(--text); font-weight: 500; }
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

<div id="modal-backdrop" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal" id="modal">
    <div class="modal-header">
      <div class="modal-title" id="modal-title">
        <span class="target">target ?px</span>
        <span class="display-info"></span>
      </div>
      <button class="modal-close" id="modal-close" aria-label="Close">×</button>
    </div>
    <div class="modal-image-wrap" id="modal-image-wrap"></div>
    <div class="modal-meta" id="modal-meta"></div>
    <div class="modal-explanation" id="modal-explanation"></div>
  </div>
</div>

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

// Modal
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const modalImageWrap = document.getElementById('modal-image-wrap');
const modalMeta = document.getElementById('modal-meta');
const modalExplanation = document.getElementById('modal-explanation');
const modalCloseBtn = document.getElementById('modal-close');

function openModalForTile(tile) {
  if (tile.classList.contains('loading') || tile.classList.contains('error')) return;
  const d = tile.dataset;
  const target = parseInt(d.target, 10);
  const encodeW = parseInt(d.encodeW || '0', 10);
  const encodeH = parseInt(d.encodeH || '0', 10);
  const sourceW = d.sourceW;
  const sourceH = d.sourceH;
  const binding = d.binding;
  const quality = d.quality;
  const format = d.format;
  const cache = d.cache;
  const size = parseInt(d.size || '0', 10);
  const path = d.path;

  // Cap display width to viewport (with a margin for modal padding/scrollbars)
  const viewportCap = window.innerWidth - 80;
  const displayWidth = Math.min(target, viewportCap);
  const isClamped = displayWidth < target;

  modalTitle.innerHTML =
    '<span class="target">target ' + target + 'px</span>' +
    '<span class="display-info">' +
    (isClamped
      ? 'displayed at ' + displayWidth + 'px (your viewport is narrower than target)'
      : 'displayed at ' + target + 'px (1:1 with target)') +
    '</span>';

  // Render the image at target width — the browser does the final downscale
  // from the encode dimensions (encodeW × encodeH) to this display size.
  // That downscale IS the artifact-filter canon describes.
  const img = document.createElement('img');
  img.src = path;
  img.alt = 'target ' + target + ' preview';
  img.style.width = displayWidth + 'px';
  modalImageWrap.innerHTML = '';
  modalImageWrap.appendChild(img);

  modalMeta.innerHTML =
    '<div class="row"><span>source</span><strong>' + (sourceW || '?') + ' × ' + (sourceH || '?') + '</strong></div>' +
    '<div class="row"><span>encode</span><strong>' + (encodeW || '?') + ' × ' + (encodeH || '?') + '</strong></div>' +
    '<div class="row"><span>display</span><strong>' + displayWidth + 'px wide</strong></div>' +
    '<div class="row"><span>binds</span><strong>' + (binding || '—') + '</strong></div>' +
    '<div class="row"><span>quality</span><strong>q=' + (quality || '?') + '</strong></div>' +
    '<div class="row"><span>format</span><strong>' + (format || '?') + '</strong></div>' +
    '<div class="row"><span>size</span><strong>' + formatBytes(size) + '</strong></div>' +
    '<div class="row"><span>cache</span><strong>' + (cache || '—') + '</strong></div>';

  // Explanation tailored to which term bound
  let explain = '';
  if (binding === 'target') {
    explain =
      'The proxy encoded this image at <code>' + encodeW + '×' + encodeH + '</code> ' +
      '(target × 1.5, mod-16 aligned). Your browser is downscaling that to ' + displayWidth + 'px ' +
      'for display — that downscale is the artifact filter, the same mechanism canon describes for ' +
      '"control the character of the loss."';
  } else if (binding === 'source') {
    const scaleVerb = encodeW < displayWidth ? 'upscaling' : encodeW > displayWidth ? 'downscaling' : 'rendering 1:1';
    const scaleClause = encodeW === displayWidth
      ? 'and your browser is rendering 1:1 at ' + displayWidth + 'px'
      : 'and your browser is ' + scaleVerb + ' from ' + encodeW + 'px to ' + displayWidth + 'px for display';
    explain =
      'Source is small enough that <code>source × 1.5 = ' + encodeW + 'px</code> binds instead of ' +
      'target × 1.5. The proxy encoded at the modest overshoot, ' + scaleClause + '. ' +
      'Without the <code>source × 1.5</code> cap, this would have manufactured pixels from no signal.';
  } else if (binding === 'equal') {
    explain =
      'Source dimensions already match the target. No scaling at the encoder; the only work is ' +
      'format conversion and quality adjustment.';
  }
  modalExplanation.innerHTML = explain;

  modalBackdrop.classList.add('open');
  // Focus close button for keyboard accessibility
  modalCloseBtn.focus();
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  // Free the image so it doesn't stay in memory
  modalImageWrap.innerHTML = '';
}

// Tile click → open modal
grid.addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  if (tile) openModalForTile(tile);
});
grid.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const tile = e.target.closest('.tile');
    if (tile) {
      e.preventDefault();
      openModalForTile(tile);
    }
  }
});

// Close handlers
modalCloseBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) closeModal();
});

reloadBtn.addEventListener('click', loadGrid);
sourceSelect.addEventListener('change', () => { customUrl.value = ''; loadGrid(); });
customUrl.addEventListener('change', loadGrid);
qualitySelect.addEventListener('change', loadGrid);
formatSelect.addEventListener('change', loadGrid);

loadGrid();
</script>

</body>
</html>`;
