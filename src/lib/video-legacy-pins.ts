import {createHash} from "node:crypto";
import {byteRange} from './video';
// Released identities are served from pinned bytes, never re-derived from the
// current encoder identity. FIA alpha.13 pins the exact bytes of these omitted-size
// (Large) URLs; a recipe change (#99, fia-video@4 -> @5) must not change them.
// Canon: canon/planning/2026-10-05-legacy-video-pins.md
export type LegacyVideoPin={readonly bytes:number;readonly sha256:string;readonly keys:readonly string[]};
const pin=(bytes:number,sha256:string,historical:string):LegacyVideoPin=>Object.freeze({bytes,sha256,keys:Object.freeze([`video-reference-v1/${sha256}.mp4`,`video-v1/${historical}.mp4`])});
export const LEGACY_PIN_LABEL='legacy-alpha13';
export const LEGACY_PINS:Readonly<Record<string,LegacyVideoPin>>=Object.freeze({
  'https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4':pin(5508450,'7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15','31e8d813e2e6cc956e1b63403c9e10e455c87457252ff126d6e0e8a9c7b70745'),
  'https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4':pin(3958360,'bb1e991a78c8bdf146599efc4170caee51b284e7bf48bc23e4a59754f8789d99','696209695af2e9509125149a57eafc45007f054300fa3aee0d071a2de9dd56dd'),
  'https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4':pin(3814200,'077bef593feb976f8b18eaa01feb0e5fba7b0c805cff767d25732c06309daa92','8b9596bd18f58afad390947286a2724611ba032d81bb9e954e7a5856a173de60'),
});
// Only the exact released form: no size option (explicit size=large is NOT pinned;
// parseProxyPath normalizes both to the same options, so match the raw path).
const LEGACY_PREFIX='/video/preset=fia,q=medium,f=mp4/';
export function legacyPinFor(pathname:string,search:string,pins:Readonly<Record<string,LegacyVideoPin>>=LEGACY_PINS):LegacyVideoPin|undefined{
  if(search||!pathname.startsWith(LEGACY_PREFIX))return undefined;
  const source=pathname.slice(LEGACY_PREFIX.length);
  return Object.hasOwn(pins,source)?pins[source]:undefined;
}
// Per-isolate memo of storage objects whose full bytes hashed to the pin.
// Keyed by R2 key + etag, so a replaced object is re-verified.
const verified=new Set<string>();
async function verify(bucket:R2Bucket,key:string,p:LegacyVideoPin):Promise<R2Object|null>{
  const head=await bucket.head(key);
  if(!head||head.size!==p.bytes)return null;
  const declared=head.customMetadata?.sha256;
  if(declared!==undefined&&declared!==p.sha256)return null;
  const memo=key+'\n'+head.etag;
  if(verified.has(memo))return head;
  const body=await bucket.get(key);
  if(!body||!('body' in body)||body.etag!==head.etag||body.size!==p.bytes){await (body as R2ObjectBody|null)?.body?.cancel().catch(()=>{});return null;}
  const reader=body.body.getReader(),digest=createHash('sha256');let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>p.bytes)throw Error('oversize');digest.update(value);}}
  catch{await reader.cancel().catch(()=>{});return null;}
  if(size!==p.bytes||digest.digest('hex')!==p.sha256)return null;
  verified.add(memo);
  return head;
}
const EXPOSE='Content-Length, Content-Range, Accept-Ranges, ETag, X-Transcode-Cache, X-Transcode-Encode, X-Transcode-Video-Width, X-Transcode-Video-Height, X-Transcode-Pinned';
const baseHeaders=()=>new Headers({'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':EXPOSE,'Accept-Ranges':'bytes','X-Transcode-Pinned':LEGACY_PIN_LABEL});
// Same headers as a normal HIT, keyed to the pinned identity; 416 for a bad range.
function pinnedHeaders(request:Request,p:LegacyVideoPin,meta:Record<string,string>|undefined,cache:string):{headers:Headers;range:ReturnType<typeof byteRange>}|Response{
  const headers=baseHeaders();
  let range;
  try{range=byteRange(request.headers.get('Range'),p.bytes);}
  catch{headers.set('Content-Range',`bytes */${p.bytes}`);return new Response('Range unsatisfiable',{status:416,headers});}
  headers.set('Content-Type','video/mp4');
  headers.set('Cache-Control','public, max-age=0, must-revalidate');
  headers.set('ETag','"'+p.sha256+'"');
  headers.set('X-Transcode-Cache',cache);
  headers.set('X-Transcode-Encode','h264');
  for(const [name,field] of [['X-Transcode-Video-Width','width'],['X-Transcode-Video-Height','height']]){const v=meta?.[field];if(v&&/^\d+$/.test(v))headers.set(name,v);}
  headers.set('Content-Length',String(range?.length??p.bytes));
  if(range)headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${p.bytes}`);
  return {headers,range};
}
// Read-only: never writes or deletes R2. Returns null to fall through to the
// unchanged encode path when no candidate verifies.
export async function serveLegacyVideoPin(request:Request,bucket:R2Bucket|undefined,p:LegacyVideoPin|undefined,log:(event:Record<string,unknown>)=>void=e=>console.error(JSON.stringify(e))):Promise<Response|null>{
  if(!p||!bucket||!['GET','HEAD'].includes(request.method))return null;
  try{
    for(const key of p.keys){
      const object=await verify(bucket,key,p);
      if(!object)continue;
      const shaped=pinnedHeaders(request,p,object.customMetadata,'HIT');
      if(shaped instanceof Response)return shaped;
      const {headers,range}=shaped;
      if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
      const hit=await bucket.get(key,range?{range}:undefined);
      if(!hit||!('body' in hit)||hit.etag!==object.etag||hit.size!==p.bytes){await (hit as R2ObjectBody|null)?.body?.cancel().catch(()=>{});continue;}
      return new Response(hit.body,{status:range?206:200,headers});
    }
  }catch(error){log({event:'legacy-video-pin-error',sha256:p.sha256,error:String(error)});return null;}
  log({event:'legacy-video-pin-unverified',sha256:p.sha256,keys:p.keys});
  return null;
}
// No retained object verified: the unchanged encode path may run, but its full
// output must equal the pinned length and SHA-256 before any byte is served under
// the legacy identity (app owner amendment, PR #101). Otherwise an explicit 503.
// The encode path's own cache write stays under its current-encoder key.
export async function servePinnedFallback(request:Request,p:LegacyVideoPin,fetchFull:()=>Promise<Response>,log:(event:Record<string,unknown>)=>void=e=>console.error(JSON.stringify(e))):Promise<Response>{
  const unavailable=(reason:string)=>{log({event:'legacy-video-pin-fallback-rejected',sha256:p.sha256,reason});return new Response(request.method==='HEAD'?null:'Pinned release bytes unavailable',{status:503,headers:baseHeaders()});};
  let upstream:Response;
  try{upstream=await fetchFull();}catch(error){return unavailable(String(error));}
  if(upstream.status!==200||!upstream.body){
    await upstream.body?.cancel().catch(()=>{});
    // Encoder-side failures keep their status; no bytes are served.
    log({event:'legacy-video-pin-fallback-rejected',sha256:p.sha256,reason:`encode status ${upstream.status}`});
    return new Response(request.method==='HEAD'?null:'Pinned release bytes unavailable',{status:upstream.status===200||upstream.status<400?503:upstream.status,headers:baseHeaders()});
  }
  const reader=upstream.body.getReader(),digest=createHash('sha256'),data=new Uint8Array(p.bytes);let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(size+value.byteLength>p.bytes)throw Error('Encoded bytes exceed pin');data.set(value,size);size+=value.byteLength;digest.update(value);}}
  catch(error){await reader.cancel().catch(()=>{});return unavailable(String(error));}
  if(size!==p.bytes||digest.digest('hex')!==p.sha256)return unavailable(`encoded ${size} bytes do not match pin`);
  const shaped=pinnedHeaders(request,p,{width:upstream.headers.get('X-Transcode-Video-Width')||'',height:upstream.headers.get('X-Transcode-Video-Height')||''},upstream.headers.get('X-Transcode-Cache')||'MISS');
  if(shaped instanceof Response)return shaped;
  const {headers,range}=shaped;
  if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
  return new Response(range?data.slice(range.offset,range.offset+range.length):data,{status:range?206:200,headers});
}
export function clearLegacyPinVerification(){verified.clear();}
