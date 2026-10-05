import {describe,test,expect} from 'bun:test';
import {handleVideoReference,videoReferences,sourceReview} from './video-reference';
const id='a13-bundled', ref=videoReferences[id], key=`video-reference-v1/${ref.sha256}`;
function fixture(change:Record<string,unknown>={}) {
 const calls:any[]=[];let cancelled=false;
 const manifest={schemaVersion:1,referenceId:id,sha256:ref.sha256,bytes:ref.bytes,sourceUrl:ref.url,rights:'CC-BY-SA-4.0',sourceReview,r2Etag:'opaque-storage-etag',...change};
 const meta={size:Number(ref.bytes),etag:'opaque-storage-etag',httpMetadata:{contentType:'video/mp4'}};
 const bucket={head:async(k:string)=>{calls.push(['head',k]);return meta;},get:async(k:string,opts:any)=>{calls.push(['get',k,opts]);if(k.endsWith('.json')){const data=new TextEncoder().encode(JSON.stringify(manifest));return {size:data.length,body:new ReadableStream({start(c){c.enqueue(data);c.close();}})};}return {...meta,body:new ReadableStream({pull(c){c.enqueue(new Uint8Array([1,2,3]));},cancel(){cancelled=true;}})};}} as unknown as R2Bucket;
 return {bucket,calls,meta,cancelled:()=>cancelled};
}
const request=(method='GET',range?:string,path=id)=>new Request(`https://test/reference/video/${path}`,{method,headers:range?{Range:range}:{}});
describe('fixed verified R2 references',()=>{
 test('HEAD validates publication and object without obtaining video body',async()=>{const f=fixture();const r=await handleVideoReference(request('HEAD'),f.bucket);expect(r.status).toBe(200);expect(r.body).toBeNull();expect(r.headers.get('Content-Length')).toBe(String(ref.bytes));expect(r.headers.get('ETag')).toBe(`"sha256-${ref.sha256}"`);expect(f.calls).toEqual([['get',`${key}.json`,undefined],['head',`${key}.mp4`]]);});
 test('full read has fresh R2 body and cancellation propagates',async()=>{const f=fixture();const r=await handleVideoReference(request(),f.bucket);expect(r.status).toBe(200);expect(f.calls[2]).toEqual(['get',`${key}.mp4`,undefined]);await r.body!.cancel();expect(f.cancelled()).toBe(true);});
 for(const [header,offset,length] of [['bytes=0-9',0,10],['bytes=10-19',10,10],['bytes=-10',ref.bytes-10,10]] as const)test(`efficient ${header}`,async()=>{const f=fixture();const r=await handleVideoReference(request('GET',header),f.bucket);expect(r.status).toBe(206);expect(f.calls[2]).toEqual(['get',`${key}.mp4`,{range:{offset,length}}]);expect(r.headers.get('Content-Range')).toBe(`bytes ${offset}-${offset+length-1}/${ref.bytes}`);await r.body!.cancel();});
 test('invalid ranges and routes never touch storage',async()=>{const f=fixture();for(const h of ['bytes=0-1,3-4','bytes=99999999-','invalid'])expect((await handleVideoReference(request('GET',h),f.bucket)).status).toBe(416);expect((await handleVideoReference(request('GET',undefined,'other'),f.bucket)).status).toBe(404);expect((await handleVideoReference(request('GET',undefined,`${id}?url=x`),f.bucket)).status).toBe(404);expect((await handleVideoReference(request('POST'),f.bucket)).status).toBe(405);expect((await handleVideoReference(request('OPTIONS'),f.bucket)).status).toBe(204);expect(f.calls).toEqual([]);});
 test('missing bucket and missing publication are unavailable',async()=>{expect((await handleVideoReference(request())).status).toBe(503);expect((await handleVideoReference(request(),{get:async()=>null} as any)).status).toBe(503);});
 test('every identity binding fails closed',async()=>{for(const change of [{sha256:'wrong'},{bytes:1},{sourceUrl:'wrong'},{referenceId:'other'},{rights:'wrong'},{sourceReview:'wrong'},{r2Etag:'wrong'},{schemaVersion:2}]){const f=fixture(change);expect((await handleVideoReference(request(),f.bucket)).status).toBe(503);expect(f.calls.filter(x=>x[0]==='get'&&x[1].endsWith('.mp4')).length).toBe(0);}});
 test('metadata mismatch fails before body and oversized sidecar cancels',async()=>{const f=fixture();f.meta.size=1;expect((await handleVideoReference(request(),f.bucket)).status).toBe(503);let cancelled=false;const b={get:async()=>({size:4097,body:new ReadableStream({cancel(){cancelled=true;}})})};expect((await handleVideoReference(request(),b as any)).status).toBe(503);expect(cancelled).toBe(true);});
 test('TOCTOU object mismatch cancels selected body',async()=>{const f=fixture();const old=f.bucket.get.bind(f.bucket);(f.bucket as any).get=async(k:string,o:any)=>{const v=await old(k,o);if(k.endsWith('.mp4'))(v as any).etag='changed';return v;};expect((await handleVideoReference(request(),f.bucket)).status).toBe(503);expect(f.cancelled()).toBe(true);});
});

for(const id of ['a13-small-qualified-v1','a13-medium-qualified-v1','a13-large-qualified-v1','a13-xsmall-25fps-benchmark-v1','a13-small-25fps-benchmark-v1','a13-medium-25fps-benchmark-v1','a13-large-25fps-benchmark-v1'] as const)test(`qualified comparison ${id} binds its output review and reads R2 only`,async()=>{
 const ref=videoReferences[id],key=`video-reference-v1/${ref.sha256}`;let bodyReads=0;
 const publication={schemaVersion:1,referenceId:id,sha256:ref.sha256,bytes:ref.bytes,sourceUrl:ref.url,rights:'CC-BY-SA-4.0',sourceReview:String(ref.review),r2Etag:'stored'};
 const object={size:ref.bytes,etag:'stored',httpMetadata:{contentType:'video/mp4'}};
 const bucket={head:async(k:string)=>{expect(k).toBe(key+'.mp4');return object;},get:async(k:string)=>{if(k.endsWith('.json')){const b=new TextEncoder().encode(JSON.stringify(publication));return{size:b.length,body:new Response(b).body};}bodyReads++;expect(k).toBe(key+'.mp4');return{...object,body:new Response(new Uint8Array(10)).body};}}as unknown as R2Bucket;
 const r=await handleVideoReference(request('GET','bytes=0-9',id),bucket);expect(r.status).toBe(206);expect(r.headers.get('ETag')).toBe(`"sha256-${ref.sha256}"`);expect(r.headers.get('Content-Range')).toBe(`bytes 0-9/${ref.bytes}`);await r.body!.cancel();expect(bodyReads).toBe(1);
 publication.sourceReview=sourceReview;expect((await handleVideoReference(request('HEAD',undefined,id),bucket)).status).toBe(503);expect(bodyReads).toBe(1);
});
