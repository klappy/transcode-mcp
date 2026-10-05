// Lazy video jobs for approved-host sources outside the closed catalog.
// Separate routes and module so video.mjs/video-catalog.mjs stay byte-identical:
// their hashes feed the catalog encoder revision, and existing cache keys must HIT.
import { readFile, mkdtemp, rm, stat, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encoderIdentity, runBounded, encodeDelivery, validateOutput, videoPhaseLogger, selectCadence, sourceByteCeiling } from './video.mjs';
import { createLazyVideoSelect, noUpscaleRaster } from './video-sources.mjs';
const load = name => readFile(new URL(name, import.meta.url), 'utf8').then(JSON.parse);
const [xsmall, small, medium, large, xlarge] = await Promise.all(['video-contract-xsmall.json', 'video-contract-small.json', 'video-contract-medium.json', 'video-contract.json', 'video-contract-4k-xlarge.json'].map(load));
export const selectLazyVideoContract = createLazyVideoSelect({ xsmall, small, medium, large, xlarge });
const hash = b => createHash('sha256').update(b).digest('hex');
let busy = false;

// Bind the probed source cadence and (no-upscale) raster into the job contract.
export function deriveLazyContract(contract, v) {
  const rate = v?.avg_frame_rate;
  if (typeof rate !== 'string' || rate !== v?.r_frame_rate) throw Error('Unqualified source cadence');
  const cadence = selectCadence(rate), [n, d] = cadence.rate.split('/').map(Number);
  if (!Number.isSafeInteger(v.width) || !Number.isSafeInteger(v.height)) throw Error('Unqualified source geometry');
  const [sn, sd] = /^[1-9]\d*:[1-9]\d*$/.test(v.sample_aspect_ratio || '') ? v.sample_aspect_ratio.split(':').map(Number) : [1, 1];
  if (Math.abs((v.width * sn) / (v.height * sd) / (16 / 9) - 1) > 0.01) throw Error('Unsupported source aspect (16:9 required)');
  const fps = n / d;
  return { ...contract, source: { ...contract.source, geometry: { width: v.width, height: v.height } },
    encoding: { ...contract.encoding, ...noUpscaleRaster(contract.encoding, v.height), sourceFrameRate: rate, outputFrameRate: cadence.rate, fps, keyint: Math.floor(fps * 30) } };
}

export async function lazyEncoderIdentity(signal, selected) {
  const base = await encoderIdentity(signal, selected);
  const lazyAdapterSha256 = hash(await readFile(new URL('./video-lazy.mjs', import.meta.url)));
  const sourcesSha256 = hash(await readFile(new URL('./video-sources.mjs', import.meta.url)));
  return { ...base, revision: hash(JSON.stringify({ base: base.revision, lazyAdapterSha256, sourcesSha256 })), lazyAdapterSha256, sourcesSha256 };
}

async function probe(path, signal) { return JSON.parse((await runBounded('/usr/bin/ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { signal })).toString()); }

export async function handleLazyVideo(req, res) {
  const url = new URL(req.url, 'http://container');
  if (url.pathname === '/video-lazy-info') {
    if ([...url.searchParams.keys()].some(k => !['source_url', 'size'].includes(k)) || ['source_url', 'size'].some(k => url.searchParams.getAll(k).length > 1)) { res.writeHead(400).end('Unsupported video info option'); return; }
    if (req.method !== 'GET') { res.writeHead(405).end('GET only'); return; }
    const selected = selectLazyVideoContract(url.searchParams.get('source_url'), url.searchParams.get('size') || 'large');
    if (!selected) { res.writeHead(400).end('Unapproved source host'); return; }
    try { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await lazyEncoderIdentity(undefined, selected))); }
    catch { res.writeHead(503).end('Encoder unavailable'); }
    return;
  }
  if (url.pathname !== '/video-lazy-transcode') { res.writeHead(404).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }
  if (busy) { res.writeHead(503).end('Video capacity busy'); return; }
  busy = true;
  let dir, phase = () => {}, hasJob = false, limits = large.limits;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), limits.jobMs);
  const abort = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', abort);
  const abortBody = () => { if (!req.complete) req.destroy(); };
  controller.signal.addEventListener('abort', abortBody, { once: true });
  try {
    let raw = Buffer.alloc(0);
    for await (const b of req) { if (raw.length + b.length > limits.requestBytes) throw Error('Request too large'); raw = Buffer.concat([raw, b]); }
    const job = JSON.parse(raw);
    if (!job || typeof job !== 'object' || Array.isArray(job) || Object.keys(job).some(k => !['source_url', 'size', 'recipe', 'encoderRevision'].includes(k))) throw Error('Unsupported video job option');
    const selected = selectLazyVideoContract(job.source_url, job.size);
    if (!selected || job.recipe !== selected.recipe) throw Error('Unapproved video source or recipe');
    phase = videoPhaseLogger(undefined, undefined, selected); hasJob = true; phase('job-start');
    const encoder = await lazyEncoderIdentity(controller.signal, selected);
    if (job.encoderRevision !== encoder.revision) throw Error('Encoder identity changed');
    dir = await mkdtemp(join(tmpdir(), 'fia-video-lazy-'));
    const input = join(dir, 'source.mp4'), output = join(dir, 'output.mp4'), fd = await open(input, 'wx'), digest = createHash('sha256');
    let size = 0;
    try {
      // redirect:'error' keeps the fetch on the approved host.
      const response = await fetch(selected.source.url, { redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(selected.limits.sourceMs)]) });
      if (response.status !== 200 || !response.body) throw Error('Source unavailable');
      if (Number(response.headers.get('content-length') || 0) > sourceByteCeiling(selected)) throw Error('Source too large');
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > sourceByteCeiling(selected)) throw Error('Source exceeds ceiling');
        digest.update(chunk);
        for (let offset = 0; offset < chunk.length;) { const wrote = await fd.write(chunk, offset, chunk.length - offset); if (!wrote.bytesWritten) throw Error('Short file write'); offset += wrote.bytesWritten; }
      }
    } finally { await fd.close(); }
    const sourceSha256 = digest.digest('hex');
    phase('source-verified');
    const sourceProbe = await probe(input, controller.signal);
    const contract = deriveLazyContract(selected, sourceProbe.streams?.find(s => s.codec_type === 'video'));
    const encoding = await encodeDelivery(input, output, dir, sourceProbe, controller.signal, phase, contract);
    const metadata = validateOutput(sourceProbe, await probe(output, controller.signal), contract);
    const length = (await stat(output)).size;
    if (!length || length > contract.limits.bytes) throw Error('Invalid output bytes');
    const body = await readFile(output);
    if (controller.signal.aborted) throw Error('Cancelled');
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(body.length), 'X-Video-Metadata': JSON.stringify({ ...metadata, encoding, sourceSha256, sourceBytes: size, sha256: hash(body), bytes: body.length, encoderRevision: encoder.revision, recipe: contract.recipe, rights: contract.source.provenance }) });
    res.end(body);
  } catch (e) {
    if (!res.headersSent && !res.destroyed) res.writeHead(502).end(String(e.message));
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', abortBody);
    res.off('close', abort);
    try { if (dir) await rm(dir, { recursive: true, force: true }); if (hasJob) phase('cleanup-complete'); }
    catch (error) { if (hasJob) phase('cleanup-failed'); throw error; }
    finally { busy = false; }
  }
}
