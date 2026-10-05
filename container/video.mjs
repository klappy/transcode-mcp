import { readFile, mkdtemp, rm, stat, open, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {createVideoCatalog} from './video-catalog.mjs';
export const contract = JSON.parse(await readFile(new URL('./video-contract.json', import.meta.url), 'utf8'));
export const videoContracts=[contract,...await Promise.all(['a184','a10'].map(async id=>JSON.parse(await readFile(new URL(`./video-contract-${id}.json`,import.meta.url),'utf8'))))];
const targetContracts=Object.fromEntries(await Promise.all(['small','medium'].map(async size=>[size,JSON.parse(await readFile(new URL(`./video-contract-${size}.json`,import.meta.url),'utf8'))])));
const extension=JSON.parse(await readFile(new URL('./video-source-extension.json',import.meta.url),'utf8'));
export const selectVideoContract=createVideoCatalog(videoContracts,targetContracts,extension.recipeRevision).select;
const hash = b => createHash('sha256').update(b).digest('hex');
let busy = false;
export function runBounded(command, args, { timeout = 30000, signal, outputPath, limit = contract.limits.bytes, onStderr, onSpawn, onClose } = {}) {
    return new Promise((resolve, reject) => {
        let failure, stdout = Buffer.alloc(0), stderr = '';
        const child = spawn(outputPath ? '/usr/bin/prlimit' : command, outputPath ? [`--fsize=${limit}:${limit}`, '--', command, ...args] : args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const notify=(fn,value)=>{try{fn?.(value);}catch{}};child.once('spawn',()=>notify(onSpawn));
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
        child.stderr.on('data', b => {stderr = (stderr + b.toString()).slice(-contract.limits.stderrBytes);onStderr?.(b);});
        child.on('error', e => { failure = e; });
        child.on('close', (code,exitSignal) => { clearTimeout(timer); if (monitor)
            clearInterval(monitor); signal?.removeEventListener('abort', abort);notify(onClose,{outcome:signal?.aborted?'cancel':failure||code!==0?'failure':'success'}); if (failure || code !== 0)
            reject(failure || new Error(`Encoder failed code=${code} signal=${exitSignal}: ${stderr}`));
        else
            resolve(stdout); });
    });
}
export async function encoderIdentity(signal, selected=contract) {
    const version = (await runBounded('/usr/bin/ffmpeg', ['-version'], { signal })).toString();
    const executableSha256=hash(await readFile('/usr/bin/ffmpeg'));
    const linkage=(await runBounded('/usr/bin/ldd',['/usr/bin/ffmpeg'],{signal})).toString();
    const paths=[...new Set(linkage.split('\n').flatMap(line=>line.match(/\/[^\s]+/g)||[]))].sort();
    if(!paths.length||linkage.includes('not found'))throw Error('Encoder linkage unavailable');
    const libraries={};for(const path of paths)libraries[path]=hash(await readFile(path));
    const adapterSha256=hash(await readFile(new URL('./video.mjs',import.meta.url)));
    const catalogSha256=hash(await readFile(new URL('./video-catalog.mjs',import.meta.url)));
    return { revision:hash(JSON.stringify({contract:selected,version,executableSha256,adapterSha256,catalogSha256,libraries})), version, executableSha256, adapterSha256, catalogSha256, libraries };
}
export function validateGeometryContract(e) {
 const ratio=x=>{if(typeof x!=='string'||!/^\d+:\d+$/.test(x))throw Error('Explicit SAR/DAR required');const p=x.split(':').map(BigInt);if(p.some(v=>v<=0n))throw Error('Invalid aspect ratio');return p;};
 if(!Number.isSafeInteger(e.width)||!Number.isSafeInteger(e.height)||e.width<=0||e.height<=0||e.width%16||e.height%16)throw Error('Unaligned raster');
 const [sn,sd]=ratio(e.sar),[dn,dd]=ratio(e.dar);
 if(BigInt(e.width)*sn*dd!==BigInt(e.height)*sd*dn||dn*9n!==dd*16n)throw Error('Raster SAR DAR mismatch');
}
export function selectCadence(rate) {
 if(typeof rate!=='string'||!/^\d+\/\d+$/.test(rate))throw Error('Explicit rational cadence required');
 const [n,d]=rate.split('/').map(BigInt);if(n<=0n||d<=0n)throw Error('Invalid cadence');
 const divisor=(n+30n*d-1n)/(30n*d);const k=divisor>1n?divisor:1n;
 const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(n,d*k);
 return {divisor:Number(k),rate:`${n/g}/${d*k/g}`};
}
export function validateCadenceContract(e) {
 const c=selectCadence(e.sourceFrameRate);
 if(e.sourceCadence!=='qualified-cfr'||e.cadencePolicy!=='integer-divisor-max30-v1'||e.outputFrameRate!==c.rate||e.fps!==Number(c.rate.split('/')[0])/Number(c.rate.split('/')[1])||e.keyint!==Math.floor(e.fps*30))throw Error('Cadence contract mismatch');
 return c;
}
export function validateSourceCadence(v,e) {
 validateCadenceContract(e);if(v?.avg_frame_rate!==e.sourceFrameRate||v?.r_frame_rate!==e.sourceFrameRate)throw Error('Unqualified source cadence');
}
export function validateOutput(source, result, selected=contract) {
    const v = source.streams?.find(s => s.codec_type === 'video'), o = result.streams?.find(s => s.codec_type === 'video');
    const duration = Number(result.format?.duration), sourceDuration = Number(source.format?.duration);
    if (!v || !o || o.codec_name !== 'h264' || o.pix_fmt !== 'yuv420p' || !(duration > 0) || !(sourceDuration > 0) || Math.abs(duration - sourceDuration) > .25)
        throw Error('Invalid or truncated video output');
    if (o.width > Math.min(selected.encoding.width, v.width) || o.height > Math.min(selected.encoding.height, v.height) || o.width <= 0 || o.height <= 0 || o.width % 2 || o.height % 2)
        throw Error('Invalid output dimensions');
    const e=selected.encoding;validateGeometryContract(e);validateCadenceContract(e);
    const a=result.streams.find(s=>s.codec_type==='audio');
    if(o.width!==e.width||o.height!==e.height||o.avg_frame_rate!==e.outputFrameRate||o.r_frame_rate!==e.outputFrameRate||o.sample_aspect_ratio!==e.sar||o.display_aspect_ratio!==e.dar||a?.channels!==(e.audioChannels||2)||Number(a.sample_rate)!==48000)throw Error('Target raster/aspect/cadence/audio mismatch');
    const sa = source.streams.some(s => s.codec_type === 'audio'), oa = result.streams.filter(s => s.codec_type === 'audio');
    if (sa ? (oa.length !== 1 || oa[0].codec_name !== 'aac') : oa.length !== 0)
        throw Error('Audio stream mismatch');
    return { duration, width: o.width, height: o.height, videoCodec: o.codec_name, audioCodec: oa[0]?.codec_name || null };
}
async function probe(path, signal) { return JSON.parse((await runBounded('/usr/bin/ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { signal })).toString()); }
export function videoPhaseLogger(sink=line=>console.log(line),clock=()=>Date.now(),selected=contract){
 const jobId=randomUUID(),start=clock();let count=0;
 const phases=new Set(['job-start','source-verified','encode-spawned','encode-exited','cancellation-observed','cleanup-complete','cleanup-failed']);
 return(phase,details={})=>{if(!phases.has(phase)||count>=16)return;const event={schema:1,event:'fia-video-phase',jobId,assetId:selected.source.provenance.assetId,recipe:selected.recipe,phase,elapsedMs:Math.max(0,clock()-start)};if([1,2].includes(details.pass))event.pass=details.pass;if(['success','cancel','failure'].includes(details.outcome))event.outcome=details.outcome;const line=JSON.stringify(event);if(Buffer.byteLength(line)>1024)return;count++;try{sink(line);}catch{}};
}
export function deliveryPassArguments(input,output,prefix,pass,contract=videoContracts[0]){
 const e=contract.encoding;validateGeometryContract(e);const cadence=validateCadenceContract(e);if(![1,2].includes(pass))throw Error('Invalid pass');
 const common=['-nostdin','-hide_banner','-y','-protocol_whitelist','file,pipe','-i',input,'-map','0:v:0','-vf',`${cadence.divisor>1?'fps=fps='+cadence.rate+':round=near,':''}scale=${e.width}:${e.height}:flags=lanczos${e.sar?',setsar='+e.sar.replace(':','/')+':max=65535':''}`,'-fps_mode','passthrough','-c:v','libx264','-preset',e.preset,'-pix_fmt','yuv420p','-b:v',String(e.videoBps),'-maxrate',String(e.maxrateBps),'-bufsize',String(e.bufferBits),'-g',String(e.keyint),'-keyint_min',String(e.minKeyint),'-sc_threshold',String(e.scenecut),'-passlogfile',prefix];
 return pass===1?[...common,'-pass','1','-an','-f','null','/dev/null']:[...common,'-map','0:a:0?','-pass','2','-c:a','aac','-b:a',e.audioBps?String(e.audioBps):`${e.audioKbps}k`,'-ac',String(e.audioChannels||2),...(e.audioBps?['-ar','48000']:[]),'-movflags','+faststart',output];
}
export async function encodeDelivery(input,output,dir,sourceProbe,signal,phase=()=>{},contract=videoContracts[0]){
 const e=contract.encoding,v=sourceProbe.streams.find(s=>s.codec_type==='video');
 validateSourceCadence(v,e);if(v?.width!==1280||v?.height!==720)throw Error('Unqualified source geometry');
 const prefix=join(dir,'pass'),start=Date.now(),passes=[],statistics=[];
 const local=AbortSignal.any([signal,AbortSignal.timeout(contract.limits.encodeMs)]);
 try{
  for(const pass of [1,2]){
   const remaining=contract.limits.encodeMs-(Date.now()-start);if(remaining<=0)throw Error('Combined encode deadline');let log='',spawned=false,reported=false;const began=Date.now();
   await runBounded('/usr/bin/ffmpeg',deliveryPassArguments(input,output,prefix,pass,contract),{timeout:remaining,signal:local,outputPath:pass===1?'/dev/null':output,limit:pass===1?contract.limits.passlogFileBytes:contract.limits.bytes,onSpawn:()=>{spawned=true;},onClose:({outcome})=>phase('encode-exited',{pass,outcome}),onStderr:b=>{log=(log+b.toString()).slice(-contract.limits.stderrBytes);if(spawned&&!reported&&/frame=\s*[1-9]\d*/.test(log)){reported=true;phase('encode-spawned',{pass});}}});
   const settings=pass===1?(await readFile(prefix+'-0.log','utf8')).split('\n')[0]:log;
   for(const token of [...(pass===1?[`fps=${e.outputFrameRate}`]:[]),`bitrate=${Math.floor(e.videoBps/1000)}`,`vbv_maxrate=${Math.floor(e.maxrateBps/1000)}`,`vbv_bufsize=${Math.floor(e.bufferBits/1000)}`,`keyint=${e.keyint}`,`scenecut=${e.scenecut}`,pass===1?'rc=abr':'rc=2pass'])if(!settings.includes(token))throw Error('Unconfirmed encoder setting '+token);
   let total=0;for(const name of (await readdir(dir)).filter(n=>n.startsWith('pass'))){if(!/^pass-0\.log(?:\.mbtree)?(?:\.temp)?$/.test(name))throw Error('Unexpected statistics file');const length=(await stat(join(dir,name))).size;if(length>contract.limits.passlogFileBytes)throw Error('Statistics file ceiling');total+=length;}if(total>contract.limits.passlogTotalBytes)throw Error('Statistics aggregate ceiling');
   passes.push({pass,elapsedMs:Date.now()-began,settingsSha256:hash(settings),appliedSettings:pass===1?settings:undefined});
  }
  for(const name of (await readdir(dir)).filter(n=>n.startsWith('pass'))){const bytes=await readFile(join(dir,name));statistics.push({name,bytes:bytes.length,sha256:hash(bytes)});}
  local.throwIfAborted();return {passes,statistics,elapsedMs:Date.now()-start};
 }finally{for(const name of (await readdir(dir)).filter(n=>n.startsWith('pass')))await rm(join(dir,name),{force:true});}
}
export async function handleVideo(req, res) {
    const infoUrl=new URL(req.url,'http://container');
    if (infoUrl.pathname === '/video-info') {
        if([...infoUrl.searchParams.keys()].some(k=>!['assetId','size'].includes(k))||infoUrl.searchParams.getAll('size').length>1){res.writeHead(400).end('Unsupported video info option');return true;}
        if(req.method !== 'GET'){res.writeHead(405).end('GET only');return true;}
        const sourceContract=videoContracts.find(c=>c.source.provenance.assetId===(infoUrl.searchParams.get('assetId')||'a13'));const selected=sourceContract&&selectVideoContract(sourceContract.source.url,infoUrl.searchParams.get('size')||'large');if(!selected){res.writeHead(400).end('Unapproved asset');return true;}
        try {
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await encoderIdentity(undefined,selected)));
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
    let dir,phase=()=>{};let hasJob=false;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), contract.limits.jobMs);
    const abort = () => { if (!res.writableEnded)
        controller.abort(); };
    res.on('close', abort);
    const abortBody = () => { if (!req.complete)
        req.destroy(); };
    controller.signal.addEventListener('abort', abortBody, { once: true });
    const cancelEvent=()=>phase('cancellation-observed');controller.signal.addEventListener('abort',cancelEvent,{once:true});
    try {
        let raw = Buffer.alloc(0);
        for await (const b of req) {
            if (raw.length + b.length > videoContracts[0].limits.requestBytes)
                throw Error('Request too large');
            raw = Buffer.concat([raw, b]);
        }
        const job = JSON.parse(raw);
        if(!job||typeof job!=='object'||Array.isArray(job)||Object.keys(job).some(k=>!['source_url','size','recipe','encoderRevision','assetId'].includes(k)))throw Error('Unsupported video job option');
        const selected=selectVideoContract(job.source_url,job.size);if(!selected)throw Error('Unapproved source');const contract=selected;
        if (job.recipe !== contract.recipe || (job.assetId!==undefined&&job.assetId!==contract.source.provenance.assetId))
            throw Error('Unapproved video source or recipe');
        phase=videoPhaseLogger(undefined,undefined,contract);hasJob=true;phase('job-start');
        const encoder = await encoderIdentity(controller.signal,contract);
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
        phase('source-verified');
        const sourceProbe = await probe(input, controller.signal);
        const encoding=await encodeDelivery(input,output,dir,sourceProbe,controller.signal,phase,contract);
        const outputProbe = await probe(output, controller.signal), metadata = validateOutput(sourceProbe, outputProbe,contract);
        const length = (await stat(output)).size;
        if (!length || length > contract.limits.bytes)
            throw Error('Invalid output bytes');
        const body = await readFile(output);
        if (controller.signal.aborted)
            throw Error('Cancelled');
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(body.length), 'X-Video-Metadata': JSON.stringify({ ...metadata, encoding, sourceSha256: contract.source.sha256, sourceBytes: size, sha256: hash(body), bytes: body.length, encoderRevision: encoder.revision, recipe: contract.recipe, rights: contract.source.provenance }) });
        res.end(body);
    }
    catch (e) {
        if (!res.headersSent && !res.destroyed)
            res.writeHead(502).end(String(e.message));
    }
    finally {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', abortBody);controller.signal.removeEventListener('abort',cancelEvent);
        res.off('close', abort);
        try { if (dir) await rm(dir, { recursive: true, force: true });if(hasJob)phase('cleanup-complete'); }
        catch(error){if(hasJob)phase('cleanup-failed');throw error;}
        finally { busy = false; }
    }
    return true;
}
