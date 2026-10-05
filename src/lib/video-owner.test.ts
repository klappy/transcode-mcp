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
