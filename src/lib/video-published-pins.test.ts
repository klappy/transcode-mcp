import {test,expect,beforeEach,afterEach,describe} from 'bun:test';
import {createHash} from 'node:crypto';
import {PUBLISHED_PINS,LEGACY_PINS,publishedPinFor,legacyPinFor,servePublishedVideoPin,markPublishedPinStale,clearPinVerification,type PublishedVideoIdentity} from './video-published-pins';
import {normalizeProxyPath,parseProxyPath} from './parse-proxy-path';
import {selectCatalogVideoContract,selectLazyVideoContract} from './video';
import worker from '../worker';

// Published identities (explicit-size + lazy outputs clients pin) are served from
// pinned bytes across container rebuilds; no verified identity -> normal path,
// X-Transcode-Pinned: stale. canon/planning/2026-10-06-published-identity-pins.md

const VIDEO='/video/preset=fia,q=medium,f=mp4';
const A13='https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4';
const A11='https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4';
const JORDAN='https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4';
const A13_XS=`${VIDEO},size=xsmall/${A13}`;
const collapse=(path:string)=>path.replace(/\/\//g,'/');
const sha256=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');

// Fixture tiers: different bytes under ONE shared key, like the real buckets.
const KEY='video-v1/'+'1'.repeat(64)+'.mp4';
const fill=(n:number,seed:number)=>new Uint8Array(n).map((_,i)=>(i*seed+3)&255);
const prodBytes=fill(1000,7),stagingBytes=fill(1001,11),devBytes=fill(999,13);
const ident=(tier:PublishedVideoIdentity['tier'],data:Uint8Array,keys=[KEY]):PublishedVideoIdentity=>({tier,bytes:data.length,sha256:sha256(data),keys});
const TIERS=[ident('production',prodBytes),ident('staging',stagingBytes),ident('development',devBytes)];

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
  return {bucket,calls,objects};
}
const req=(method='GET',range?:string,path=A13_XS)=>new Request('https://t'+path,{method,headers:range?{Range:range}:{}});
const logs:any[]=[];const log=(e:any)=>logs.push(e);
let realWarn:typeof console.warn,realError:typeof console.error;
beforeEach(()=>{clearPinVerification();logs.length=0;realWarn=console.warn;realError=console.error;console.warn=(s:string)=>logs.push(JSON.parse(s));console.error=()=>{};});
afterEach(()=>{console.warn=realWarn;console.error=realError;});

describe('published pin table',()=>{
  test('16 exact paths x 3 tier identities, frozen, in production/staging/development order',()=>{
    expect(Object.isFrozen(PUBLISHED_PINS)).toBe(true);
    const paths=Object.keys(PUBLISHED_PINS);
    expect(paths.length).toBe(16);
    const perTier:Record<string,number>={};
    for(const path of paths){
      const ids=PUBLISHED_PINS[path];
      expect(Object.isFrozen(ids)).toBe(true);
      expect(ids.map(p=>p.tier)).toEqual(['production','staging','development']);
      for(const p of ids){
        perTier[p.tier]=(perTier[p.tier]??0)+1;
        expect(Object.isFrozen(p)&&Object.isFrozen(p.keys)).toBe(true);
        expect(p.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(Number.isSafeInteger(p.bytes)&&p.bytes>0).toBe(true);
        expect(p.keys.length).toBeGreaterThan(0);
        for(const k of p.keys)expect(k).toMatch(/^video-v1\/[a-f0-9]{64}\.mp4$/);
      }
      // Tiers differ in bytes (x264 is not byte-deterministic), so size alone
      // already separates them before any hashing.
      expect(new Set(ids.map(p=>p.bytes)).size).toBe(3);
      expect(new Set(ids.map(p=>p.sha256)).size).toBe(3);
    }
    expect(perTier).toEqual({production:16,staging:16,development:16});
  });

  test('7 explicit-size catalog outputs + 9 lazy outputs, every path canonical and accepted',()=>{
    let catalog=0,lazy=0;
    for(const path of Object.keys(PUBLISHED_PINS)){
      expect(normalizeProxyPath(path)).toBe(path);
      const parsed=parseProxyPath(path,'');
      if(parsed.mediaType!=='video')throw Error('expected video');
      expect(parsed.options.size).toMatch(/^(xsmall|medium|xlarge)$/);
      expect(`${VIDEO},size=${parsed.options.size}/${parsed.sourceUrl}`).toBe(path);
      if(selectCatalogVideoContract(parsed.sourceUrl,parsed.options.size!))catalog++;
      else{expect(selectLazyVideoContract(parsed.sourceUrl,parsed.options.size!)).toBeDefined();lazy++;}
    }
    expect([catalog,lazy]).toEqual([7,9]);
  });

  test('inventory values are recorded exactly (digest guards every row)',()=>{
    const row=(path:string,tier:string)=>{const p=PUBLISHED_PINS[path].find(p=>p.tier===tier)!;return [p.bytes,p.sha256,...p.keys];};
    expect(row(A13_XS,'production')).toEqual([1825963,'9a00023c17b80834f382f2b73c1da49a8785a2fc338f058d77d48b020acd3e00','video-v1/60b9e628297f0636752b8107c0c54e77bcb79e2096199116dfab73a10ae9c3cb.mp4']);
    expect(row(`${VIDEO},size=xlarge/${JORDAN}`,'staging')).toEqual([7621623,'2fca7952b30a441060e0676b6e9bc993d25a7a0e86d7ae2271a5b62d80f7f446','video-v1/9c9ed32b0b7e29e985a48d9d8e82b8d481ba12d9db5da7686fef8df0b9f71aad.mp4']);
    // staging a11 xsmall matched by unique size (metadata SHA agrees).
    expect(row(`${VIDEO},size=xsmall/${A11}`,'staging')).toEqual([2610150,'96c4e5d143005339bc54026d7701a5eecc2b54593cabff989908c8cf17f42cdb','video-v1/5f5bd934e03ae546275348a146e5f6af61c6f1453683dbd626d5423f7cc38e51.mp4']);
    expect(row(`${VIDEO},size=xlarge/https://s3.amazonaws.com/cbbt-er.public/media/videos/a186/720p.mp4`,'development')).toEqual([8382176,'d775ad1eefefbed329cbe002e037f8ada13de5740714087dd0e1b1fa03e41651','video-v1/28171080fcb85c7bc05def515324a17d38a3687cca6ce1417aed3da56f23f326.mp4']);
    // Published identities never change: editing any row must update this digest on purpose.
    expect(sha256(JSON.stringify(PUBLISHED_PINS))).toBe('b401c0df3c9e36bbafa0f7b3f56641075cbac03f3f97804f3951a483f4a40f6c');
  });

  test('legacy alpha.13 pins and published pins never claim the same path',()=>{
    for(const path of Object.keys(PUBLISHED_PINS))expect(legacyPinFor(path,'')).toBeUndefined();
    for(const url of Object.keys(LEGACY_PINS))expect(publishedPinFor(`${VIDEO}/${url}`,'')).toBeUndefined();
  });
});

describe('publishedPinFor',()=>{
  test('only the exact listed path, with no query string',()=>{
    for(const path of Object.keys(PUBLISHED_PINS))expect(publishedPinFor(path,'')).toBe(PUBLISHED_PINS[path]);
    for(const path of [
      `/video/size=xsmall,preset=fia,q=medium,f=mp4/${A13}`, // other option order
      `/video/preset=fia,f=mp4,q=medium,size=xsmall/${A13}`,
      `${VIDEO}/${A13}`,                                      // omitted size (legacy)
      `${VIDEO},size=large/${A13}`,
      `${VIDEO},size=small/${A13}`,                           // unlisted size
      `${VIDEO},size=small/${A11}`,
      `${VIDEO},size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a99/720p.mp4`,
      'constructor','__proto__',`${VIDEO},size=xsmall/constructor`,
    ])expect(publishedPinFor(path,'')).toBeUndefined();
    expect(publishedPinFor(A13_XS,'?v=1')).toBeUndefined();
  });

  test('collapsed https:/ form of every published path is pinned after normalization',()=>{
    for(const path of Object.keys(PUBLISHED_PINS)){
      const collapsed=collapse(path);
      expect(collapsed).toContain('/https:/');
      expect(collapsed).not.toBe(path);
      expect(publishedPinFor(normalizeProxyPath(collapsed),'')).toBe(PUBLISHED_PINS[path]);
    }
  });
});

describe('servePublishedVideoPin',()=>{
  test('serves the matching key with exact bytes, pinned ETag and HIT headers; never writes',async()=>{
    const {bucket,calls}=r2({[KEY]:{data:prodBytes,etag:'p1',customMetadata:{sha256:TIERS[0].sha256,width:'426',height:'240'}}});
    const r=(await servePublishedVideoPin(req(),bucket,TIERS,log))!;
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(prodBytes);
    expect(r.headers.get('ETag')).toBe(`"${TIERS[0].sha256}"`);
    expect(r.headers.get('X-Transcode-Pinned')).toBe('published');
    expect(r.headers.get('X-Transcode-Cache')).toBe('HIT');
    expect(r.headers.get('X-Transcode-Encode')).toBe('h264');
    expect(r.headers.get('Content-Type')).toBe('video/mp4');
    expect(r.headers.get('Content-Length')).toBe('1000');
    expect(r.headers.get('Accept-Ranges')).toBe('bytes');
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    expect(r.headers.get('X-Transcode-Video-Width')).toBe('426');
    expect(r.headers.get('X-Transcode-Video-Height')).toBe('240');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Expose-Headers')).toContain('X-Transcode-Pinned');
    expect(calls).toEqual(['head '+KEY,'get '+KEY,'get '+KEY]);
    // Verification is memoized per key + etag + identity: the next serve does not re-hash.
    calls.length=0;
    await (await servePublishedVideoPin(req(),bucket,TIERS,log))!.arrayBuffer();
    expect(calls).toEqual(['head '+KEY,'get '+KEY]);
    expect(logs).toEqual([]);
  });

  test('Range, HEAD and 416 on the pinned identity',async()=>{
    const {bucket,calls}=r2({[KEY]:{data:prodBytes,etag:'p1'}});
    for(const [h,off,len] of [['bytes=0-9',0,10],['bytes=990-',990,10],['bytes=-5',995,5],['bytes=500-5000',500,500]] as const){
      const r=(await servePublishedVideoPin(req('GET',h),bucket,TIERS,log))!;
      expect(r.status).toBe(206);
      expect(r.headers.get('Content-Range')).toBe(`bytes ${off}-${off+len-1}/1000`);
      expect(r.headers.get('Content-Length')).toBe(String(len));
      expect(r.headers.get('ETag')).toBe(`"${TIERS[0].sha256}"`);
      expect(new Uint8Array(await r.arrayBuffer())).toEqual(prodBytes.slice(off,off+len));
    }
    expect(calls.at(-1)).toBe(`get ${KEY} 500+500`);
    const head=(await servePublishedVideoPin(req('HEAD'),bucket,TIERS,log))!;
    expect(head.status).toBe(200);expect(head.body).toBeNull();
    expect(head.headers.get('Content-Length')).toBe('1000');expect(head.headers.get('ETag')).toBe(`"${TIERS[0].sha256}"`);expect(head.headers.get('X-Transcode-Pinned')).toBe('published');
    const headRange=(await servePublishedVideoPin(req('HEAD','bytes=0-0'),bucket,TIERS,log))!;
    expect(headRange.status).toBe(206);expect(headRange.headers.get('Content-Range')).toBe('bytes 0-0/1000');
    const bad=(await servePublishedVideoPin(req('GET','bytes=1000-'),bucket,TIERS,log))!;
    expect(bad.status).toBe(416);expect(bad.headers.get('Content-Range')).toBe('bytes */1000');expect(bad.headers.get('X-Transcode-Pinned')).toBe('published');
    for(const method of ['POST','OPTIONS'])expect(await servePublishedVideoPin(req(method),bucket,TIERS,log)).toBeNull();
    expect(await servePublishedVideoPin(req(),undefined,TIERS,log)).toBeNull();
    expect(await servePublishedVideoPin(req(),bucket,undefined,log)).toBeNull();
    expect(await servePublishedVideoPin(req(),bucket,[],log)).toBeNull();
  });

  test('tier list: a bucket holding only one tier\'s object serves that tier\'s identity',async()=>{
    for(const [index,data] of [[0,prodBytes],[1,stagingBytes],[2,devBytes]] as const){
      clearPinVerification();
      const {bucket,calls}=r2({[KEY]:{data,etag:'t'+index,customMetadata:{sha256:TIERS[index].sha256}}});
      const r=(await servePublishedVideoPin(req(),bucket,TIERS,log))!;
      expect(r.status).toBe(200);
      expect(r.headers.get('ETag')).toBe(`"${TIERS[index].sha256}"`);
      expect(r.headers.get('Content-Length')).toBe(String(data.length));
      expect(new Uint8Array(await r.arrayBuffer())).toEqual(data);
      // One HEAD for the shared key across all three identities, one hash, one serve.
      expect(calls).toEqual(['head '+KEY,'get '+KEY,'get '+KEY]);
    }
    // Staging bytes under the key, no metadata claim: still the staging identity.
    clearPinVerification();
    const r=(await servePublishedVideoPin(req(),r2({[KEY]:{data:stagingBytes,etag:'s'}}).bucket,TIERS,log))!;
    expect(r.headers.get('ETag')).toBe(`"${TIERS[1].sha256}"`);
    // Later candidate keys of an identity are tried after earlier ones.
    clearPinVerification();
    const two=[ident('production',prodBytes,['video-v1/missing.mp4',KEY])];
    const s=(await servePublishedVideoPin(req(),r2({[KEY]:{data:prodBytes,etag:'k'}}).bucket,two,log))!;
    expect(new Uint8Array(await s.arrayBuffer())).toEqual(prodBytes);
  });

  test('wrong bytes under a listed key are rejected',async()=>{
    const wrong=prodBytes.slice();wrong[500]^=1;
    // same size, no metadata claim: rejected by the streamed hash
    expect(await servePublishedVideoPin(req(),r2({[KEY]:{data:wrong,etag:'w1'}}).bucket,TIERS,log)).toBeNull();
    // metadata that claims the pinned hash is not trusted
    expect(await servePublishedVideoPin(req(),r2({[KEY]:{data:wrong,etag:'w2',customMetadata:{sha256:TIERS[0].sha256}}}).bucket,TIERS,log)).toBeNull();
    // right bytes but metadata naming another hash (a different encode) is not served
    expect(await servePublishedVideoPin(req(),r2({[KEY]:{data:prodBytes,etag:'w3',customMetadata:{sha256:'0'.repeat(64)}}}).bucket,TIERS,log)).toBeNull();
    // a re-encode of a different size (what a rebuild writes) matches no identity
    expect(await servePublishedVideoPin(req(),r2({[KEY]:{data:fill(1234,5),etag:'w4'}}).bucket,TIERS,log)).toBeNull();
    // nothing under the key
    expect(await servePublishedVideoPin(req(),r2({}).bucket,TIERS,log)).toBeNull();
  });

  test('a verified object later replaced is re-verified; one identity never vouches for another',async()=>{
    const {bucket,objects}=r2({[KEY]:{data:prodBytes,etag:'e1'}});
    await (await servePublishedVideoPin(req(),bucket,TIERS,log))!.arrayBuffer();
    const wrong=prodBytes.slice();wrong[0]^=1;objects[KEY]={data:wrong,etag:'e2'};
    expect(await servePublishedVideoPin(req(),bucket,TIERS,log)).toBeNull();
    // Same size, different identity, same object/etag as a verified one: must hash, and fail.
    clearPinVerification();
    objects[KEY]={data:prodBytes,etag:'e3'};
    await (await servePublishedVideoPin(req(),bucket,TIERS,log))!.arrayBuffer();
    const impostor=[{tier:'production' as const,bytes:prodBytes.length,sha256:'f'.repeat(64),keys:[KEY]}];
    expect(await servePublishedVideoPin(req(),bucket,impostor,log)).toBeNull();
  });

  test('a storage error falls through (null) with a structured error log',async()=>{
    const bucket={head:async()=>{throw Error('r2 down');}} as unknown as R2Bucket;
    expect(await servePublishedVideoPin(req(),bucket,TIERS,log)).toBeNull();
    expect(logs).toEqual([{event:'published-video-pin-error',sha256:TIERS.map(p=>p.sha256),error:'Error: r2 down'}]);
  });
});

describe('markPublishedPinStale',()=>{
  test('keeps status, body and headers; adds stale and exposes it; logs one warning',async()=>{
    const upstream=new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Content-Length, ETag','ETag':'"abc"','X-Transcode-Cache':'MISS','Content-Range':'bytes 0-2/9'}});
    const r=markPublishedPinStale(upstream,A13_XS,TIERS,log);
    expect(r.status).toBe(206);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
    expect(r.headers.get('X-Transcode-Pinned')).toBe('stale');
    expect(r.headers.get('Access-Control-Expose-Headers')).toBe('Content-Length, ETag, X-Transcode-Pinned');
    expect(r.headers.get('ETag')).toBe('"abc"');expect(r.headers.get('Content-Range')).toBe('bytes 0-2/9');
    expect(logs).toEqual([{event:'published-video-pin-stale',level:'warn',path:A13_XS,status:206,etag:'"abc"',cache:'MISS',pinned:TIERS.map(p=>`${p.tier}:${p.sha256}`),keys:[KEY]}]);
    // Expose list already naming it is left alone; no expose list is left for ensureCors.
    const again=markPublishedPinStale(new Response('x',{headers:{'Access-Control-Expose-Headers':'x-transcode-pinned'}}),A13_XS,TIERS,log);
    expect(again.headers.get('Access-Control-Expose-Headers')).toBe('x-transcode-pinned');
    expect(markPublishedPinStale(new Response('x'),A13_XS,TIERS,log).headers.get('Access-Control-Expose-Headers')).toBeNull();
  });
});

describe('worker',()=>{
  const ctx={waitUntil(){},passThroughOnException(){}} as unknown as ExecutionContext;
  const realKey=PUBLISHED_PINS[A13_XS][0].keys[0];
  const containerEnv=(bucket:R2Bucket|undefined)=>{
    const seen:Request[]=[];
    const stub={fetch:async(r:Request)=>{seen.push(r);return new Response(r.method==='HEAD'?null:new Uint8Array([9,9,9,9]),{status:r.headers.get('Range')?206:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Content-Length, ETag, X-Transcode-Cache','ETag':'"'+'e'.repeat(64)+'"','X-Transcode-Cache':'MISS','Content-Type':'video/mp4'}});}};
    return {env:{AUDIO_BUCKET:bucket,AUDIO_CONTAINER:{idFromName:(n:string)=>n,get:()=>stub}} as any,seen};
  };

  test('no verified identity: the normal path is served, marked stale, with a warning; R2 untouched by the pin',async()=>{
    // The tier's bucket holds a rebuild's re-encode under the published key: wrong bytes.
    const {bucket,calls}=r2({[realKey]:{data:fill(64,3),etag:'rebuild',customMetadata:{sha256:'e'.repeat(64)}}});
    const {env,seen}=containerEnv(bucket);
    const r=await worker.fetch(new Request('https://t'+A13_XS,{headers:{Range:'bytes=0-3'}}),env,ctx);
    expect(r.status).toBe(206);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([9,9,9,9]));
    expect(r.headers.get('X-Transcode-Pinned')).toBe('stale');
    expect(r.headers.get('ETag')).toBe('"'+'e'.repeat(64)+'"');
    expect(r.headers.get('X-Transcode-Cache')).toBe('MISS');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Expose-Headers')).toBe('Content-Length, ETag, X-Transcode-Cache, X-Transcode-Pinned');
    // The normal path got the client's method and Range, unchanged.
    expect(seen.length).toBe(1);expect(seen[0].method).toBe('GET');expect(seen[0].headers.get('Range')).toBe('bytes=0-3');
    const target=new URL(seen[0].url);
    expect([target.pathname,target.searchParams.get('source'),target.searchParams.get('size')]).toEqual(['/video-delivery',A13,'xsmall']);
    // One HEAD of the shared key; metadata already rules out every tier, no hashing.
    expect(calls).toEqual(['head '+realKey]);
    expect(logs.map(e=>[e.event,e.path,e.status])).toEqual([['published-video-pin-stale',A13_XS,206]]);
    // HEAD and a missing bucket are stale too.
    const head=await worker.fetch(new Request('https://t'+A13_XS,{method:'HEAD'}),env,ctx);
    expect([head.status,head.headers.get('X-Transcode-Pinned')]).toEqual([200,'stale']);
    const noBucket=containerEnv(undefined);
    const nb=await worker.fetch(new Request('https://t'+A13_XS),noBucket.env,ctx);
    expect([nb.status,nb.headers.get('X-Transcode-Pinned')]).toEqual([200,'stale']);
    // No container binding: the 503 is still the normal path's answer, marked stale.
    const down=await worker.fetch(new Request('https://t'+A13_XS),{AUDIO_BUCKET:bucket} as any,ctx);
    expect([down.status,down.headers.get('X-Transcode-Pinned'),await down.text()]).toEqual([503,'stale','Video service unavailable']);
  });

  test('unlisted URLs and other option orders are unaffected: no pin lookup, no header',async()=>{
    const {bucket,calls}=r2({});
    const {env,seen}=containerEnv(bucket);
    for(const path of [`${VIDEO},size=small/${A13}`,`/video/size=xsmall,preset=fia,q=medium,f=mp4/${A13}`,`${VIDEO},size=large/${A11}`,`${VIDEO},size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a99/720p.mp4`]){
      const r=await worker.fetch(new Request('https://t'+path,{headers:{Range:'bytes=0-1'}}),env,ctx);
      expect([path,r.status,r.headers.get('X-Transcode-Pinned')]).toEqual([path,206,null]);
      expect(r.headers.get('Access-Control-Expose-Headers')).toBe('Content-Length, ETag, X-Transcode-Cache');
    }
    expect(seen.length).toBe(4);
    expect(calls).toEqual([]);
    expect(logs).toEqual([]);
  });

  test('collapsed https:/ form of a published path takes the same pinned path as the canonical one',async()=>{
    for(const path of [A13_XS,`${VIDEO},size=xlarge/${JORDAN}`,`${VIDEO},size=medium/${A11}`]){
      const results=[];
      for(const form of [path,collapse(path)]){
        const {bucket,calls}=r2({});
        const {env,seen}=containerEnv(bucket);
        const r=await worker.fetch(new Request('https://t'+form),env,ctx);
        results.push({status:r.status,headers:[...r.headers],body:await r.text(),calls,seen:seen.map(s=>s.url)});
      }
      expect(results[0].headers.find(([k])=>k==='x-transcode-pinned')?.[1]).toBe('stale');
      expect(results[0].calls).toEqual([...new Set(PUBLISHED_PINS[path].flatMap(p=>p.keys))].map(k=>'head '+k));
      expect(results[1]).toEqual(results[0]);
    }
    expect(logs.length).toBe(6);
  });

  test('collapsed form serves the pinned bytes when an identity verifies',async()=>{
    // Same lookup the Worker runs (normalize at entry, then exact path), with a
    // fixture table standing in for bytes we cannot reproduce here.
    const table=Object.freeze({[A13_XS]:Object.freeze(TIERS)});
    const ids=publishedPinFor(normalizeProxyPath(collapse(A13_XS)),'',table);
    expect(ids).toBe(table[A13_XS]);
    const {bucket}=r2({[KEY]:{data:devBytes,etag:'d'}});
    const r=(await servePublishedVideoPin(req('GET',undefined,collapse(A13_XS)),bucket,ids,log))!;
    expect(r.headers.get('X-Transcode-Pinned')).toBe('published');
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(devBytes);
  });
});
