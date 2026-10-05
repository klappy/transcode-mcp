// Bun lacks the Workers FixedLengthStream primitive; byte/hash checks remain real.
globalThis.FixedLengthStream=class extends TransformStream {constructor(_size){super();}};
import {test,expect} from 'bun:test';
import {selectVideoContract,selectCatalogVideoContract,videoKey,videoContracts,handleVideoProxy,VIDEO_SOURCE_ALLOWED_PREFIXES} from './video.ts';
import {selectLazyVideoContract as containerLazySelect,deriveLazyContract} from '../../container/video-lazy.mjs';
import {noUpscaleRaster} from '../../container/video-sources.mjs';
import {validateGeometryContract,validateCadenceContract,deliveryPassArguments} from '../../container/video.mjs';
import {parseProxyPath} from './parse-proxy-path.ts';
import {buildToolResponse} from './mcp-tool.ts';

const sizes=['xsmall','small','medium','large','xlarge'];
const heights={xsmall:320,small:480,medium:544,large:720,xlarge:912};
const a11='https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4';
const jordan='https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4';

test('(a) non-catalog approved-host URL selects a lazy contract at every FIA size, same in Worker and container',async()=>{
 const keys=new Set();
 for(const url of [a11,'https://s3.amazonaws.com/cbbt-er.public/media/videos/a19/720p.mp4','https://s3.amazonaws.com/cbbt-er.public/media/videos/a186/720p.mp4','https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/other.mp4'])for(const size of sizes){
  const c=selectVideoContract(url,size);expect(c).toBeDefined();expect(c).toEqual(containerLazySelect(url,size));
  expect(c.source).toMatchObject({url,lazy:true});expect(c.source.sha256).toBeUndefined();expect(c.recipe).toBe('fia-video@5-'+size);expect(c.encoding.height).toBe(heights[size]);
  expect(()=>validateGeometryContract(c.encoding)).not.toThrow();expect(()=>validateCadenceContract(c.encoding)).not.toThrow();
  keys.add(await videoKey('a'.repeat(64),c));
  // proxy path and MCP accept it too
  expect(parseProxyPath(buildToolResponse({media_type:'video',source_url:url,size},'https://x').proxy_path).sourceUrl).toBe(url);
 }
 expect(keys.size).toBe(20); // deterministic per URL+profile
 expect(await videoKey('a'.repeat(64),selectVideoContract(a11,'medium'))).toBe(await videoKey('a'.repeat(64),selectVideoContract(a11,'medium')));
 // a catalog source at a size outside the catalog (xlarge) is lazy, not unavailable
 expect(selectVideoContract(videoContracts[0].source.url,'xlarge')?.source).toMatchObject({lazy:true});
});

test('(b) disallowed or non-canonical source is 403 with a clear message and never allocates the encoder',async()=>{
 expect(VIDEO_SOURCE_ALLOWED_PREFIXES).toEqual(['https://s3.amazonaws.com/cbbt-er.public/','https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/']);
 for(const bad of ['https://evil.test/v.mp4','http://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4','https://s3.amazonaws.com/other-bucket/v.mp4','https://s3.amazonaws.com/cbbt-er.public.evil/v.mp4','https://s3.amazonaws.com/cbbt-er.public/../other/v.mp4','https://s3.amazonaws.com/cbbt-er.public/','https://user@s3.amazonaws.com/cbbt-er.public/v.mp4',a11+'?x=1',a11+'#t','https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev.evil.test/v.mp4']){
  expect(selectVideoContract(bad,'medium')).toBeUndefined();
  let calls=0;const r=await handleVideoProxy(new Request('https://proxy/video'),{},async()=>{calls++;throw Error('no');},bad,{size:'medium'});
  expect(r.status).toBe(403);expect(await r.text()).toContain('https://s3.amazonaws.com/cbbt-er.public/');expect(calls).toBe(0);
 }
 for(const size of ['tiny','constructor','__proto__'])expect(selectVideoContract(a11,size)).toBeUndefined();
});

test('(c) existing catalog rows keep identical contracts and cache keys',async()=>{
 // Snapshot taken on origin/main 6be5563 before this change.
 expect(await videoKey('a'.repeat(64),selectVideoContract(videoContracts[0].source.url,'medium'))).toBe('video-v1/5062d269a868a33a641d0b4543f31f6f07aae2c26e5a13574e4c4aaf9b29c01b.mp4');
 expect(await videoKey('a'.repeat(64),selectVideoContract(videoContracts[0].source.url,'large'))).toBe('video-v1/c0e2de33e0b8529b0fbcb058009eac6fb77044594b7d5f1267ae1df8196a700c.mp4');
 expect(await videoKey('a'.repeat(64),selectVideoContract(videoContracts[2].source.url,'small'))).toBe('video-v1/8bb3e7df38b4c68760a64bf0a47377d2821ae0bd2fdb7a92787c889855afbe58.mp4');
 expect(await videoKey('a'.repeat(64),selectVideoContract(jordan,'xlarge'))).toBe('video-v1/b9400e3d196b66dd8f669f3aaec8378c9655c49b0cd1bcf80994d85dd5fcf2f3.mp4');
 for(const c of videoContracts)for(const size of ['xsmall','small','medium','large']){const s=selectVideoContract(c.source.url,size);expect(s).toBe(selectCatalogVideoContract(c.source.url,size));expect('lazy' in s.source).toBe(false);}
 for(const size of ['small','xlarge'])expect(selectVideoContract(jordan,size)).toBe(selectCatalogVideoContract(jordan,size));
});

test('(d) no upscale: shorter source encodes at its own aligned height with 16:9 DAR',()=>{
 const xl=selectVideoContract(a11,'xlarge').encoding;
 expect(noUpscaleRaster(xl,720)).toEqual({width:1280,height:720,sar:'1:1',dar:'16:9'});
 expect(noUpscaleRaster(xl,2160)).toEqual({width:1616,height:912,sar:'304:303',dar:'16:9'});
 expect(noUpscaleRaster(selectVideoContract(a11,'medium').encoding,480)).toMatchObject({height:480,width:848});
 for(const h of [360,480,540,720,1080]){const r=noUpscaleRaster(xl,h);expect(r.height).toBeLessThanOrEqual(h);expect(r.height%2+r.width%2).toBe(0);expect(()=>validateGeometryContract({...xl,...r})).not.toThrow();}
 // Container binds probed geometry and cadence; a 720p/50fps source at xlarge encodes 1280x720@25.
 const derived=deriveLazyContract(containerLazySelect(a11,'xlarge'),{width:1280,height:720,avg_frame_rate:'50/1',r_frame_rate:'50/1',sample_aspect_ratio:'1:1'});
 expect(derived.encoding).toMatchObject({width:1280,height:720,sar:'1:1',outputFrameRate:'25/1',fps:25,keyint:750});
 const args=deliveryPassArguments('i','o','p',2,derived);expect(args[args.indexOf('-vf')+1]).toBe('fps=fps=25/1:round=near,scale=1280:720:flags=lanczos,setsar=1/1:max=65535');
 const ntsc=deriveLazyContract(containerLazySelect(a11,'medium'),{width:1920,height:1080,avg_frame_rate:'30000/1001',r_frame_rate:'30000/1001'});
 expect(ntsc.encoding).toMatchObject({width:960,height:544,outputFrameRate:'30000/1001'});expect(()=>validateCadenceContract(ntsc.encoding)).not.toThrow();
 for(const bad of [{width:1280,height:720,avg_frame_rate:'50/1',r_frame_rate:'25/1'},{width:960,height:720,avg_frame_rate:'25/1',r_frame_rate:'25/1'}])expect(()=>deriveLazyContract(containerLazySelect(a11,'small'),bad)).toThrow();
});

test('lazy miss routes to lazy container endpoints, records fetched source identity, and exposes actual height',async()=>{
 const bytes=new Uint8Array([9,8,7]);const hex=(b)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
 const sha=hex(await crypto.subtle.digest('SHA-256',bytes)),revision='c'.repeat(64),sourceSha='d'.repeat(64),contract=selectVideoContract(a11,'xlarge');
 let object=null;const staged=new Map(),paths=[];
 const bucket={head:async()=>object,put:async(key,body,options)=>{const d=new Uint8Array(await new Response(body).arrayBuffer());staged.set(key,d);if(options)object={size:d.length,customMetadata:options.customMetadata};},delete:async(k)=>{staged.delete(k);},get:async(key)=>({body:new Response(staged.get(key)).body})};
 const instance=async()=>({fetch:async(r)=>{const u=new URL(r.url);paths.push(u.pathname);if(u.pathname==='/video-lazy-info'){expect(u.searchParams.get('source_url')).toBe(a11);return Response.json({revision});}
  const job=await r.json();expect(job).toEqual({source_url:a11,size:'xlarge',recipe:contract.recipe,encoderRevision:revision});
  return new Response(bytes,{headers:{'X-Video-Metadata':JSON.stringify({width:1280,height:720,sourceSha256:sourceSha,sourceBytes:1234,sha256:sha,bytes:3,encoderRevision:revision,recipe:contract.recipe})}});}});
 const r=await handleVideoProxy(new Request('https://proxy/video'),bucket,instance,a11,{size:'xlarge'});
 expect(r.status).toBe(200);expect(r.headers.get('X-Transcode-Cache')).toBe('MISS');expect(r.headers.get('X-Transcode-Video-Height')).toBe('720');expect(r.headers.get('X-Transcode-Video-Width')).toBe('1280');
 expect(r.headers.get('Access-Control-Expose-Headers')).toContain('X-Transcode-Video-Height');expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);
 expect(paths).toEqual(['/video-lazy-info','/video-lazy-info','/video-lazy-transcode']);expect(object.customMetadata.sourceSha256).toBe(sourceSha);
 const hit=await handleVideoProxy(new Request('https://proxy/video'),bucket,instance,a11,{size:'xlarge'});expect(hit.headers.get('X-Transcode-Cache')).toBe('HIT');
});
