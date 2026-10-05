// Bun lacks the Workers FixedLengthStream primitive; byte/hash checks remain real.
(globalThis as any).FixedLengthStream=class extends TransformStream {constructor(_size:number){super();}};
import { test, expect } from 'bun:test';
import { byteRange, videoKey, videoOptions, videoContract, videoContracts, selectVideoContract, handleVideoProxy } from './video';
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
    let object: any = null, transforms = 0; const staged=new Map<string,Uint8Array>();
    const bucket = { head: async () => object, put: async (key: string, body: any, options: any) => {const data=new Uint8Array(await new Response(body).arrayBuffer());staged.set(key,data);if(options)object={size:data.length,customMetadata:options.customMetadata};}, delete:async(key:string)=>{staged.delete(key);}, get: async (key: string, options: any) => ({ body: new Response(options?.range ? bytes.slice(options.range.offset, options.range.offset + options.range.length) : staged.get(key)||bytes).body }) } as unknown as R2Bucket;
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
test('hash mismatch is never published', async () => { let writes = 0; const revision = 'a'.repeat(64); const bucket = { head: async () => null, put: async (_key:string,body:any) => {await new Response(body).arrayBuffer();if(!_key.startsWith("video-pending/"))writes++;}, delete:async()=>{} } as unknown as R2Bucket; const instance = async () => ({ fetch: async (req: Request) => new URL(req.url).pathname === '/video-info' ? Response.json({ revision }) : new Response(new Uint8Array([1]), { headers: { 'X-Video-Metadata': JSON.stringify({ encoderRevision: revision, sourceSha256: videoContract.source.sha256, sourceBytes: videoContract.source.bytes, recipe: videoContract.recipe, bytes: 1, sha256: '0'.repeat(64) }) } }) }); expect((await handleVideoProxy(new Request('https://proxy/video'), bucket, instance, videoContract.source.url, {})).status).toBe(502); expect(writes).toBe(0); });
for(const fault of ['short','oversized','staging rejection','missing staging'])test(`quarantine ${fault} cannot publish canonical bytes and removes pending key`,async()=>{
 const revision='a'.repeat(64),controller=new AbortController();let published=0;const deleted:string[]=[];
 const data=new Uint8Array([1,2,3]);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
 const bucket={head:async()=>null,delete:async(key:string)=>{deleted.push(key);},put:async(key:string,body:any)=>{
  if(!key.startsWith('video-pending/'))published++;
  if(fault==='staging rejection')throw Error('storage failure');
  await new Response(body).arrayBuffer();
 },get:async()=>{throw Error('Unverified staging must not be read');}}as unknown as R2Bucket;
 const instance=async()=>({fetch:async(req:Request)=>new URL(req.url).pathname==='/video-info'?Response.json({revision}):new Response(data,{headers:{'X-Video-Metadata':JSON.stringify({encoderRevision:revision,sourceSha256:videoContract.source.sha256,sourceBytes:videoContract.source.bytes,recipe:videoContract.recipe,bytes:fault==='short'?4:fault==='oversized'?2:3,sha256:hash})}})});
 const response=await handleVideoProxy(new Request('https://proxy/video',{signal:controller.signal}),bucket,instance,videoContract.source.url,{});
 expect(response.status).toBe(502);expect(published).toBe(0);expect(deleted.length).toBe(1);expect(deleted[0]).toStartWith('video-pending/');
});

test('source-specific cache keys separate all three contracts and reject URL variants',async()=>{const keys=await Promise.all(videoContracts.map(c=>videoKey('a'.repeat(64),c)));expect(new Set(keys).size).toBe(3);for(const c of videoContracts){expect(selectVideoContract(c.source.url)).toBe(c);expect(selectVideoContract(c.source.url+'?unapproved')).toBeUndefined();}});

test('new sources reject forged a13 metadata before quarantine publication',async()=>{for(const selected of videoContracts.slice(1)){let writes=0;const bucket={head:async()=>null,put:async()=>{writes++;}} as unknown as R2Bucket;const instance=async()=>({fetch:async(req:Request)=>new URL(req.url).pathname==='/video-info'?Response.json({revision:'a'.repeat(64)}):new Response(new Uint8Array([1]),{headers:{'X-Video-Metadata':JSON.stringify({encoderRevision:'a'.repeat(64),sourceSha256:videoContract.source.sha256,sourceBytes:videoContract.source.bytes,recipe:selected.recipe,bytes:1,sha256:'b'.repeat(64)})}})});expect((await handleVideoProxy(new Request('https://proxy/video'),bucket,instance,selected.source.url,{})).status).toBe(502);expect(writes).toBe(0);}});

test('rolling containers receive legacy assetId for each old source and exact URL only for composite',async()=>{
 const composite=(await import('../../container/video-contract-4k-xlarge.json')).default;
 for(const selected of [...videoContracts,composite]){
  const legacy=videoContracts.includes(selected);let observed:URL|undefined,accepted=false;
  const instance=async()=>({fetch:async(req:Request)=>{observed=new URL(req.url);const keys=[...observed.searchParams.keys()];
   // Model old containers rejecting the new source_url parameter.
   if(legacy&&keys.some(k=>!['assetId','size'].includes(k)))return new Response('Unsupported option',{status:400});
   accepted=true;return new Response('End test before encoding',{status:503});}});
  const bucket={head:async()=>null} as unknown as R2Bucket;
  await handleVideoProxy(new Request('https://proxy/video'),bucket,instance,selected.source.url,legacy?{}:{size:'xlarge'});
  expect(accepted).toBe(true);expect(observed?.pathname).toBe('/video-info');
  expect(observed?.searchParams.get('size')).toBe(legacy?'large':'xlarge');
  expect(observed?.searchParams.get('assetId')).toBe(legacy?selected.source.provenance.assetId:null);
  expect(observed?.searchParams.get('source_url')).toBe(legacy?null:composite.source.url);
 }
});
