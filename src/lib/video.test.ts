import { test, expect } from 'bun:test';
import { byteRange, videoKey, videoOptions, videoContract, handleVideoProxy } from './video';
import { parseProxyPath } from './parse-proxy-path';
import { buildToolResponse } from './mcp-tool';
test('video range honors suffix/open/clamped ranges and rejects unsafe/multiple ranges', () => {
    expect(byteRange(null, 100)).toBeNull();
    expect(byteRange('bytes=10-19', 100)).toEqual({ offset: 10, length: 10 });
    expect(byteRange('bytes=-10', 100)).toEqual({ offset: 90, length: 10 });
    expect(byteRange('bytes=90-', 100)).toEqual({ offset: 90, length: 10 });
    expect(byteRange('bytes=90-200', 100)).toEqual({ offset: 90, length: 10 });
    for (const x of ['bytes=100-', 'bytes=2-1', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=9007199254740993-'])
        expect(() => byteRange(x, 100)).toThrow();
});
test('video recipe defaults and strict parser reject unsupported and malformed options', () => {
    expect(videoOptions({})).toEqual({ preset: 'fia', q: 'medium', f: 'mp4' });
    for (const option of ['q=high', 'w=100', 'q=medium,q=medium', 'garbage', 'preset=voice'])
        expect(() => parseProxyPath('/video/' + option + '/' + videoContract.source.url)).toThrow();
    const result = buildToolResponse({ media_type: 'video', source_url: videoContract.source.url }, 'https://example.test');
    expect(result.proxy_path).toStartWith('/video/preset=fia,q=medium,f=mp4/');
    expect(result.embed).toContain('preload="none"');
    expect(() => buildToolResponse({ media_type: 'video', source_url: 'https://unapproved.test/v.mp4' }, 'https://example.test')).toThrow();
});
test('cache identity separates real encoder revisions', async () => { expect(await videoKey('a'.repeat(64))).not.toBe(await videoKey('b'.repeat(64))); await expect(videoKey('unknown')).rejects.toThrow(); });
test('unapproved source and unsupported method never allocate encoder', async () => { let calls = 0; const instance = async () => { calls++; throw Error('must not run'); }; expect((await handleVideoProxy(new Request('https://proxy/video'), undefined, instance, 'https://wrong.test', {})).status).toBe(403); expect((await handleVideoProxy(new Request('https://proxy/video', { method: 'POST' }), undefined, instance, videoContract.source.url, {})).status).toBe(405); expect(calls).toBe(0); });
test('verified transform publishes once; ranges and HEAD use cache, corrupted metadata fails closed', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
    const revision = 'a'.repeat(64);
    let object: any = null, transforms = 0;
    const bucket = { head: async () => object, put: async (_key: string, body: Uint8Array, options: any) => { object = { size: body.length, customMetadata: options.customMetadata }; }, get: async (_key: string, options: any) => ({ body: new Response(options?.range ? bytes.slice(options.range.offset, options.range.offset + options.range.length) : bytes).body }) } as unknown as R2Bucket;
    const instance = async () => ({ fetch: async (req: Request) => { if (new URL(req.url).pathname === '/video-info')
            return Response.json({ revision }); transforms++; return new Response(bytes, { headers: { 'X-Video-Metadata': JSON.stringify({ encoderRevision: revision, sourceSha256: videoContract.source.sha256, sourceBytes: videoContract.source.bytes, recipe: videoContract.recipe, bytes: 5, sha256: sha }) } }); } });
    const get = (headers?: Record<string, string>, method = 'GET') => handleVideoProxy(new Request('https://proxy/video', { headers, method }), bucket, instance, videoContract.source.url, {});
    const first = await get();
    expect(first.status).toBe(200);
    expect(first.headers.get('X-Transcode-Cache')).toBe('MISS');
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes);
    const range = await get({ Range: 'bytes=1-2' });
    expect(range.status).toBe(206);
    expect(range.headers.get('Content-Range')).toBe('bytes 1-2/5');
    expect(new Uint8Array(await range.arrayBuffer())).toEqual(new Uint8Array([2, 3]));
    expect((await get({ Range: 'bytes=99-' })).status).toBe(416);
    expect(await (await get(undefined, 'HEAD')).text()).toBe('');
    expect(transforms).toBe(1);
    object.customMetadata.encoderRevision = 'b'.repeat(64);
    expect((await get()).status).toBe(502);
});
test('hash mismatch is never published', async () => { let writes = 0; const revision = 'a'.repeat(64); const bucket = { head: async () => null, put: async () => writes++ } as unknown as R2Bucket; const instance = async () => ({ fetch: async (req: Request) => new URL(req.url).pathname === '/video-info' ? Response.json({ revision }) : new Response(new Uint8Array([1]), { headers: { 'X-Video-Metadata': JSON.stringify({ encoderRevision: revision, sourceSha256: videoContract.source.sha256, sourceBytes: videoContract.source.bytes, recipe: videoContract.recipe, bytes: 1, sha256: '0'.repeat(64) }) } }) }); expect((await handleVideoProxy(new Request('https://proxy/video'), bucket, instance, videoContract.source.url, {})).status).toBe(502); expect(writes).toBe(0); });
