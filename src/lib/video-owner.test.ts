import {test,expect} from 'bun:test';
import {VideoOwner,VideoBusyError,videoSlot,videoContract,handleVideoProxy} from './video';
(globalThis as any).FixedLengthStream=class extends TransformStream{constructor(_n:number){super();}};
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};};
test('admission precedes async work; joins share one owner and other keys are bounded busy',async()=>{
 const gate=deferred<number>(),retained:Promise<unknown>[]=[];let calls=0;
 const owner=new VideoOwner(p=>retained.push(p));
 const first=owner.run('a',async()=>{calls++;return gate.promise;});
 const joined=owner.run('a',async()=>{throw Error('duplicate');});
 expect(first).toBe(joined);expect(retained.length).toBe(1);
 await expect(owner.run('b',async()=>2)).rejects.toBeInstanceOf(VideoBusyError);
 await Promise.resolve();expect(calls).toBe(1);gate.resolve(1);
 expect(await first).toBe(1);await retained[0];expect(await owner.run('b',async()=>2)).toBe(2);
});
test('failure remains observable, retained rejection is handled and slot can retry',async()=>{
 const retained:Promise<unknown>[]=[];const owner=new VideoOwner(p=>retained.push(p));
 await expect(owner.run('a',async()=>{throw Error('integrity');})).rejects.toThrow('integrity');
 await retained[0];expect(await owner.run('a',async()=>3)).toBe(3);
});
test('deterministic source routing uses the existing bounded instance names',async()=>{
 const one=await videoSlot(videoContract.source.url,5);
 expect(one).toMatch(/^instance-[0-4]$/);expect(await videoSlot(videoContract.source.url,5)).toBe(one);
 await expect(videoSlot('https://invalid',5)).rejects.toThrow();
});
test('disconnected consumer cannot stop verified publication; joiners and later HIT get independent bodies',async()=>{
 const bytes=new Uint8Array([1,2,3,4]), revision='a'.repeat(64);
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const gate=deferred<void>(),started=deferred<void>();let transforms=0,object:any;
 const data=new Map<string,Uint8Array>(),signals:AbortSignal[]=[];
 const bucket={head:async()=>object,put:async(key:string,body:any,options:any)=>{const value=new Uint8Array(await new Response(body).arrayBuffer());data.set(key,value);if(options)object={size:value.length,customMetadata:options.customMetadata};},delete:async(key:string)=>{data.delete(key);},get:async(key:string,options:any)=>{const value=data.get(key);return value?{body:new Response(options?.range?value.slice(options.range.offset,options.range.offset+options.range.length):value).body}:null;}} as unknown as R2Bucket;
 const instance=async()=>({fetch:async(req:Request)=>{signals.push(req.signal);if(new URL(req.url).pathname==='/video-info')return Response.json({revision});transforms++;started.resolve();await gate.promise;return new Response(bytes,{headers:{'X-Video-Metadata':JSON.stringify({encoderRevision:revision,sourceSha256:videoContract.source.sha256,sourceBytes:videoContract.source.bytes,recipe:videoContract.recipe,bytes:bytes.length,sha256:sha})}});}});
 const retained:Promise<unknown>[]=[];const owner=new VideoOwner(p=>retained.push(p));const controller=new AbortController();
 const first=handleVideoProxy(new Request('https://x',{signal:controller.signal}),bucket,instance,videoContract.source.url,{},owner);
 await started.promise;
 const second=handleVideoProxy(new Request('https://x',{headers:{Range:'bytes=1-2'}}),bucket,instance,videoContract.source.url,{},owner);
 controller.abort();expect(signals.every(s=>!s.aborted)).toBe(true);gate.resolve();await retained[0];
 const a=await first,b=await second;expect(new Uint8Array(await a.arrayBuffer())).toEqual(bytes);expect(new Uint8Array(await b.arrayBuffer())).toEqual(new Uint8Array([2,3]));expect(b.status).toBe(206);
 const hit=await handleVideoProxy(new Request('https://x'),bucket,instance,videoContract.source.url,{},owner);expect(hit.headers.get('X-Transcode-Cache')).toBe('HIT');expect(new Uint8Array(await hit.arrayBuffer())).toEqual(bytes);expect(transforms).toBe(1);expect([...data.keys()].some(k=>k.startsWith('video-pending/'))).toBe(false);
});

test('stalled initial storage bounds consumer wait but keeps slot until late read settles; no encode follows',async()=>{
 const read=deferred<any>(),retained:Promise<unknown>[]=[],events:any[]=[];let encodes=0;
 const owner=new VideoOwner(p=>retained.push(p),15,e=>events.push(e));
 const bucket={head:()=>read.promise} as unknown as R2Bucket;
 const instance=async()=>({fetch:async(req:Request)=>{if(new URL(req.url).pathname==='/video-info')return Response.json({revision:'a'.repeat(64)});encodes++;throw Error('late encode');}});
 const response=await handleVideoProxy(new Request('https://x'),bucket,instance,videoContract.source.url,{},owner);
 expect(response.status).toBe(504);
 await expect(owner.run('other',async()=>1)).rejects.toBeInstanceOf(VideoBusyError);
 expect((await handleVideoProxy(new Request('https://x'),bucket,instance,videoContract.source.url,{},owner)).status).toBe(504);
 read.resolve(null);await retained[0];expect(encodes).toBe(0);expect(events).toEqual([{event:'video-owner-failed',deadlineExceeded:true}]);
 expect(await owner.run('other',async()=>2)).toBe(2);
});

test('verified PUT issued before deadline can seed cache later; owner remains occupied through cleanup',async()=>{
 const bytes=new Uint8Array([8,9]),revision='a'.repeat(64),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const putStarted=deferred<void>(),finishPut=deferred<void>(),cleanupStarted=deferred<void>(),finishCleanup=deferred<void>();
 const retained:Promise<unknown>[]=[],events:any[]=[];const owner=new VideoOwner(p=>retained.push(p),30,e=>events.push(e));let canonical:any,transforms=0;
 const bucket={head:async()=>canonical,put:async(key:string,body:any,opts:any)=>{const value=new Uint8Array(await new Response(body).arrayBuffer());if(opts){putStarted.resolve();await finishPut.promise;canonical={size:value.length,customMetadata:opts.customMetadata};}},get:async()=>({body:new Response(bytes).body}),delete:async()=>{cleanupStarted.resolve();await finishCleanup.promise;}} as unknown as R2Bucket;
 const instance=async()=>({fetch:async(req:Request)=>{if(new URL(req.url).pathname==='/video-info')return Response.json({revision});transforms++;return new Response(bytes,{headers:{'X-Video-Metadata':JSON.stringify({encoderRevision:revision,sourceSha256:videoContract.source.sha256,sourceBytes:videoContract.source.bytes,recipe:videoContract.recipe,bytes:2,sha256:sha})}});}});
 const request=handleVideoProxy(new Request('https://x'),bucket,instance,videoContract.source.url,{},owner);
 await putStarted.promise;expect((await request).status).toBe(504);expect(canonical).toBeUndefined();
 await expect(owner.run('other',async()=>0)).rejects.toBeInstanceOf(VideoBusyError);
 finishPut.resolve();await cleanupStarted.promise;expect(canonical.customMetadata.sha256).toBe(sha);
 await expect(owner.run('other',async()=>0)).rejects.toBeInstanceOf(VideoBusyError);
 finishCleanup.resolve();await retained[0];expect(events[0].deadlineExceeded).toBe(true);
 const hit=await handleVideoProxy(new Request('https://x'),bucket,instance,videoContract.source.url,{},owner);
 expect(hit.status).toBe(200);expect(hit.headers.get('X-Transcode-Cache')).toBe('HIT');expect(new Uint8Array(await hit.arrayBuffer())).toEqual(bytes);expect(transforms).toBe(1);
});

test('post-deadline settlement failure is reported, never unhandled or success',async()=>{
 let reject!:(e:Error)=>void;const pending=new Promise<void>((_,r)=>reject=r);const retained:Promise<unknown>[]=[],events:any[]=[];
 const owner=new VideoOwner(p=>retained.push(p),10,e=>events.push(e));
 await expect(owner.run('key',()=>pending)).rejects.toThrow('deadline');
 await expect(owner.run('different',async()=>1)).rejects.toBeInstanceOf(VideoBusyError);
 reject(Error('cleanup unavailable'));await retained[0];expect(events).toEqual([{event:'video-owner-failed',deadlineExceeded:true}]);expect(await owner.run('different',async()=>1)).toBe(1);
});
