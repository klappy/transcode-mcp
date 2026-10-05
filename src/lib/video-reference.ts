import { byteRange } from './video';
export const videoReferences = {
  'a13-source': {url:'https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4', bytes:49851846, sha256:'257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718'},
  'a13-bundled': {url:'https://fiaguide.app/assets/jordan-river.mp4', bytes:2547817, sha256:'47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8'},
} as const;
export const sourceReview = 'https://github.com/klappy/fia-app-cookbook/blob/56979f7463879b01ccdde18f6a36102d779c9680/evidence/2026-10-05-video-source-review-a13.json';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Range','Access-Control-Expose-Headers':'Content-Length, Content-Range, Accept-Ranges, ETag, X-Reference-Expected-SHA256','Cache-Control':'public, max-age=0, must-revalidate'};
// Sidecars are published last by the operator, after full object readback verification.
// No request-time source fetch, encoding, publication, or full-video buffering.
export async function handleVideoReference(request:Request, bucket?:R2Bucket) {
  const u=new URL(request.url), id=u.pathname.slice('/reference/video/'.length);
  const error=(status:number,message:string,extra:Record<string,string>={})=>new Response(request.method==='HEAD'?null:message,{status,headers:{...cors,...extra}});
  if(!Object.hasOwn(videoReferences,id)||u.search)return error(404,'Unknown video reference');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(!['GET','HEAD'].includes(request.method))return error(405,'GET or HEAD only',{Allow:'GET, HEAD, OPTIONS'});
  const ref=videoReferences[id as keyof typeof videoReferences];
  let range:ReturnType<typeof byteRange>;
  try {range=byteRange(request.headers.get('Range'),ref.bytes);}catch{return error(416,'Invalid or unsatisfiable range',{'Content-Range':`bytes */${ref.bytes}`});}
  if(!bucket)return error(503,'Reference unavailable');
  const key=`video-reference-v1/${ref.sha256}`;
  let selected:R2ObjectBody|null=null;
  try {
    const sidecar=await bucket.get(`${key}.json`);
    if(!sidecar)throw Error('Missing publication');
    if(sidecar.size>4096){await sidecar.body.cancel();throw Error('Oversized publication');}
    const reader=sidecar.body.getReader();const chunks:Uint8Array[]=[];let count=0;
    try {for(;;){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>4096)throw Error('Oversized publication');chunks.push(value);}}
    catch(e){await reader.cancel().catch(()=>{});throw e;}
    const bytes=new Uint8Array(count);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const m=JSON.parse(new TextDecoder().decode(bytes));
    if(m.schemaVersion!==1||m.referenceId!==id||m.sha256!==ref.sha256||m.bytes!==ref.bytes||m.sourceUrl!==ref.url||m.rights!=='CC-BY-SA-4.0'||m.sourceReview!==sourceReview||typeof m.r2Etag!=='string'||!m.r2Etag)throw Error('Invalid publication');
    const valid=(o:R2Object|null)=>Boolean(o&&o.size===ref.bytes&&o.etag===m.r2Etag&&o.httpMetadata?.contentType==='video/mp4');
    if(!valid(await bucket.head(`${key}.mp4`)))throw Error('Invalid object');
    const start=range?.offset??0,length=range?.length??ref.bytes;
    const headers=new Headers({...cors,'Content-Type':'video/mp4','Content-Length':String(length),'Accept-Ranges':'bytes','ETag':`"sha256-${ref.sha256}"`,'X-Reference-Expected-SHA256':ref.sha256});
    if(range)headers.set('Content-Range',`bytes ${start}-${start+length-1}/${ref.bytes}`);
    if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
    selected=await bucket.get(`${key}.mp4`,range?{range}:undefined);
    if(!valid(selected)||!selected)throw Error('Object changed');
    return new Response(selected.body,{status:range?206:200,headers});
  }catch{await selected?.body.cancel().catch(()=>{});return error(503,'Reference unavailable');}
}
