import {test,expect,beforeEach} from 'bun:test';
import {createHash} from 'node:crypto';
import {LEGACY_PINS,legacyPinFor,serveLegacyVideoPin,servePinnedFallback,clearLegacyPinVerification,type LegacyVideoPin} from './video-published-pins';
import {videoContracts,selectCatalogVideoContract,videoKey,videoSlot} from './video';
import worker from '../worker';

const A13='https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4';
const bytes=new Uint8Array(1000).map((_,i)=>(i*7+3)&255);
const sha=createHash('sha256').update(bytes).digest('hex');
const fixturePin:LegacyVideoPin={bytes:bytes.length,sha256:sha,keys:[`video-reference-v1/${sha}.mp4`,'video-v1/historical.mp4']};
type Obj={data:Uint8Array;etag:string;customMetadata?:Record<string,string>};
function r2(objects:Record<string,Obj>){
 const calls:string[]=[];
 const meta=(o:Obj)=>({size:o.data.length,etag:o.etag,customMetadata:o.customMetadata,httpMetadata:{contentType:'video/mp4'}});
 const bucket={
  head:async(k:string)=>{calls.push('head '+k);const o=objects[k];return o?meta(o):null;},
  get:async(k:string,opts?:any)=>{calls.push('get '+k+(opts?.range?` ${opts.range.offset}+${opts.range.length}`:''));const o=objects[k];if(!o)return null;const d=opts?.range?o.data.slice(opts.range.offset,opts.range.offset+opts.range.length):o.data;return {...meta(o),body:new Response(d).body};},
  put:async()=>{throw Error('pin path must not write R2');},
  delete:async()=>{throw Error('pin path must not delete R2');},
 } as unknown as R2Bucket;
 return {bucket,calls};
}
const req=(method='GET',range?:string)=>new Request('https://t/video/preset=fia,q=medium,f=mp4/'+A13,{method,headers:range?{Range:range}:{}});
const logs:any[]=[];const log=(e:any)=>logs.push(e);
beforeEach(()=>{clearLegacyPinVerification();logs.length=0;});

test('pin table is the immutable alpha.13 released identities',()=>{
 expect(Object.isFrozen(LEGACY_PINS)).toBe(true);
 expect(Object.fromEntries(Object.entries(LEGACY_PINS).map(([u,p])=>[u,[p.bytes,p.sha256,...p.keys]]))).toEqual({
  [A13]:[5508450,'7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15','video-reference-v1/7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15.mp4','video-v1/31e8d813e2e6cc956e1b63403c9e10e455c87457252ff126d6e0e8a9c7b70745.mp4'],
  'https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4':[3958360,'bb1e991a78c8bdf146599efc4170caee51b284e7bf48bc23e4a59754f8789d99','video-reference-v1/bb1e991a78c8bdf146599efc4170caee51b284e7bf48bc23e4a59754f8789d99.mp4','video-v1/696209695af2e9509125149a57eafc45007f054300fa3aee0d071a2de9dd56dd.mp4'],
  'https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4':[3814200,'077bef593feb976f8b18eaa01feb0e5fba7b0c805cff767d25732c06309daa92','video-reference-v1/077bef593feb976f8b18eaa01feb0e5fba7b0c805cff767d25732c06309daa92.mp4','video-v1/8b9596bd18f58afad390947286a2724611ba032d81bb9e954e7a5856a173de60.mp4'],
 });
});

test('only the omitted-size released form is pinned',()=>{
 for(const u of Object.keys(LEGACY_PINS))expect(legacyPinFor('/video/preset=fia,q=medium,f=mp4/'+u,'')).toBe(LEGACY_PINS[u]);
 for(const size of ['large','xsmall','small','medium','xlarge'])expect(legacyPinFor(`/video/preset=fia,q=medium,f=mp4,size=${size}/`+A13,'')).toBeUndefined();
 expect(legacyPinFor('/video/size=large,preset=fia,q=medium,f=mp4/'+A13,'')).toBeUndefined();
 expect(legacyPinFor('/video/preset=fia,q=medium,f=mp4/'+A13,'?x=1')).toBeUndefined();
 expect(legacyPinFor('/video/preset=fia,q=medium,f=mp4/https://s3.amazonaws.com/cbbt-er.public/media/videos/a99/720p.mp4','')).toBeUndefined();
 expect(legacyPinFor('/video/preset=fia,q=medium,f=mp4/https://example.com/x.mp4','')).toBeUndefined();
 expect(legacyPinFor('/video/preset=fia,q=medium,f=mp4/constructor','')).toBeUndefined();
});

test('pinned hit via reference key serves HIT with pinned ETag and never writes',async()=>{
 const {bucket,calls}=r2({[fixturePin.keys[0]]:{data:bytes,etag:'e1',customMetadata:{width:'1280',height:'720'}}});
 const r=(await serveLegacyVideoPin(req(),bucket,fixturePin,log))!;
 expect(r.status).toBe(200);expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);
 expect(r.headers.get('ETag')).toBe(`"${sha}"`);expect(r.headers.get('X-Transcode-Cache')).toBe('HIT');expect(r.headers.get('X-Transcode-Pinned')).toBe('legacy-alpha13');
 expect(r.headers.get('Content-Length')).toBe('1000');expect(r.headers.get('Content-Type')).toBe('video/mp4');expect(r.headers.get('Accept-Ranges')).toBe('bytes');expect(r.headers.get('X-Transcode-Video-Width')).toBe('1280');
 expect(r.headers.get('Access-Control-Expose-Headers')).toContain('X-Transcode-Pinned');
 expect(calls.every(c=>c.includes(fixturePin.keys[0]))).toBe(true);
 // verification is memoized per storage etag: second serve does not re-hash
 calls.length=0;await (await serveLegacyVideoPin(req(),bucket,fixturePin,log))!.arrayBuffer();expect(calls).toEqual(['head '+fixturePin.keys[0],'get '+fixturePin.keys[0]]);
});

test('falls back to the historical key when the reference object is absent',async()=>{
 const {bucket}=r2({'video-v1/historical.mp4':{data:bytes,etag:'e2',customMetadata:{sha256:sha}}});
 const r=(await serveLegacyVideoPin(req(),bucket,fixturePin,log))!;
 expect(r.status).toBe(200);expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);expect(r.headers.get('ETag')).toBe(`"${sha}"`);
});

test('wrong bytes under pinned keys are rejected and fall through to encode path',async()=>{
 const wrong=bytes.slice();wrong[500]^=1;
 // same size, no metadata claim: rejected by streamed hash
 expect(await serveLegacyVideoPin(req(),r2({[fixturePin.keys[0]]:{data:wrong,etag:'w'},'video-v1/historical.mp4':{data:wrong,etag:'w2'}}).bucket,fixturePin,log)).toBeNull();
 expect(logs.at(-1).event).toBe('legacy-video-pin-unverified');
 // metadata that lies about the hash is not trusted
 expect(await serveLegacyVideoPin(req(),r2({'video-v1/historical.mp4':{data:wrong,etag:'w3',customMetadata:{sha256:sha}}}).bucket,fixturePin,log)).toBeNull();
 // different declared hash (staging/dev bytes under the same key) rejected
 expect(await serveLegacyVideoPin(req(),r2({'video-v1/historical.mp4':{data:bytes,etag:'w4',customMetadata:{sha256:'0'.repeat(64)}}}).bucket,fixturePin,log)).toBeNull();
 // wrong size
 expect(await serveLegacyVideoPin(req(),r2({[fixturePin.keys[0]]:{data:bytes.slice(1),etag:'w5'}}).bucket,fixturePin,log)).toBeNull();
 // bad reference object, good historical: historical is served
 const r=(await serveLegacyVideoPin(req(),r2({[fixturePin.keys[0]]:{data:wrong,etag:'w6'},'video-v1/historical.mp4':{data:bytes,etag:'g'}}).bucket,fixturePin,log))!;
 expect(r.status).toBe(200);expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);
});

test('object replaced after verification is not served',async()=>{
 const objects:Record<string,Obj>={[fixturePin.keys[0]]:{data:bytes,etag:'e1'}};const {bucket}=r2(objects);
 await (await serveLegacyVideoPin(req(),bucket,fixturePin,log))!.arrayBuffer();
 const wrong=bytes.slice();wrong[0]^=1;objects[fixturePin.keys[0]]={data:wrong,etag:'e9'};
 expect(await serveLegacyVideoPin(req(),bucket,fixturePin,log)).toBeNull();
});

test('pinned range, HEAD and 416',async()=>{
 const {bucket,calls}=r2({[fixturePin.keys[0]]:{data:bytes,etag:'e1'}});
 for(const [h,off,len] of [['bytes=0-9',0,10],['bytes=990-',990,10],['bytes=-5',995,5]] as const){
  const r=(await serveLegacyVideoPin(req('GET',h),bucket,fixturePin,log))!;
  expect(r.status).toBe(206);expect(r.headers.get('Content-Range')).toBe(`bytes ${off}-${off+len-1}/1000`);expect(r.headers.get('Content-Length')).toBe(String(len));
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes.slice(off,off+len));
 }
 expect(calls.at(-1)).toBe(`get ${fixturePin.keys[0]} 995+5`);
 const head=(await serveLegacyVideoPin(req('HEAD'),bucket,fixturePin,log))!;expect(head.status).toBe(200);expect(head.body).toBeNull();expect(head.headers.get('Content-Length')).toBe('1000');expect(head.headers.get('ETag')).toBe(`"${sha}"`);
 const headRange=(await serveLegacyVideoPin(req('HEAD','bytes=0-0'),bucket,fixturePin,log))!;expect(headRange.status).toBe(206);
 const bad=(await serveLegacyVideoPin(req('GET','bytes=1000-'),bucket,fixturePin,log))!;expect(bad.status).toBe(416);expect(bad.headers.get('Content-Range')).toBe('bytes */1000');
 expect(await serveLegacyVideoPin(req('OPTIONS'),bucket,fixturePin,log)).toBeNull();
 expect(await serveLegacyVideoPin(req(),undefined,fixturePin,log)).toBeNull();
 expect(await serveLegacyVideoPin(req(),bucket,undefined,log)).toBeNull();
});

test('worker: unverified pin, explicit size=large and unrelated URLs reach the unchanged encode path',async()=>{
 // No container binding: the encode path answers 503 'Video service unavailable'.
 const {bucket,calls}=r2({[LEGACY_PINS[A13].keys[1]]:{data:new Uint8Array(10),etag:'x'}});
 const env={AUDIO_BUCKET:bucket};const ctx={waitUntil(){},passThroughOnExecutionContext(){}} as any;
 const err=console.error;console.error=()=>{};
 try{
  for(const path of ['/video/preset=fia,q=medium,f=mp4/'+A13,'/video/preset=fia,q=medium,f=mp4,size=large/'+A13,'/video/preset=fia,q=medium,f=mp4,size=small/'+A13,'/video/preset=fia,q=medium,f=mp4/https://s3.amazonaws.com/cbbt-er.public/media/videos/a99/720p.mp4']){
   const r=await worker.fetch(new Request('https://t'+path),env as any,ctx);expect(r.status).toBe(503);expect(r.headers.get('X-Transcode-Pinned')).toBeNull();
  }
 }finally{console.error=err;}
 // Only the omitted-size a13 request consulted the pin keys.
 expect(calls).toEqual(LEGACY_PINS[A13].keys.map(k=>'head '+k));
});

const encoded=(data:Uint8Array,status=200,cache='MISS')=>async()=>new Response(status===200?data:'busy',{status,headers:{'X-Transcode-Cache':cache,'X-Transcode-Video-Width':'1280','X-Transcode-Video-Height':'720'}});
test('missing pinned objects: fallback encode with matching bytes serves (GET, range, HEAD, 416)',async()=>{
 const {bucket}=r2({});expect(await serveLegacyVideoPin(req(),bucket,fixturePin,log)).toBeNull();
 const r=await servePinnedFallback(req(),fixturePin,encoded(bytes),log);
 expect(r.status).toBe(200);expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);expect(r.headers.get('ETag')).toBe(`"${sha}"`);expect(r.headers.get('X-Transcode-Pinned')).toBe('legacy-alpha13');expect(r.headers.get('X-Transcode-Cache')).toBe('MISS');expect(r.headers.get('X-Transcode-Video-Width')).toBe('1280');
 const part=await servePinnedFallback(req('GET','bytes=10-19'),fixturePin,encoded(bytes),log);expect(part.status).toBe(206);expect(part.headers.get('Content-Range')).toBe('bytes 10-19/1000');expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes.slice(10,20));
 const head=await servePinnedFallback(req('HEAD'),fixturePin,encoded(bytes),log);expect(head.status).toBe(200);expect(head.body).toBeNull();expect(head.headers.get('Content-Length')).toBe('1000');
 const bad=await servePinnedFallback(req('GET','bytes=5000-'),fixturePin,encoded(bytes),log);expect(bad.status).toBe(416);expect(bad.headers.get('Content-Range')).toBe('bytes */1000');
});
test('missing pinned objects: fallback encode with different bytes is a 503 and serves nothing',async()=>{
 const wrong=bytes.slice();wrong[1]^=1;
 for(const [data,label] of [[wrong,'same length, different hash'],[bytes.slice(0,999),'short'],[new Uint8Array(2000),'long']] as const){
  for(const method of ['GET','HEAD']){const r=await servePinnedFallback(req(method,'bytes=0-9'),fixturePin,encoded(data),log);expect(r.status).toBe(503);expect(r.headers.get('X-Transcode-Pinned')).toBe('legacy-alpha13');expect(r.headers.get('ETag')).toBeNull();expect(r.headers.get('Content-Type')).not.toBe('video/mp4');if(method==='GET')expect(await r.text()).toBe('Pinned release bytes unavailable');else expect(r.body).toBeNull();}
 }
 expect(logs.at(-1).event).toBe('legacy-video-pin-fallback-rejected');
 const busy=await servePinnedFallback(req(),fixturePin,encoded(bytes,503),log);expect(busy.status).toBe(503);expect(await busy.text()).toBe('Pinned release bytes unavailable');
 const thrown=await servePinnedFallback(req(),fixturePin,async()=>{throw Error('down');},log);expect(thrown.status).toBe(503);
});

test('worker: unverified pin runs the encode path but refuses non-pinned output; explicit large passes through unchanged',async()=>{
 const seen:Request[]=[];const stub={fetch:async(r:Request)=>{seen.push(r);return new Response(new Uint8Array(10),{headers:{'X-Transcode-Cache':'MISS'}});}};
 const env={AUDIO_BUCKET:r2({}).bucket,AUDIO_CONTAINER:{idFromName:(n:string)=>n,get:()=>stub}};const ctx={waitUntil(){},passThroughOnExecutionContext(){}} as any;
 const err=console.error;console.error=()=>{};
 try{
  const pinned=await worker.fetch(new Request('https://t/video/preset=fia,q=medium,f=mp4/'+A13,{headers:{Range:'bytes=0-1'}}),env as any,ctx);
  expect(pinned.status).toBe(503);expect(pinned.headers.get('X-Transcode-Pinned')).toBe('legacy-alpha13');expect(seen[0].method).toBe('GET');expect(seen[0].headers.get('Range')).toBeNull();
  const explicit=await worker.fetch(new Request('https://t/video/preset=fia,q=medium,f=mp4,size=large/'+A13,{headers:{Range:'bytes=0-1'}}),env as any,ctx);
  expect(explicit.status).toBe(200);expect(explicit.headers.get('X-Transcode-Pinned')).toBeNull();expect(seen[1].headers.get('Range')).toBe('bytes=0-1');expect(new URL(seen[1].url).searchParams.get('size')).toBe('large');
 }finally{console.error=err;}
});

// Recorded from origin/main 3067d57: catalog contracts, cache keys and slots unchanged.
const MAIN_ROWS:[string,string,string,string][]=[["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","xsmall","67d8fae805367eca","instance-2"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","small","8f320c587e2fe7b1","instance-2"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","medium","5062d269a868a33a","instance-1"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","large","c0e2de33e0b8529b","instance-2"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4","xsmall","56f27f70134b1d7c","instance-3"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4","small","55d4b422ed06ba12","instance-2"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4","medium","06ec1309d1b3aeb7","instance-2"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4","large","35572b0820fa7d3b","instance-1"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4","xsmall","e14909cd9907e7a5","instance-3"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4","small","8bb3e7df38b4c687","instance-3"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4","medium","61d931f93872e029","instance-2"],["https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4","large","73bddb372280df02","instance-2"],["https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4","small","3d1572fa4d066c59","instance-1"],["https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4","xlarge","b9400e3d196b66dd","instance-3"]];
test('14 catalog rows keep origin/main videoKey and videoSlot',async()=>{
 expect(MAIN_ROWS.length).toBe(14);
 for(const [url,size,key,slot] of MAIN_ROWS){const s=selectCatalogVideoContract(url,size)!;expect(s).toBeDefined();expect((await videoKey('a'.repeat(64),s)).slice(9,25)).toBe(key);expect(await videoSlot(url,4,size)).toBe(slot);}
 expect(videoContracts.length).toBe(3);
});
