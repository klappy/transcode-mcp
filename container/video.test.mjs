import { test, expect } from 'bun:test';
import { validateOutput, runBounded } from './video.mjs';
const source = { streams: [{ codec_type: 'video', width: 1280, height: 720 }, { codec_type: 'audio' }], format: { duration: '79.153' } };
const output = { streams: [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1280, height: 720 }, { codec_type: 'audio', codec_name: 'aac' }], format: { duration: '79.2' } };
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
 for(const key of ['-vf','-b:v','-maxrate','-bufsize','-g','-keyint_min','-sc_threshold','-passlogfile'])expect(value(first,key)).toBe(value(second,key));expect(value(first,'-b:v')).toBe('439024');expect(value(first,'-g')).toBe('1500');expect(value(first,'-sc_threshold')).toBe('60');expect(first).toContain('-an');expect(value(second,'-pass')).toBe('2');expect(second).not.toContain('-crf');expect(contract.recipe).toBe('fia-video@2');expect(()=>deliveryPassArguments('i','o','p',3)).toThrow();
});
