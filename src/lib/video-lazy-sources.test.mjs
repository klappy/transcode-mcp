// Bun lacks the Workers FixedLengthStream primitive; byte/hash checks remain real.
globalThis.FixedLengthStream=class extends TransformStream {constructor(_size){super();}};
import {test,expect} from 'bun:test';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectVideoContract,selectCatalogVideoContract,videoKey,videoContracts,handleVideoProxy,VIDEO_SOURCE_ALLOWED_PREFIXES} from './video.ts';
import {selectLazyVideoContract as containerLazySelect,deriveLazyContract,lazyPassArguments,validateLazyOutput,lazyEncode} from '../../container/video-lazy.mjs';
import {fitLazyRaster,validateLazyGeometry} from '../../container/video-sources.mjs';
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

const probe=(width,height,sample_aspect_ratio,rate='25/1')=>({width,height,sample_aspect_ratio,avg_frame_rate:rate,r_frame_rate:rate});
const display=(w,h,sar='1:1')=>{const [n,d]=/^[1-9]\d*:[1-9]\d*$/.test(sar)?sar.split(':').map(Number):[1,1];return {w:w*n/d,h};};
// Every lazy raster: inside the profile box, no upscale of source display size, even, DAR preserved (±rounding), SAR/DAR consistent.
function expectFit(size,src){
 const profile=selectVideoContract(a11,size).encoding,c=deriveLazyContract(containerLazySelect(a11,size),src),e=c.encoding;
 const s=display(src.width,src.height,src.sample_aspect_ratio||'1:1'),o=display(e.width,e.height,e.sar);
 expect(e.width).toBeLessThanOrEqual(profile.width);expect(e.height).toBeLessThanOrEqual(profile.height);
 expect(o.w).toBeLessThanOrEqual(s.w+1e-9);expect(o.h).toBeLessThanOrEqual(s.h);
 expect(e.width%2+e.height%2).toBe(0);expect(()=>validateLazyGeometry(e)).not.toThrow();
 expect(Math.abs((o.w/o.h)/(s.w/s.h)-1)).toBeLessThan(0.01);
 // the encoder argv carries exactly this raster and SAR
 const args=lazyPassArguments('i','o','p',2,c);expect(args[args.indexOf('-vf')+1]).toEndWith(`scale=${e.width}:${e.height}:flags=lanczos,setsar=${e.sar.replace(':','/')}:max=65535`);
 return e;
}

test('(d) no upscale: a source smaller than the profile keeps its own display size, square pixels',()=>{
 expect(fitLazyRaster(selectVideoContract(a11,'xlarge').encoding,{width:1280,height:720,sar:'1:1'})).toEqual({width:1280,height:720,sar:'1:1',dar:'16:9'});
 expect(fitLazyRaster(selectVideoContract(a11,'xlarge').encoding,{width:3840,height:2160})).toEqual({width:1616,height:912,sar:'304:303',dar:'16:9'});
 expect(fitLazyRaster(selectVideoContract(a11,'medium').encoding,{width:854,height:480,sar:'1:1'})).toEqual({width:854,height:480,sar:'1:1',dar:'427:240'});
 for(const size of sizes)for(const [w,h] of [[640,360],[854,480],[960,540],[1280,720],[1920,1080],[3840,2160]])expectFit(size,probe(w,h,'1:1'));
 // Container binds probed geometry and cadence; a 720p/50fps source at xlarge encodes 1280x720@25.
 const derived=deriveLazyContract(containerLazySelect(a11,'xlarge'),probe(1280,720,'1:1','50/1'));
 expect(derived.encoding).toMatchObject({width:1280,height:720,sar:'1:1',dar:'16:9',outputFrameRate:'25/1',fps:25,keyint:750});
 const args=lazyPassArguments('i','o','p',2,derived);expect(args[args.indexOf('-vf')+1]).toBe('fps=fps=25/1:round=near,scale=1280:720:flags=lanczos,setsar=1/1:max=65535');
 // the lazy argv is the catalog argv except the raster filter
 const catalogArgs=deliveryPassArguments('i','o','p',2,{...derived,encoding:{...derived.encoding,width:1280,height:720,sar:'1:1',dar:'16:9'}});
 // plus 48 kHz resampling where the profile does not pin it (44.1 kHz sources)
 const ar=args.indexOf('-ar');expect(args.slice(ar,ar+2)).toEqual(['-ar','48000']);expect([...args.slice(0,ar),...args.slice(ar+2)]).toEqual(catalogArgs);
 for(const size of sizes){const a=lazyPassArguments('i','o','p',2,deriveLazyContract(containerLazySelect(a11,size),probe(1920,1080,'1:1')));expect(a.filter(x=>x==='-ar').length).toBe(1);expect(a[a.indexOf('-ar')+1]).toBe('48000');}
 const ntsc=deriveLazyContract(containerLazySelect(a11,'medium'),{width:1920,height:1080,avg_frame_rate:'30000/1001',r_frame_rate:'30000/1001'});
 expect(ntsc.encoding).toMatchObject({width:960,height:544,sar:'136:135',outputFrameRate:'30000/1001'});expect(()=>validateCadenceContract(ntsc.encoding)).not.toThrow();
});

test('(e) anamorphic sources fit by display aspect, never wider than the source display (review HOLD finding 1)',()=>{
 // 1440x1080 SAR 4:3 = 1920x1080 display: xlarge profile raster, not 1616 coded > 1440 rejected after encode
 expect(expectFit('xlarge',probe(1440,1080,'4:3'))).toMatchObject({width:1616,height:912,sar:'304:303',dar:'16:9'});
 // 720x480 SAR 32:27 = 853.3x480 display, exactly the small profile's display size
 expect(expectFit('small',probe(720,480,'32:27'))).toMatchObject({width:864,height:480,sar:'80:81',dar:'16:9'});
 // 960x720 SAR 4:3 = 1280x720 display: the large profile raster
 expect(expectFit('large',probe(960,720,'4:3'))).toMatchObject({width:1280,height:720,sar:'1:1',dar:'16:9'});
 // and at every size for each of them
 for(const size of sizes)for(const src of [probe(1440,1080,'4:3'),probe(720,480,'32:27'),probe(960,720,'4:3'),probe(720,576,'64:45'),probe(720,480,'8:9')])expectFit(size,src);
 // an anamorphic source with a smaller display than the profile: square-pixel, its own display size
 expect(expectFit('xlarge',probe(720,480,'32:27'))).toMatchObject({width:852,height:480,sar:'1:1'});
});

test('(f) non-16:9 sources are served, not rejected (operator ruling: no such thing as unavailable)',()=>{
 // 4:3 square pixel
 expect(expectFit('large',probe(1440,1080,'1:1'))).toMatchObject({width:960,height:720,sar:'1:1',dar:'4:3'});
 expect(expectFit('large',probe(640,480,'1:1'))).toMatchObject({width:640,height:480,sar:'1:1',dar:'4:3'});
 expect(expectFit('small',probe(1440,1080,'1:1'))).toMatchObject({width:640,height:480,sar:'1:1',dar:'4:3'});
 // portrait
 expect(expectFit('large',probe(1080,1920,'1:1'))).toMatchObject({width:404,height:720,sar:'1:1',dar:'101:180'});
 expect(expectFit('xsmall',probe(720,1280,'1:1'))).toMatchObject({width:180,height:320,sar:'1:1',dar:'9:16'});
 for(const size of sizes)for(const src of [probe(1440,1080,'1:1'),probe(1080,1920,'1:1'),probe(1080,1080,'1:1'),probe(2560,1080,'1:1'),probe(1920,1088,'1:1'),probe(1920,1080,'0:1'),probe(176,144)])expectFit(size,src);
});

test('(g) only undecodable input is 422; VFR and odd cadences are normalized before the encode',()=>{
 for(const [v,message] of [[undefined,/no video stream/],[{height:720,avg_frame_rate:'25/1',r_frame_rate:'25/1'},/Undecodable/]]){let error;try{deriveLazyContract(containerLazySelect(a11,'small'),v);}catch(e){error=e;}expect(error?.status).toBe(422);expect(error?.message).toMatch(message);}
 const vfr=(avg,r)=>deriveLazyContract(containerLazySelect(a11,'small'),{width:1280,height:720,avg_frame_rate:avg,r_frame_rate:r}).encoding;
 expect(vfr('525/22','30/1')).toMatchObject({sourceFrameRate:'24000/1001',outputFrameRate:'24000/1001',cadenceNormalization:{policy:'vfr-nominal-v1',avgFrameRate:'525/22',rFrameRate:'30/1'}});
 expect(vfr('50/1','25/1')).toMatchObject({sourceFrameRate:'50/1',outputFrameRate:'25/1'});
 expect(vfr('1350000/45047','90000/1')).toMatchObject({sourceFrameRate:'30000/1001',outputFrameRate:'30000/1001'});
 expect(vfr('0/0','60/1')).toMatchObject({sourceFrameRate:'60/1',outputFrameRate:'30/1'});
 expect(vfr('0/0','0/0')).toMatchObject({sourceFrameRate:'30/1',outputFrameRate:'30/1'});
 expect(vfr('1000/1','1000/1')).toMatchObject({outputFrameRate:'500/17'});
 expect(vfr('17/1','90000/1')).toMatchObject({sourceFrameRate:'17/1',outputFrameRate:'17/1'});
 for(const [avg,r] of [['525/22','30/1'],['0/0','0/0'],['24/1','24/1']]){const c=deriveLazyContract(containerLazySelect(a11,'small'),{width:1280,height:720,avg_frame_rate:avg,r_frame_rate:r}),e=c.encoding;
  expect(e.fps).toBeLessThanOrEqual(30);expect(()=>validateCadenceContract(e)).not.toThrow();
  // the fps filter is forced in both passes for normalized sources; CFR sources keep the catalog filter
  for(const pass of [1,2]){const args=lazyPassArguments('i','o','p',pass,c),vf=args[args.indexOf('-vf')+1];expect(vf.startsWith('fps=fps='+e.outputFrameRate+':round=near,')).toBe(Boolean(e.cadenceNormalization)||e.outputFrameRate!==e.sourceFrameRate);}}
 // a 1-pixel source is still served at the smallest yuv420p raster
 expect(fitLazyRaster(selectVideoContract(a11,'small').encoding,{width:1,height:720})).toMatchObject({width:2,height:480});
});

test('(h) output check holds the fitted raster and the no-upscale display bound',()=>{
 const src={streams:[{codec_type:'video',width:1440,height:1080,sample_aspect_ratio:'4:3'},{codec_type:'audio'}],format:{duration:'10'}};
 const c=deriveLazyContract(containerLazySelect(a11,'xlarge'),{...src.streams[0],avg_frame_rate:'25/1',r_frame_rate:'25/1'});
 const out=(o)=>({streams:[{codec_type:'video',codec_name:'h264',pix_fmt:'yuv420p',width:1616,height:912,avg_frame_rate:'25/1',r_frame_rate:'25/1',sample_aspect_ratio:'304:303',display_aspect_ratio:'16:9',...o},{codec_type:'audio',codec_name:'aac',channels:2,sample_rate:'48000'}],format:{duration:'10'}});
 expect(validateLazyOutput(src,out({}),c)).toMatchObject({width:1616,height:912});
 for(const o of [{width:1600},{sample_aspect_ratio:'1:1'},{display_aspect_ratio:'4:3'},{r_frame_rate:'50/1'}])expect(()=>validateLazyOutput(src,out(o),c)).toThrow();
 // a raster wider than the source display is refused even if the contract asked for it
 expect(()=>validateLazyOutput(src,out({}),{...c,encoding:{...c.encoding,width:1928,height:1080,sar:'1:1',dar:'241:135'}})).toThrow('Invalid output dimensions');
 // silent sources are fine
 const silent={...src,streams:[src.streams[0]]},silentOut=out({});silentOut.streams.pop();expect(validateLazyOutput(silent,silentOut,c).audioCodec).toBeNull();
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

test('lazy 422 from the encoder (unqualified source) reaches the client as 422, not 502',async()=>{
 const instance=async()=>({fetch:async(r)=>{const u=new URL(r.url);if(u.pathname==='/video-lazy-info')return Response.json({revision:'c'.repeat(64)});return new Response('Variable frame rate source not supported',{status:422});}});
 const r=await handleVideoProxy(new Request('https://proxy/video'),{head:async()=>null},instance,a11,{size:'small'});
 expect(r.status).toBe(422);expect(await r.text()).toContain('Variable frame rate');
});

// Real encode: a variable-frame-rate fixture (30 fps with every third frame dropped
// after 1 s) goes through the lazy two-pass encode and output check as CFR.
const hasEncoder=['/usr/bin/ffmpeg','/usr/bin/ffprobe','/usr/bin/prlimit'].every(p=>existsSync(p));
test.skipIf(!hasEncoder)('VFR fixture encodes to constant frame rate through the lazy encoder (real ffmpeg)',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lazy-vfr-test-'));
 try{
  const run=args=>{const r=Bun.spawnSync(args);if(r.exitCode)throw Error(r.stderr.toString().slice(-400));return r.stdout.toString();};
  const probe=p=>JSON.parse(run(['/usr/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',p]));
  const input=join(dir,'vfr.mp4'),output=join(dir,'out.mp4');
  run(['/usr/bin/ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-f','lavfi','-i','sine=r=44100','-t','3','-vf',"select='not(eq(mod(n\\,3)\\,2))+lt(n\\,30)'",'-fps_mode','vfr','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',input]);
  const source=probe(input),v=source.streams.find(s=>s.codec_type==='video');
  expect(v.avg_frame_rate).not.toBe(v.r_frame_rate); // genuinely VFR
  const contract=deriveLazyContract(containerLazySelect(a11,'small'),v);
  expect(contract.encoding).toMatchObject({outputFrameRate:'24000/1001',width:640,height:360,sar:'1:1'});
  const encoding=await lazyEncode(input,output,dir,source,AbortSignal.timeout(60000),()=>{},contract);
  expect(encoding.passes.map(p=>p.pass)).toEqual([1,2]);
  const result=probe(output),o=result.streams.find(s=>s.codec_type==='video');
  expect(o.avg_frame_rate).toBe('24000/1001');expect(o.r_frame_rate).toBe('24000/1001');
  expect(validateLazyOutput(source,result,contract)).toMatchObject({width:640,height:360,audioCodec:'aac'});
 }finally{await rm(dir,{recursive:true,force:true});}
},90000);
