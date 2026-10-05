import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
import {handleVideoReference,streamVideoReference,videoReferences,type ReferenceFetcher} from './video-reference';
const bytes=new Uint8Array([1,2,3,4]);
const ref={url:'https://fixture.invalid/video',bytes:4,sha256:createHash('sha256').update(bytes).digest('hex'),etag:'"pinned"'};
const req=(method='GET',range?:string)=>new Request('https://worker/reference/video/a13-source',{method,headers:range?{Range:range}:{}});
const upstream=(body:BodyInit|null=bytes,headers:Record<string,string>={},status=200)=>new Response(body,{status,headers:{'Content-Type':'video/mp4',ETag:ref.etag,...headers}});
test('fixed dispatch rejects arbitrary path/query/method without any origin call',async()=>{
 let calls=0;const f=async()=>{calls++;throw Error('no')};
 for(const path of ['/reference/video/https://evil.test','/reference/video/a13-source?url=x'])expect((await handleVideoReference(new Request('https://worker'+path),f as ReferenceFetcher)).status).toBe(404);
 expect((await streamVideoReference(req('POST'),ref,f as ReferenceFetcher)).status).toBe(405);expect((await streamVideoReference(req('OPTIONS'),ref,f as ReferenceFetcher)).status).toBe(204);expect(calls).toBe(0);
 expect(Object.keys(videoReferences)).toEqual(['a13-source','a13-bundled']);
});
test('full stream binds fixed origin If-Match and verifies bytes without full buffering',async()=>{
 const r=await streamVideoReference(req(),ref,(async(url,options)=>{expect(url).toBe(ref.url);expect(options?.redirect).toBe('error');expect((options?.headers as any)['If-Match']).toBe(ref.etag);return upstream()}) as ReferenceFetcher);
 expect(r.status).toBe(200);expect(r.headers.get('content-length')).toBe('4');expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);
});
test('HEAD missing upstream length uses pinned metadata with validator; never reads body',async()=>{
 const r=await streamVideoReference(req('HEAD'),ref,(async()=>upstream(null)) as ReferenceFetcher);expect(r.status).toBe(200);expect(r.headers.get('content-length')).toBe('4');expect(await r.text()).toBe('');
});
test('range forwarded canonically with exact Content-Range and bounded bytes',async()=>{
 const r=await streamVideoReference(req('GET','bytes=-2'),ref,(async(_,o)=>{expect((o?.headers as any).Range).toBe('bytes=2-3');return upstream(bytes.slice(2),{'Content-Range':'bytes 2-3/4','Content-Length':'2'},206)}) as ReferenceFetcher);
 expect(r.status).toBe(206);expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes.slice(2));
 for(const range of ['bytes=4-','bytes=0-1,2-3','garbage'])expect((await streamVideoReference(req('GET',range),ref,(async()=>{throw Error('no call')}) as ReferenceFetcher)).status).toBe(416);
});
test('changed validator, MIME, redirect/status or lengths fail before delivery',async()=>{
 for(const r of [upstream(bytes,{ETag:'"new"'}),upstream(bytes,{'Content-Type':'text/html'}),upstream(bytes,{'Content-Length':'9'}),upstream(null,{},302)])expect((await streamVideoReference(req(),ref,(async()=>r) as ReferenceFetcher)).status).toBe(502);
 expect((await streamVideoReference(req(),ref,(async()=>upstream(null,{},412)) as ReferenceFetcher)).status).toBe(412);
 expect((await streamVideoReference(req('GET','bytes=0-1'),ref,(async()=>upstream(bytes)) as ReferenceFetcher)).status).toBe(502);
});
test('overrun, truncation and changed full payload fail the stream',async()=>{
 for(const b of [new Uint8Array([1,2,3,4,5]),new Uint8Array([1,2]),new Uint8Array([4,3,2,1])]){
  const r=await streamVideoReference(req(),ref,(async()=>upstream(b)) as ReferenceFetcher);await expect(r.arrayBuffer()).rejects.toThrow();
 }
});
test('consumer cancellation aborts origin and cancels its reader',async()=>{
 let signal:AbortSignal|undefined,cancelled=false;
 const r=await streamVideoReference(req(),ref,(async(_,o)=>{signal=o?.signal as AbortSignal;return upstream(new ReadableStream({pull(){},cancel(){cancelled=true}}))}) as ReferenceFetcher);
 await r.body!.cancel();expect(signal!.aborted).toBe(true);expect(cancelled).toBe(true);
});
test('header deadline aborts an outstanding actual-style fetch',async()=>{
 const r=await streamVideoReference(req(),ref,((_,o)=>new Promise((_,reject)=>o!.signal!.addEventListener('abort',()=>reject(Error('aborted'))))) as ReferenceFetcher,{headersMs:5,totalMs:20});expect(r.status).toBe(502);
});
test('complete-transfer deadline aborts a stalled body after valid headers',async()=>{
 let signal:AbortSignal|undefined,aborted=false;
 const response=await streamVideoReference(req(),ref,(async(_,options)=>{
  signal=options!.signal as AbortSignal;
  return upstream(new ReadableStream({start(output){signal!.addEventListener('abort',()=>{aborted=true;output.error(Error('origin body aborted'))},{once:true})},pull(){}}));
 }) as ReferenceFetcher,{headersMs:5,totalMs:15});
 expect(response.status).toBe(200);await expect(response.arrayBuffer()).rejects.toThrow('origin body aborted');expect(signal!.aborted).toBe(true);expect(aborted).toBe(true);
});
test('fixed bundled full-origin adaptation slices prefix middle and suffix across chunks',async()=>{
 for(const [range,expected] of [['bytes=0-0',[1]],['bytes=1-2',[2,3]],['bytes=-2',[3,4]]] as const){
  let cancelled=false,signal:AbortSignal|undefined;
  const r=await streamVideoReference(req('GET',range),{...ref,sliceFullRange:true},(async(_,o)=>{
   signal=o!.signal as AbortSignal;let index=0;
   return upstream(new ReadableStream({pull(c){if(index<4)c.enqueue(bytes.slice(index,index+1));else c.close();index++},cancel(){cancelled=true}}),{'Content-Length':'4'});
  }) as ReferenceFetcher);
  expect(r.status).toBe(206);expect(r.headers.get('x-reference-range-mode')).toBe('full-origin-slice');expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([...expected]);expect(signal!.aborted).toBe(true);
 }
});
test('range adaptation is opt-in with full length/validator checks and HEAD metadata only',async()=>{
 expect((await streamVideoReference(req('GET','bytes=0-1'),ref,(async()=>upstream(bytes,{'Content-Length':'4'})) as ReferenceFetcher)).status).toBe(502);
 for(const headers of [{},{'Content-Length':'3'},{'Content-Length':'4',ETag:'"changed"'}] as Record<string,string>[])expect((await streamVideoReference(req('GET','bytes=0-1'),{...ref,sliceFullRange:true},(async()=>upstream(bytes,headers)) as ReferenceFetcher)).status).toBe(502);
 const h=await streamVideoReference(req('HEAD','bytes=-2'),{...ref,sliceFullRange:true},(async()=>upstream(null)) as ReferenceFetcher);expect(h.status).toBe(206);expect(h.headers.get('content-length')).toBe('2');expect(h.headers.get('content-range')).toBe('bytes 2-3/4');
});
test('adapted ranges reject truncated or excessive upstream bytes',async()=>{
 for(const b of [new Uint8Array([1,2]),new Uint8Array([1,2,3,4,5])]){
  const r=await streamVideoReference(req('GET','bytes=2-3'),{...ref,sliceFullRange:true},(async()=>upstream(b,{'Content-Length':'4'})) as ReferenceFetcher);await expect(r.arrayBuffer()).rejects.toThrow();
 }
});
