import { byteRange } from './video';
const qualifiedReview = 'https://github.com/klappy/transcode-mcp/blob/625ec4d563fe895f6fd11a23ff27d8dafbefed85/canon/planning/2026-10-05-fia-r2-production-proof.md';
export const videoReferences = {
  'a13-xsmall-25fps-benchmark-v1': {"url":"https://transcode-mcp-development.klappy.workers.dev/video/preset=fia,q=medium,f=mp4,size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","bytes":1825753,"sha256":"627ac30873371b3c237eead9b582672016da5a3d44c3b420dc0149850bf8003d","review":"https://github.com/klappy/transcode-mcp/blob/b6fd092522022d62b2812580c515e184568feb20/canon/planning/2026-10-05-fixed-measured-benchmarks.md"},
  'a13-small-25fps-benchmark-v1': {"url":"https://transcode-mcp-development.klappy.workers.dev/video/preset=fia,q=medium,f=mp4,size=small/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","bytes":3493851,"sha256":"ff6e824bc2fb902fd380052247287431ba62750c249f88406729f440320d96b3","review":"https://github.com/klappy/transcode-mcp/blob/b6fd092522022d62b2812580c515e184568feb20/canon/planning/2026-10-05-fixed-measured-benchmarks.md"},
  'a13-medium-25fps-benchmark-v1': {"url":"https://transcode-mcp-development.klappy.workers.dev/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","bytes":4386076,"sha256":"f39a7b8ab99b15dc00ead12a0be5e1fddb9d77f3d57758b3a368b2093e66a38c","review":"https://github.com/klappy/transcode-mcp/blob/b6fd092522022d62b2812580c515e184568feb20/canon/planning/2026-10-05-fixed-measured-benchmarks.md"},
  'a13-large-25fps-benchmark-v1': {"url":"https://transcode-mcp-development.klappy.workers.dev/video/preset=fia,q=medium,f=mp4/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4","bytes":7598950,"sha256":"83f22e9ffa67218b89cf852c85db8e0b52781697e4bf8665104dc27658525668","review":"https://github.com/klappy/transcode-mcp/blob/b6fd092522022d62b2812580c515e184568feb20/canon/planning/2026-10-05-fixed-measured-benchmarks.md"},

  'a13-source': {url:'https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4', bytes:49851846, sha256:'257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718'},
  'a13-bundled': {url:'https://fiaguide.app/assets/jordan-river.mp4', bytes:2547817, sha256:'47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8'},
  'a13-small-qualified-v1': {url:'https://transcode.klappy.dev/video/preset=fia,q=medium,f=mp4,size=small/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4',bytes:2564228,sha256:'19195e93cd9ba96aa920d23b94fddd5a0c9ccb12cc8c18af8224da39b4e2d9c5',review:qualifiedReview},
  'a13-medium-qualified-v1': {url:'https://transcode.klappy.dev/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4',bytes:3203638,sha256:'f0b39072378b5ca7ad77236f50981e779274cabc3d7d39b374fd7d6210ece610',review:qualifiedReview},
  'a13-large-qualified-v1': {url:'https://transcode.klappy.dev/video/preset=fia,q=medium,f=mp4/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4',bytes:5508450,sha256:'7314f695f6087f6e0e93c8ae5cfe7235ac043ee8dec997a6e101fb3f47140d15',review:qualifiedReview},
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
    if(m.schemaVersion!==1||m.referenceId!==id||m.sha256!==ref.sha256||m.bytes!==ref.bytes||m.sourceUrl!==ref.url||m.rights!=='CC-BY-SA-4.0'||m.sourceReview!==('review' in ref?ref.review:sourceReview)||typeof m.r2Etag!=='string'||!m.r2Etag)throw Error('Invalid publication');
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
