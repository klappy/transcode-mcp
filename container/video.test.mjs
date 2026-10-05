import { test, expect } from 'bun:test';
import { validateOutput, runBounded } from './video.mjs';
const source = { streams: [{ codec_type: 'video', width: 1280, height: 720 }, { codec_type: 'audio' }], format: { duration: '79.153' } };
const output = { streams: [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1280, height: 720, avg_frame_rate:'25/1',r_frame_rate:'25/1',sample_aspect_ratio:'1:1',display_aspect_ratio:'16:9' }, { codec_type: 'audio', codec_name: 'aac',channels:2,sample_rate:'48000' }], format: { duration: '79.2' } };
test('reject valid-but-short MP4 metadata and changed stream/dimension contract', () => { expect(validateOutput(source, output).duration).toBe(79.2); for (const duration of ['0', '20', '79.404'])
    expect(() => validateOutput(source, { ...output, format: { duration } })).toThrow(); expect(() => validateOutput(source, { ...output, streams: [{ ...output.streams[0], width: 1920 }, output.streams[1]] })).toThrow(); expect(() => validateOutput(source, { ...output, streams: [output.streams[0]] })).toThrow(); });
test('bounded process terminates timeout and explicit cancellation', async () => { await expect(runBounded(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { timeout: 30 })).rejects.toThrow('timeout'); const c = new AbortController(); c.abort(); await expect(runBounded(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { signal: c.signal })).rejects.toThrow('cancelled'); });
test('video-info rejects unsupported methods without hanging',async()=>{
 const {handleVideo}=await import('./video.mjs');let status,ended=false;
 await handleVideo({url:'/video-info',method:'POST'},{writeHead(code){status=code;return this;},end(){ended=true;}});
 expect(status).toBe(405);expect(ended).toBe(true);
});

test('selected runtime uses identical C geometry/rate/GOP settings in both passes',async()=>{
 const {deliveryPassArguments,contract}=await import('./video.mjs');const first=deliveryPassArguments('in','out','stats',1),second=deliveryPassArguments('in','out','stats',2);const value=(a,k)=>a[a.indexOf(k)+1];
 for(const key of ['-vf','-b:v','-maxrate','-bufsize','-g','-keyint_min','-sc_threshold','-passlogfile'])expect(value(first,key)).toBe(value(second,key));expect(value(first,'-b:v')).toBe('658536');expect(value(first,'-g')).toBe('750');expect(value(first,'-sc_threshold')).toBe('60');expect(first).toContain('-an');expect(value(second,'-pass')).toBe('2');expect(second).not.toContain('-crf');expect(contract.recipe).toBe('fia-video@5-large');expect(()=>deliveryPassArguments('i','o','p',3)).toThrow();
});

test('phase logger emits only bounded safe correlated fields',async()=>{
 const {videoPhaseLogger}=await import('./video.mjs');const lines=[];let time=100;const emit=videoPhaseLogger(line=>lines.push(line),()=>time++);emit('job-start',{url:'secret',token:'secret'});emit('encode-spawned',{pass:1});emit('encode-exited',{pass:1,outcome:'failure',stderr:'secret'});emit('cleanup-failed');emit('invalid');for(let i=0;i<30;i++)emit('source-verified');expect(lines.length).toBe(16);const events=lines.map(JSON.parse);expect(new Set(events.map(e=>e.jobId)).size).toBe(1);expect(events[0].jobId).toMatch(/^[a-f0-9-]{36}$/);expect(lines.every(l=>Buffer.byteLength(l)<=1024&&!l.includes('secret'))).toBe(true);expect(events.some(e=>e.phase==='cleanup-complete')).toBe(false);expect(events[2].outcome).toBe('failure');
});
test('real child spawn/close callbacks distinguish cancellation and failed spawn',async()=>{
 const events=[],controller=new AbortController();await expect(runBounded(process.execPath,['-e','setTimeout(()=>{},10000)'],{signal:controller.signal,onSpawn(){events.push('spawn');controller.abort();},onClose({outcome}){events.push(outcome);}})).rejects.toThrow('cancelled');expect(events).toEqual(['spawn','cancel']);const failed=[];await expect(runBounded('/definitely-missing-fia-executable',[],{onSpawn(){failed.push('spawn');},onClose({outcome}){failed.push(outcome);}})).rejects.toThrow();expect(failed).toEqual(['failure']);
});

test('three source contracts resolve exactly and label the selected job',async()=>{
 const {videoContracts,selectVideoContract,videoPhaseLogger}=await import('./video.mjs');expect(videoContracts.map(c=>c.source.provenance.assetId)).toEqual(['a13','a184','a10']);expect(selectVideoContract(videoContracts[1].source.url+'?forged')).toBeUndefined();for(const c of videoContracts){expect(selectVideoContract(c.source.url)).toBe(c);const lines=[];videoPhaseLogger(l=>lines.push(JSON.parse(l)),()=>1,c)('job-start');expect(lines[0].assetId).toBe(c.source.provenance.assetId);expect(c.encoding.fps).toBe(25);expect(c.encoding.keyint).toBe(750);}
});

test('unknown info asset rejects without invoking encoder',async()=>{const {handleVideo}=await import('./video.mjs');let status;await handleVideo({url:'/video-info?assetId=unknown',method:'GET'},{writeHead(code){status=code;return this;},end(){}});expect(status).toBe(400);});
