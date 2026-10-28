import {test,expect} from 'bun:test';
import {DEMO_VIDEO_HTML} from './demo-video';

// Execute the emitted page script with an event-driven DOM stand-in. Fetch is
// observed, never the real proxy: these tests must not start encoder jobs.
function page(respond:(url:string,options:RequestInit)=>Promise<Response>){
 class Element {
  id='';className='';innerHTML='';textContent='';value='';disabled=false;src='';poster='';
  listeners=new Map<string,Function>();children:Element[]=[];selected=new Map<string,Element>();
  addEventListener(name:string,fn:Function){this.listeners.set(name,fn)}
  querySelector(name:string){if(!this.selected.has(name))this.selected.set(name,new Element());return this.selected.get(name)!}
  append(node:Element){this.children.push(node)}
  pause(){} load(){} removeAttribute(name:string){if(name==='src')this.src=''}
  playPromise:Promise<void>|undefined;
  play(){this.listeners.get('play')?.();return this.playPromise||Promise.resolve()}
 }
 const nodes=new Map<string,Element>();
 const get=(id:string)=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)!};
 get('live-source').value='https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4';get('live-size').value='large';get('minutes').value='60';
 const document={getElementById:get,createElement:()=>new Element()};
 const requests:Array<{url:string,options:RequestInit}>=[];
 const fetch=async(url:string,options:RequestInit)=>{requests.push({url,options});return respond(url,options)};
 const js=DEMO_VIDEO_HTML.match(/<script>([\s\S]*?)<\/script>/)![1];
 new Function('document','fetch','performance',js)(document,fetch,{now:()=>1000});
 return {get,requests,submit:()=>get('live-form').listeners.get('submit')!({preventDefault(){}}),nodes};
}
const ready=()=>new Response('x',{status:206,headers:{'Content-Range':'bytes 0-0/7598950','Content-Length':'1','X-Transcode-Cache':'MISS','X-Transcode-Video-Width':'1280','X-Transcode-Video-Height':'720'}});

test('initial render requests no videos; explicit Play prepares only selected live URL with explicit Large',async()=>{
 let release!:(r:Response)=>void;
 const p=page(()=>new Promise(resolve=>{release=resolve}));
 expect(p.requests).toHaveLength(0);expect(p.get('live-video').src).toBe('');
 for(const id of ['detail-pair','small-pair','balanced-player'])for(const card of p.get(id).children)expect(card.querySelector('video').src).toBe('');
 const pending=p.submit();expect(p.requests).toHaveLength(1);expect(p.get('live-status').textContent).toContain('Preparing');expect(p.get('live-play').disabled).toBe(true);
 expect(p.requests[0]).toMatchObject({url:'/video/preset=fia,q=medium,f=mp4,size=large/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4',options:{headers:{Range:'bytes=0-0'}}});
 await p.submit();expect(p.requests).toHaveLength(1);
 release(ready());await pending;
 expect(p.get('live-video').src).toBe(p.requests[0].url);expect(p.get('live-measurements').textContent).toContain('7.60 MB');expect(p.get('live-measurements').textContent).toContain('Proxy cache: MISS');expect(p.get('live-measurements').textContent).toContain('1280 × 720');expect(p.get('live-measurements').textContent).toContain('not encode time');expect(p.get('live-play').disabled).toBe(false);
});

test('busy response leaves manual Retry and no media source; retry uses the selected URL and size',async()=>{
 let attempt=0;const p=page(async()=>++attempt===1?new Response('busy',{status:503}):ready());
 p.get('live-source').value='https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4';p.get('live-size').value='medium';
 await p.submit();expect(p.requests).toHaveLength(1);expect(p.get('live-video').src).toBe('');expect(p.get('live-play').textContent).toContain('Retry');expect(p.get('live-status').textContent).toContain('503');expect(p.get('live-play').disabled).toBe(false);
 await p.submit();expect(p.requests).toHaveLength(2);expect(p.requests[1].url).toBe('/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4');expect(p.get('live-video').src).toBe(p.requests[1].url);
});

test('invalid source does not issue a request',async()=>{
 const p=page(async()=>ready());p.get('live-source').value='https://user:pass@example.test/v.mp4';await p.submit();expect(p.requests).toHaveLength(0);expect(p.get('live-status').textContent).toContain('canonical HTTPS');
});


test('pending native playback cannot lock the preparation form or Retry',async()=>{
 const p=page(async()=>ready());p.get('live-video').playPromise=new Promise(()=>{});
 await p.submit();expect(p.get('live-play').disabled).toBe(false);expect(p.get('live-source').disabled).toBe(false);expect(p.get('live-size').disabled).toBe(false);
 p.get('live-video').listeners.get('error')!();expect(p.get('live-play').textContent).toContain('Retry');
 await p.submit();expect(p.requests).toHaveLength(2);expect(p.get('live-play').disabled).toBe(false);
});
