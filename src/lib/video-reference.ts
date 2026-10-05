import { createHash } from 'node:crypto';
import { byteRange } from './video';
export const videoReferences = {
  'a13-source': {url:'https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4', bytes:49851846, sha256:'257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718', etag:'"0f26975764a4fca4fa0713cd5ec0e188"'},
  'a13-bundled': {url:'https://fiaguide.app/assets/jordan-river.mp4', bytes:2547817, sha256:'47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8', etag:'"4a3684d646c70e494c9f87b1a920458f"'},
} as const;
export type ReferenceFetcher = (input:string, init?:RequestInit) => Promise<Response>;
type Reference = {url:string;bytes:number;sha256:string;etag:string};
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Allow-Headers':'Range','Access-Control-Expose-Headers':'Content-Length, Content-Range, Accept-Ranges, ETag, X-Reference-Expected-SHA256','Cache-Control':'public, max-age=0, must-revalidate'};
export async function handleVideoReference(request:Request, fetcher:ReferenceFetcher=fetch) {
  const u=new URL(request.url), id=u.pathname.slice('/reference/video/'.length);
  if(!Object.hasOwn(videoReferences,id)||u.search)return new Response('Unknown video reference',{status:404,headers:cors});
  return streamVideoReference(request,videoReferences[id as keyof typeof videoReferences],fetcher);
}
// Exported for bounded transport tests; production dispatch selects only fixed IDs.
export async function streamVideoReference(request:Request,reference:Reference,fetcher:ReferenceFetcher=fetch,bounds={headersMs:25000,totalMs:120000}) {
  const error=(status:number,message:string,extra:Record<string,string>={})=>new Response(request.method==='HEAD'?null:message,{status,headers:{...cors,...extra}});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(!['GET','HEAD'].includes(request.method))return error(405,'GET or HEAD only',{Allow:'GET, HEAD, OPTIONS'});
  let range:ReturnType<typeof byteRange>;
  try {range=byteRange(request.headers.get('Range'),reference.bytes);}catch{return error(416,'Invalid or unsatisfiable range',{'Content-Range':`bytes */${reference.bytes}`});}
  const start=range?.offset??0,length=range?.length??reference.bytes,status=range?206:200;
  const controller=new AbortController();let done=false,reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  const abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  const totalTimer=setTimeout(abort,bounds.totalMs),headerTimer=setTimeout(abort,bounds.headersMs);
  const finish=()=>{if(done)return;done=true;clearTimeout(totalTimer);clearTimeout(headerTimer);request.signal.removeEventListener('abort',abort);};
  try {
    const upstream=await fetcher(reference.url,{method:request.method,redirect:'error',signal:controller.signal,headers:{'If-Match':reference.etag,'Accept-Encoding':'identity',...(range?{Range:`bytes=${start}-${start+length-1}`}:{})}});
    clearTimeout(headerTimer);controller.signal.throwIfAborted();
    const reject=async(message:string)=>{await upstream.body?.cancel().catch(()=>{});throw Error(message);};
    if(upstream.status===412){await upstream.body?.cancel().catch(()=>{});finish();return error(412,'Reference source changed');}
    if(upstream.status!==status)await reject('Origin status mismatch');
    if(upstream.headers.get('etag')!==reference.etag)await reject('Origin validator mismatch');
    if(!/^video\/mp4(?:;|$)/i.test(upstream.headers.get('content-type')??''))await reject('Origin MIME mismatch');
    const encoding=upstream.headers.get('content-encoding');if(encoding&&encoding!=='identity')await reject('Encoded reference representation');
    const declared=upstream.headers.get('content-length');
    if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)!==length))await reject('Origin length mismatch');
    if(range&&upstream.headers.get('content-range')!==`bytes ${start}-${start+length-1}/${reference.bytes}`)await reject('Origin range mismatch');
    if(!range&&upstream.headers.has('content-range'))await reject('Unexpected origin range');
    const headers=new Headers({...cors,'Content-Type':'video/mp4','Content-Length':String(length),'Accept-Ranges':'bytes','ETag':reference.etag,'X-Reference-Expected-SHA256':reference.sha256});
    if(range)headers.set('Content-Range',`bytes ${start}-${start+length-1}/${reference.bytes}`);
    if(request.method==='HEAD'){await upstream.body?.cancel().catch(()=>{});finish();return new Response(null,{status,headers});}
    if(!upstream.body)throw Error('Missing reference body');
    reader=upstream.body.getReader();let count=0;const digest=range?undefined:createHash('sha256');
    const body=new ReadableStream<Uint8Array>({
      async pull(output){
        try {
          controller.signal.throwIfAborted();const item=await reader!.read();controller.signal.throwIfAborted();
          if(item.done){if(count!==length)throw Error('Truncated reference');if(digest&&digest.digest('hex')!==reference.sha256)throw Error('Reference SHA mismatch');finish();output.close();return;}
          count+=item.value.byteLength;if(count>length)throw Error('Reference exceeds expected length');digest?.update(item.value);output.enqueue(item.value);
        }catch(error){controller.abort();void reader!.cancel(error).catch(()=>{});finish();output.error(error);}
      },
      cancel(reason){controller.abort();finish();return reader!.cancel(reason).catch(()=>{});}
    });
    return new Response(body,{status,headers});
  }catch{controller.abort();void reader?.cancel().catch(()=>{});finish();return error(502,'Reference unavailable or changed');}
}
