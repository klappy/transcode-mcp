import { readFile, mkdtemp, rm, stat, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export const contract = JSON.parse(await readFile(new URL('./video-contract.json', import.meta.url), 'utf8'));
const hash = b => createHash('sha256').update(b).digest('hex');
let busy = false;
export function runBounded(command, args, { timeout = 30000, signal, outputPath, limit = contract.limits.bytes } = {}) {
    return new Promise((resolve, reject) => {
        let failure, stdout = Buffer.alloc(0), stderr = '';
        const child = spawn(outputPath ? '/usr/bin/prlimit' : command, outputPath ? [`--fsize=${limit}:${limit}`, '--', command, ...args] : args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const fail = e => { failure ??= e; child.kill('SIGKILL'); };
        const abort = () => fail(new Error('Video job cancelled'));
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted)
            abort();
        const timer = setTimeout(() => fail(new Error('Process timeout')), timeout);
        const monitor = outputPath ? setInterval(async () => { try {
            if ((await stat(outputPath)).size > limit)
                fail(new Error('Output exceeds ceiling'));
        }
        catch { } }, 100) : null;
        child.stdout.on('data', b => { if (stdout.length + b.length > 1024 * 1024)
            fail(new Error('Probe output exceeds ceiling'));
        else
            stdout = Buffer.concat([stdout, b]); });
        child.stderr.on('data', b => stderr = (stderr + b.toString()).slice(-contract.limits.stderrBytes));
        child.on('error', e => { failure = e; });
        child.on('close', code => { clearTimeout(timer); if (monitor)
            clearInterval(monitor); signal?.removeEventListener('abort', abort); if (failure || code !== 0)
            reject(failure || new Error(`Encoder failed ${code}: ${stderr}`));
        else
            resolve(stdout); });
    });
}
export async function encoderIdentity(signal) {
    const version = (await runBounded('/usr/bin/ffmpeg', ['-version'], { signal })).toString();
    const executableSha256=hash(await readFile('/usr/bin/ffmpeg'));
    const linkage=(await runBounded('/usr/bin/ldd',['/usr/bin/ffmpeg'],{signal})).toString();
    const paths=[...new Set(linkage.split('\n').flatMap(line=>line.match(/\/[^\s]+/g)||[]))].sort();
    if(!paths.length||linkage.includes('not found'))throw Error('Encoder linkage unavailable');
    const libraries={};for(const path of paths)libraries[path]=hash(await readFile(path));
    const adapterSha256=hash(await readFile(new URL('./video.mjs',import.meta.url)));
    return { revision:hash(JSON.stringify({contract,version,executableSha256,adapterSha256,libraries})), version, executableSha256, adapterSha256, libraries };
}
export function validateOutput(source, result) {
    const v = source.streams?.find(s => s.codec_type === 'video'), o = result.streams?.find(s => s.codec_type === 'video');
    const duration = Number(result.format?.duration), sourceDuration = Number(source.format?.duration);
    if (!v || !o || o.codec_name !== 'h264' || o.pix_fmt !== 'yuv420p' || !(duration > 0) || !(sourceDuration > 0) || Math.abs(duration - sourceDuration) > .25)
        throw Error('Invalid or truncated video output');
    if (o.width > Math.min(1280, v.width) || o.height > Math.min(720, v.height) || o.width <= 0 || o.height <= 0 || o.width % 2 || o.height % 2)
        throw Error('Invalid output dimensions');
    const sa = source.streams.some(s => s.codec_type === 'audio'), oa = result.streams.filter(s => s.codec_type === 'audio');
    if (sa ? (oa.length !== 1 || oa[0].codec_name !== 'aac') : oa.length !== 0)
        throw Error('Audio stream mismatch');
    return { duration, width: o.width, height: o.height, videoCodec: o.codec_name, audioCodec: oa[0]?.codec_name || null };
}
async function probe(path, signal) { return JSON.parse((await runBounded('/usr/bin/ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { signal })).toString()); }
export async function handleVideo(req, res) {
    if (req.url === '/video-info') {
        if(req.method !== 'GET'){res.writeHead(405).end('GET only');return true;}
        try {
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await encoderIdentity()));
        }
        catch {
            res.writeHead(503).end('Encoder unavailable');
        }
        return;
    }
    if (req.url !== '/video-transcode')
        return false;
    if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
    }
    if (busy) {
        res.writeHead(503).end('Video capacity busy');
        return;
    }
    busy = true;
    let dir;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), contract.limits.jobMs);
    const abort = () => { if (!res.writableEnded)
        controller.abort(); };
    res.on('close', abort);
    const abortBody = () => { if (!req.complete)
        req.destroy(); };
    controller.signal.addEventListener('abort', abortBody, { once: true });
    try {
        let raw = Buffer.alloc(0);
        for await (const b of req) {
            if (raw.length + b.length > contract.limits.requestBytes)
                throw Error('Request too large');
            raw = Buffer.concat([raw, b]);
        }
        const job = JSON.parse(raw);
        if (job.source_url !== contract.source.url || job.recipe !== contract.recipe)
            throw Error('Unapproved video source or recipe');
        const encoder = await encoderIdentity(controller.signal);
        if (job.encoderRevision !== encoder.revision)
            throw Error('Encoder identity changed');
        dir = await mkdtemp(join(tmpdir(), 'fia-video-'));
        const input = join(dir, 'source.mp4'), output = join(dir, 'output.mp4'), fd = await open(input, 'wx');
        let size = 0;
        const digest = createHash('sha256');
        try {
            const response = await fetch(contract.source.url, { redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(contract.limits.sourceMs)]) });
            if (response.status !== 200 || !response.body)
                throw Error('Source unavailable');
            if (Number(response.headers.get('content-length') || 0) > contract.limits.bytes)
                throw Error('Source too large');
            for await (const chunk of response.body) {
                size += chunk.length;
                if (size > contract.limits.bytes)
                    throw Error('Source exceeds ceiling');
                digest.update(chunk);
                let offset = 0;
                while (offset < chunk.length) {
                    const wrote = await fd.write(chunk, offset, chunk.length - offset);
                    if (!wrote.bytesWritten)
                        throw Error("Short file write");
                    offset += wrote.bytesWritten;
                }
            }
        }
        finally {
            await fd.close();
        }
        if (size !== contract.source.bytes || digest.digest('hex') !== contract.source.sha256)
            throw Error('Source identity mismatch');
        const sourceProbe = await probe(input, controller.signal);
        await runBounded('/usr/bin/ffmpeg', ['-nostdin', '-hide_banner', '-y', '-protocol_whitelist', 'file,pipe', '-i', input, ...contract.args, output], { timeout: contract.limits.encodeMs, signal: controller.signal, outputPath: output });
        const outputProbe = await probe(output, controller.signal), metadata = validateOutput(sourceProbe, outputProbe);
        const length = (await stat(output)).size;
        if (!length || length > contract.limits.bytes)
            throw Error('Invalid output bytes');
        const body = await readFile(output);
        if (controller.signal.aborted)
            throw Error('Cancelled');
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(body.length), 'X-Video-Metadata': JSON.stringify({ ...metadata, sourceSha256: contract.source.sha256, sourceBytes: size, sha256: hash(body), bytes: body.length, encoderRevision: encoder.revision, recipe: contract.recipe, rights: contract.source.provenance }) });
        res.end(body);
    }
    catch (e) {
        if (!res.headersSent && !res.destroyed)
            res.writeHead(502).end(String(e.message));
    }
    finally {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', abortBody);
        res.off('close', abort);
        try { if (dir) await rm(dir, { recursive: true, force: true }); }
        finally { busy = false; }
    }
    return true;
}
