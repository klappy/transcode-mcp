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
