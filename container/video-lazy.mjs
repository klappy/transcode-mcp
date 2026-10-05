// Lazy video jobs for approved-host sources outside the closed catalog.
// Separate routes and module so video.mjs/video-catalog.mjs stay byte-identical:
// their hashes feed the catalog encoder revision, and existing cache keys must HIT.
import { readFile, mkdtemp, rm, stat, open, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encoderIdentity, runBounded, deliveryPassArguments, validateCadenceContract, validateSourceCadence, videoPhaseLogger, selectCadence, sourceByteCeiling } from './video.mjs';
import { createLazyVideoSelect, fitLazyRaster, validateLazyGeometry, unqualifiedSource } from './video-sources.mjs';
const load = name => readFile(new URL(name, import.meta.url), 'utf8').then(JSON.parse);
const [xsmall, small, medium, large, xlarge] = await Promise.all(['video-contract-xsmall.json', 'video-contract-small.json', 'video-contract-medium.json', 'video-contract.json', 'video-contract-4k-xlarge.json'].map(load));
export const selectLazyVideoContract = createLazyVideoSelect({ xsmall, small, medium, large, xlarge });
const hash = b => createHash('sha256').update(b).digest('hex');
let busy = false;

// Bind the probed source cadence and fitted raster into the job contract. Runs
// right after the probe and before any encode, so an unqualified source is a
// cheap 422 instead of a 502 after a two-pass encode.
export function deriveLazyContract(contract, v) {
  if (!v) throw unqualifiedSource('Source has no video stream');
  const rate = v.avg_frame_rate;
  if (typeof rate !== 'string' || rate !== v.r_frame_rate) throw unqualifiedSource(`Variable frame rate source not supported: avg_frame_rate ${rate} differs from r_frame_rate ${v.r_frame_rate}; a constant frame rate source is required`);
  let cadence;
  try { cadence = selectCadence(rate); } catch (e) { throw unqualifiedSource(`Unqualified source cadence ${rate}: ${e.message}`); }
  const [n, d] = cadence.rate.split('/').map(Number), fps = n / d;
  const raster = fitLazyRaster(contract.encoding, { width: v.width, height: v.height, sar: v.sample_aspect_ratio });
  const derived = { ...contract, source: { ...contract.source, geometry: { width: v.width, height: v.height } },
    encoding: { ...contract.encoding, ...raster, sourceFrameRate: rate, outputFrameRate: cadence.rate, fps, keyint: Math.floor(fps * 30) } };
  validateLazyGeometry(derived.encoding); validateCadenceContract(derived.encoding);
  return derived;
}

// Same argv as the catalog encoder; only the raster filter differs. The catalog
// builder enforces its 16-aligned 16:9 rule, so it is called with a fixed valid
// stand-in raster and the lazy scale/setsar is swapped in.
const STAND_IN = { width: 256, height: 144, sar: '1:1', dar: '16:9' };
export function lazyPassArguments(input, output, prefix, pass, contract) {
  const e = contract.encoding; validateLazyGeometry(e);
  const args = deliveryPassArguments(input, output, prefix, pass, { ...contract, encoding: { ...e, ...STAND_IN } });
  const i = args.indexOf('-vf'), from = 'scale=256:144:flags=lanczos,setsar=1/1:max=65535';
  if (i < 0 || !args[i + 1].endsWith(from)) throw Error('Unexpected encoder filter');
  args[i + 1] = args[i + 1].slice(0, -from.length) + `scale=${e.width}:${e.height}:flags=lanczos,setsar=${e.sar.replace(':', '/')}:max=65535`;
  // Output audio is checked at 48 kHz; the large/xlarge profiles only pin it via
  // their catalog sources, so an arbitrary (e.g. 44.1 kHz) source is resampled.
  if (pass === 2 && !args.includes('-ar')) args.splice(args.indexOf('-movflags'), 0, '-ar', '48000');
  return args;
}

// encodeDelivery (video.mjs) with the lazy argv; the loop and its checks are the same.
async function lazyEncode(input, output, dir, sourceProbe, signal, phase, contract) {
  const e = contract.encoding, v = sourceProbe.streams.find(s => s.codec_type === 'video');
  validateSourceCadence(v, e);
  if (v?.width !== contract.source.geometry.width || v?.height !== contract.source.geometry.height) throw Error('Unqualified source geometry');
  const prefix = join(dir, 'pass'), start = Date.now(), passes = [], statistics = [];
  const local = AbortSignal.any([signal, AbortSignal.timeout(contract.limits.encodeMs)]);
  try {
    for (const pass of [1, 2]) {
      const remaining = contract.limits.encodeMs - (Date.now() - start); if (remaining <= 0) throw Error('Combined encode deadline');
      let log = '', spawned = false, reported = false; const began = Date.now();
      await runBounded('/usr/bin/ffmpeg', lazyPassArguments(input, output, prefix, pass, contract), { timeout: remaining, signal: local, outputPath: pass === 1 ? '/dev/null' : output, limit: pass === 1 ? contract.limits.passlogFileBytes : contract.limits.bytes, onSpawn: () => { spawned = true; }, onClose: ({ outcome }) => phase('encode-exited', { pass, outcome }), onStderr: b => { log = (log + b.toString()).slice(-contract.limits.stderrBytes); if (spawned && !reported && /frame=\s*[1-9]\d*/.test(log)) { reported = true; phase('encode-spawned', { pass }); } } });
      const settings = pass === 1 ? (await readFile(prefix + '-0.log', 'utf8')).split('\n')[0] : log;
      for (const token of [...(pass === 1 ? [`fps=${e.outputFrameRate}`] : []), `bitrate=${Math.floor(e.videoBps / 1000)}`, `vbv_maxrate=${Math.floor(e.maxrateBps / 1000)}`, `vbv_bufsize=${Math.floor(e.bufferBits / 1000)}`, `keyint=${e.keyint}`, `scenecut=${e.scenecut}`, pass === 1 ? 'rc=abr' : 'rc=2pass']) if (!settings.includes(token)) throw Error('Unconfirmed encoder setting ' + token);
      let total = 0;
      for (const name of (await readdir(dir)).filter(n => n.startsWith('pass'))) { if (!/^pass-0\.log(?:\.mbtree)?(?:\.temp)?$/.test(name)) throw Error('Unexpected statistics file'); const length = (await stat(join(dir, name))).size; if (length > contract.limits.passlogFileBytes) throw Error('Statistics file ceiling'); total += length; }
      if (total > contract.limits.passlogTotalBytes) throw Error('Statistics aggregate ceiling');
      passes.push({ pass, elapsedMs: Date.now() - began, settingsSha256: hash(settings), appliedSettings: pass === 1 ? settings : undefined });
    }
    for (const name of (await readdir(dir)).filter(n => n.startsWith('pass'))) { const bytes = await readFile(join(dir, name)); statistics.push({ name, bytes: bytes.length, sha256: hash(bytes) }); }
    local.throwIfAborted(); return { passes, statistics, elapsedMs: Date.now() - start };
  } finally { for (const name of (await readdir(dir)).filter(n => n.startsWith('pass'))) await rm(join(dir, name), { force: true }); }
}

// validateOutput (video.mjs) with the lazy raster rule: exact fitted raster, SAR
// and DAR; output display size never exceeds the source display size.
export function validateLazyOutput(source, result, contract) {
  const v = source.streams?.find(s => s.codec_type === 'video'), o = result.streams?.find(s => s.codec_type === 'video');
  const duration = Number(result.format?.duration), sourceDuration = Number(source.format?.duration);
  if (!v || !o || o.codec_name !== 'h264' || o.pix_fmt !== 'yuv420p' || !(duration > 0) || !(sourceDuration > 0) || Math.abs(duration - sourceDuration) > .25) throw Error('Invalid or truncated video output');
  const e = contract.encoding; validateLazyGeometry(e); validateCadenceContract(e);
  const [sn, sd] = /^[1-9]\d*:[1-9]\d*$/.test(v.sample_aspect_ratio || '') ? v.sample_aspect_ratio.split(':').map(Number) : [1, 1], [en, ed] = e.sar.split(':').map(Number);
  if (o.width !== e.width || o.height !== e.height || o.height > v.height || o.width * en * sd > v.width * sn * ed) throw Error('Invalid output dimensions');
  const a = result.streams.find(s => s.codec_type === 'audio');
  if (o.avg_frame_rate !== e.outputFrameRate || o.r_frame_rate !== e.outputFrameRate || o.sample_aspect_ratio !== e.sar || o.display_aspect_ratio !== e.dar || (a && (a.channels !== (e.audioChannels || 2) || Number(a.sample_rate) !== 48000))) throw Error('Target raster/aspect/cadence/audio mismatch');
  const sa = source.streams.some(s => s.codec_type === 'audio'), oa = result.streams.filter(s => s.codec_type === 'audio');
  if (sa ? (oa.length !== 1 || oa[0].codec_name !== 'aac') : oa.length !== 0) throw Error('Audio stream mismatch');
  return { duration, width: o.width, height: o.height, videoCodec: o.codec_name, audioCodec: oa[0]?.codec_name || null };
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
    const encoding = await lazyEncode(input, output, dir, sourceProbe, controller.signal, phase, contract);
    const metadata = validateLazyOutput(sourceProbe, await probe(output, controller.signal), contract);
    const length = (await stat(output)).size;
    if (!length || length > contract.limits.bytes) throw Error('Invalid output bytes');
    const body = await readFile(output);
    if (controller.signal.aborted) throw Error('Cancelled');
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(body.length), 'X-Video-Metadata': JSON.stringify({ ...metadata, encoding, sourceSha256, sourceBytes: size, sha256: hash(body), bytes: body.length, encoderRevision: encoder.revision, recipe: contract.recipe, rights: contract.source.provenance }) });
    res.end(body);
  } catch (e) {
    if (!res.headersSent && !res.destroyed) res.writeHead(e?.status === 422 ? 422 : 502).end(String(e.message));
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', abortBody);
    res.off('close', abort);
    try { if (dir) await rm(dir, { recursive: true, force: true }); if (hasJob) phase('cleanup-complete'); }
    catch (error) { if (hasJob) phase('cleanup-failed'); throw error; }
    finally { busy = false; }
  }
}
