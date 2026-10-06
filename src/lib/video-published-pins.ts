import {createHash} from "node:crypto";
import {byteRange} from './video';
// Published identities are served from pinned bytes, never re-derived from the
// current encoder identity. Anything a client may pin (a URL handed to an app,
// a hash recorded by a client) is served from retained R2 bytes whose size and
// streamed SHA-256 equal the pin. Container rebuilds may change cache keys and
// x264 output; they must not change what a published URL returns.
// Canon: canon/planning/2026-10-05-legacy-video-pins.md (alpha.13),
//        canon/planning/2026-10-06-published-identity-pins.md (published pins).
export type VideoPinIdentity={readonly bytes:number;readonly sha256:string;readonly keys:readonly string[]};
export type LegacyVideoPin=VideoPinIdentity;
export type PublishedPinTier='production'|'staging'|'development';
export type PublishedVideoIdentity=VideoPinIdentity&{readonly tier:PublishedPinTier};
type Log=(event:Record<string,unknown>)=>void;
const logError:Log=e=>console.error(JSON.stringify(e));
const logWarn:Log=e=>console.warn(JSON.stringify(e));

// ---- Legacy alpha.13 pins (fail-closed) ------------------------------------
// FIA alpha.13 pins the exact bytes of these omitted-size (Large) URLs; a recipe
// change (#99, fia-video@4 -> @5) must not change them.
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

// ---- Published pins (fail-open: stale) -------------------------------------
// Exact canonical request path (after normalizeProxyPath; no search) -> the
// identities that path has served, one per tier, tried in order. The 7
// explicit-size outputs handed to the FIA app and the 9 lazy Mark 1:14-28
// outputs, as inventoried from each tier's R2 bucket on 2026-10-06. Every
// tier encoded under the same cache key, but x264 output is not byte-
// deterministic, so each tier's bucket holds different bytes under that key;
// only the identity whose size and streamed SHA-256 verify is served.
export const PUBLISHED_PIN_LABEL='published';
export const STALE_PIN_LABEL='stale';
const identities=(...rows:[PublishedPinTier,number,string,string[]][]):readonly PublishedVideoIdentity[]=>Object.freeze(rows.map(([tier,bytes,sha256,keys])=>Object.freeze({tier,bytes,sha256,keys:Object.freeze([...keys])})));
export const PUBLISHED_PINS:Readonly<Record<string,readonly PublishedVideoIdentity[]>>=Object.freeze({
  '/video/preset=fia,q=medium,f=mp4,size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4':identities(
    ['production',1825963,'9a00023c17b80834f382f2b73c1da49a8785a2fc338f058d77d48b020acd3e00',['video-v1/60b9e628297f0636752b8107c0c54e77bcb79e2096199116dfab73a10ae9c3cb.mp4']],
    ['staging',1825915,'0634fc94754a30415d70e19909398952e028a7cc8dcc56b74c2ca6a78484fae4',['video-v1/60b9e628297f0636752b8107c0c54e77bcb79e2096199116dfab73a10ae9c3cb.mp4']],
    ['development',1825666,'51343ffb8add325629453eb5e0c26d1da143f592b4a129997e405c50a911e97a',['video-v1/60b9e628297f0636752b8107c0c54e77bcb79e2096199116dfab73a10ae9c3cb.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a13/720p.mp4':identities(
    ['production',4385951,'c7e608dbb378fbc59160a86e76f60d1a51c1dde25f194fb627ae2e1aa1bc1639',['video-v1/1da7bd6d65ff942941199180f7a7d18c6c6fa9ab5b3623f8d8c378307ecf266b.mp4']],
    ['staging',4386185,'ed5ac172f406484c054e1069ccbc9ee111c186f6f30b192d8de023b5eae8ddc2',['video-v1/1da7bd6d65ff942941199180f7a7d18c6c6fa9ab5b3623f8d8c378307ecf266b.mp4']],
    ['development',4385776,'6bc3a930e60089adf32dbda47f617ca95ef44a5f1625a995ad6d30f19a6de5ce',['video-v1/1da7bd6d65ff942941199180f7a7d18c6c6fa9ab5b3623f8d8c378307ecf266b.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xlarge/https://pub-27b708e1b3d94fe2ac53247a87bb142a.r2.dev/sha256/c7feeb3988378d759ed82a13e801ad77db7e3e09df2a121ea70ebecaa192a9b4.mp4':identities(
    ['production',7621339,'8629d21241afef8472ff7cc94d8ed74ba25c6fc41ff205a5d97d8e076f6088fc',['video-v1/9c9ed32b0b7e29e985a48d9d8e82b8d481ba12d9db5da7686fef8df0b9f71aad.mp4']],
    ['staging',7621623,'2fca7952b30a441060e0676b6e9bc993d25a7a0e86d7ae2271a5b62d80f7f446',['video-v1/9c9ed32b0b7e29e985a48d9d8e82b8d481ba12d9db5da7686fef8df0b9f71aad.mp4']],
    ['development',7622295,'29dffddac6d80d1820e7d3bdad2f4f7dadbdcc0ffe73bb2d9673e15c9c25f48a',['video-v1/9c9ed32b0b7e29e985a48d9d8e82b8d481ba12d9db5da7686fef8df0b9f71aad.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4':identities(
    ['production',1297064,'63f1f4f49734af8d6efced2af949328fbb4ef8e8171a98f0360b0005dad9e38a',['video-v1/75e981bcdb9b266852b2c637b62ffb58f04841786f6ebc2eadb08242f6391c51.mp4']],
    ['staging',1297652,'735a6b6100c3d6900b21754eee6938716a052b5ba97faf10b07b21e8f22b1f57',['video-v1/75e981bcdb9b266852b2c637b62ffb58f04841786f6ebc2eadb08242f6391c51.mp4']],
    ['development',1297125,'045486b8f86a8c658431beb4c1ea6fa60dedaba25d61ec311c4ea1f8f46d007f',['video-v1/75e981bcdb9b266852b2c637b62ffb58f04841786f6ebc2eadb08242f6391c51.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a184/720p.mp4':identities(
    ['production',3120718,'0bb3b22b7c7a43f2613a8f5efb613627cc099e2548d5a67aaa023a37028b38b4',['video-v1/362db6d93d9dcda9b618f6e9b8def62dc387f0ef364808b19f9e0e8c59d7057e.mp4']],
    ['staging',3118931,'e90fb2afa77f8555bafe789b15a06467b0a99446fb041cfb9b72b1355e800642',['video-v1/362db6d93d9dcda9b618f6e9b8def62dc387f0ef364808b19f9e0e8c59d7057e.mp4']],
    ['development',3119794,'e9a7e2c5da2fda6b539af38ad1f7184a31dbe7ef2c23bf4c185a6b0ee93924f9',['video-v1/362db6d93d9dcda9b618f6e9b8def62dc387f0ef364808b19f9e0e8c59d7057e.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4':identities(
    ['production',1282995,'b91107cf359340705a048445ae70ce529a9a351b91040f37ffe472aaf25a9b48',['video-v1/4f416e22cf83c069f151441ff3773753cad5274d4b7d702461d4ddd0087e77f7.mp4']],
    ['staging',1282711,'22f4616d871e03039f6711eb85028f7815c3cecd75e49dbd0020bae8230c18c6',['video-v1/4f416e22cf83c069f151441ff3773753cad5274d4b7d702461d4ddd0087e77f7.mp4']],
    ['development',1282940,'4939e7237b5fa6ee9c112e2ca7bb4dd9fae70e1c265da751837fa47ddf7c3e44',['video-v1/4f416e22cf83c069f151441ff3773753cad5274d4b7d702461d4ddd0087e77f7.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a10/720p.mp4':identities(
    ['production',3065386,'ae3c789384b7cb685f2a7da215e7c8319cb887ebf1b3fcf2e0d9d2dae29717b8',['video-v1/70ab548dde57f7d235850d29281983c75cd5e38dd5d563ec2cf654ac801dfff9.mp4']],
    ['staging',3066348,'8d677f0397bbcd1dcd0bb7203e9aef0ccb4ce9fbb0216d74e4bb96c43650a19e',['video-v1/70ab548dde57f7d235850d29281983c75cd5e38dd5d563ec2cf654ac801dfff9.mp4']],
    ['development',3065997,'4fd5334402efe6b4281064698908bc59eac216daf0377fdd5a6a797663466134',['video-v1/70ab548dde57f7d235850d29281983c75cd5e38dd5d563ec2cf654ac801dfff9.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4':identities(
    ['production',2610219,'941d927779b367f2f7326352c6e3a464c721ebd876c3c577e53b91af6e9bc807',['video-v1/5f5bd934e03ae546275348a146e5f6af61c6f1453683dbd626d5423f7cc38e51.mp4']],
    ['staging',2610150,'96c4e5d143005339bc54026d7701a5eecc2b54593cabff989908c8cf17f42cdb',['video-v1/5f5bd934e03ae546275348a146e5f6af61c6f1453683dbd626d5423f7cc38e51.mp4']],
    ['development',2609833,'98e3175b7f15d8a249b79bdd5041d2d5f7e9d532c712a1d21c2cad1001b8df32',['video-v1/5f5bd934e03ae546275348a146e5f6af61c6f1453683dbd626d5423f7cc38e51.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4':identities(
    ['production',6281441,'8c496f8b1deb3475fffcd29826a753e408d96d8c24cab8aa1c581807dee51a99',['video-v1/359a1321778aaf211b3d5af585973cb49ab27cb65254d73e4127e60020bac1d3.mp4']],
    ['staging',6281011,'d3491f6b4cd68d4b399b51549fad2003404a34b00a524badb1ee5b9809174a49',['video-v1/359a1321778aaf211b3d5af585973cb49ab27cb65254d73e4127e60020bac1d3.mp4']],
    ['development',6281414,'b80207a606ca8595a62247c28819baa945cb50de476c633968c96e218161a936',['video-v1/359a1321778aaf211b3d5af585973cb49ab27cb65254d73e4127e60020bac1d3.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xlarge/https://s3.amazonaws.com/cbbt-er.public/media/videos/a11/720p.mp4':identities(
    ['production',10885460,'84c124964464babf6398b62dfde0195be26d1c79f153f550b3cf2714618390ed',['video-v1/317b5ec9ab4f7cae0c37821aa73f38cacce344c4d6381c82fa29d8d1b4d35993.mp4']],
    ['staging',10885365,'d07b838b96b99c7e1a19fead996c1c095ba54bef7ff51dd404165fa05334bb3b',['video-v1/317b5ec9ab4f7cae0c37821aa73f38cacce344c4d6381c82fa29d8d1b4d35993.mp4']],
    ['development',10886347,'cfc1ce9ed46b59a3bbbdc5d814bf560e0d497baa4fe6e1b7454ebeafda94850e',['video-v1/317b5ec9ab4f7cae0c37821aa73f38cacce344c4d6381c82fa29d8d1b4d35993.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a19/720p.mp4':identities(
    ['production',1904335,'c178c8e50a3d5a09bc606303c71e78cba4995ff175abc7ad45aaaba0795ab59b',['video-v1/9f3e1130e2432d27393aafb522826b8c153734c1978c017658e6aae1d8d0897e.mp4']],
    ['staging',1904515,'d6dc99e5a560773614575032e51264c5e537b12828e077123d9115648c9515b5',['video-v1/9f3e1130e2432d27393aafb522826b8c153734c1978c017658e6aae1d8d0897e.mp4']],
    ['development',1904327,'f544a4f87a9293144f6e155f296850ab98b7add4f21ad0c71d2a6e7e02dd2ec6',['video-v1/9f3e1130e2432d27393aafb522826b8c153734c1978c017658e6aae1d8d0897e.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a19/720p.mp4':identities(
    ['production',4533220,'b5fd1afd2d1f9139662925f39c1a4571202e45e56a7112f59d9eee7107cc7e87',['video-v1/b5489aff1597aa0e942a950a80db428f844679cd7ff0fca681d6334c12e4cf9d.mp4']],
    ['staging',4533150,'a4efeecc8b1a9081aee5e8bf8339cfbf0e4b63ea8af90a07aa1d9fb389db3a11',['video-v1/b5489aff1597aa0e942a950a80db428f844679cd7ff0fca681d6334c12e4cf9d.mp4']],
    ['development',4532493,'e82d6b60ed5facba3c3227d35c360442dbd7d5cefb3304b7dcfe19e2317f43a6',['video-v1/b5489aff1597aa0e942a950a80db428f844679cd7ff0fca681d6334c12e4cf9d.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xlarge/https://s3.amazonaws.com/cbbt-er.public/media/videos/a19/720p.mp4':identities(
    ['production',7857222,'ad7771206144e6eca46d38c92ab42a1af83389e334861c3bb479e3c9df88aa60',['video-v1/03ea4d7104218aca86122aa4cc642d4e199b08b2348b9cf955820388ed4f4310.mp4']],
    ['staging',7856670,'0f7426b748b199684577628cf3f9aa43ade01e5c04298a7814f833a3b2708748',['video-v1/03ea4d7104218aca86122aa4cc642d4e199b08b2348b9cf955820388ed4f4310.mp4']],
    ['development',7857110,'fc2b4a9b6269945b53aa393da2e5f49815e5c7907a870982115a1d0a3353d3b4',['video-v1/03ea4d7104218aca86122aa4cc642d4e199b08b2348b9cf955820388ed4f4310.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xsmall/https://s3.amazonaws.com/cbbt-er.public/media/videos/a186/720p.mp4':identities(
    ['production',2002846,'d5bdcf1c707560ff893122ae75096f308d4c5c96c3c264c8c6f9d10dc5798c21',['video-v1/b61970a0744a68dc9a3d4bb783d61e51aa9fca89cf73f6aa8b8b7a5af95fde5d.mp4']],
    ['staging',2002500,'52b7caf870dc55d5ba09572cd27c4679ad4097336e9b7b7cb92ecbb18324edf1',['video-v1/b61970a0744a68dc9a3d4bb783d61e51aa9fca89cf73f6aa8b8b7a5af95fde5d.mp4']],
    ['development',2002562,'064357aa18aa34e8376b630d9cc755c771e9114b5863a05207bfe10ad6ed7c09',['video-v1/b61970a0744a68dc9a3d4bb783d61e51aa9fca89cf73f6aa8b8b7a5af95fde5d.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=medium/https://s3.amazonaws.com/cbbt-er.public/media/videos/a186/720p.mp4':identities(
    ['production',4824193,'5261ecac8d121c0d8a94de8e6e8c734338bb735c8017ce8342806bef66ef7657',['video-v1/1b6c6bf12bf0456840af50679bdfdf11eacf9911267a4835d5f69804b80465bc.mp4']],
    ['staging',4824313,'1ac51e2bc67019a0b52d0ec5f566a4dbc2249fe0641bb910d9215b1939f20490',['video-v1/1b6c6bf12bf0456840af50679bdfdf11eacf9911267a4835d5f69804b80465bc.mp4']],
    ['development',4824071,'478dbca25e1b293498ee865ba7b745b4a5cd9a17d15b0bb585c0d32dc441bb1d',['video-v1/1b6c6bf12bf0456840af50679bdfdf11eacf9911267a4835d5f69804b80465bc.mp4']]),
  '/video/preset=fia,q=medium,f=mp4,size=xlarge/https://s3.amazonaws.com/cbbt-er.public/media/videos/a186/720p.mp4':identities(
    ['production',8383012,'5a7bb7caf952124e4e705b0970525828961154447d77b41761e5f8ec3187f103',['video-v1/28171080fcb85c7bc05def515324a17d38a3687cca6ce1417aed3da56f23f326.mp4']],
    ['staging',8382328,'bb35d44c4e3c2e83bb477d3a57bf39e1496aacf0cab2cd392d93f8917b80e1b7',['video-v1/28171080fcb85c7bc05def515324a17d38a3687cca6ce1417aed3da56f23f326.mp4']],
    ['development',8382176,'d775ad1eefefbed329cbe002e037f8ada13de5740714087dd0e1b1fa03e41651',['video-v1/28171080fcb85c7bc05def515324a17d38a3687cca6ce1417aed3da56f23f326.mp4']]),
});
// Exact listed paths only: other option orders, omitted size, a query string or
// an unlisted source are not pinned. Collapsed https:/ paths reach this through
// the Worker's entry normalization.
export function publishedPinFor(pathname:string,search:string,pins:Readonly<Record<string,readonly PublishedVideoIdentity[]>>=PUBLISHED_PINS):readonly PublishedVideoIdentity[]|undefined{
  if(search)return undefined;
  return Object.hasOwn(pins,pathname)?pins[pathname]:undefined;
}

// ---- Shared verification and delivery --------------------------------------
// Per-isolate memo of storage objects whose full bytes hashed to an identity.
// Keyed by R2 key + etag + identity, so a replaced object is re-verified and one
// key verified for one tier's identity never vouches for another's.
const verified=new Set<string>();
type Heads=Map<string,Promise<R2Object|null>>;
async function verify(bucket:R2Bucket,key:string,p:VideoPinIdentity,heads:Heads):Promise<R2Object|null>{
  let pending=heads.get(key);
  if(!pending){pending=bucket.head(key);heads.set(key,pending);}
  const head=await pending;
  if(!head||head.size!==p.bytes)return null;
  const declared=head.customMetadata?.sha256;
  if(declared!==undefined&&declared!==p.sha256)return null;
  const memo=key+'\n'+head.etag+'\n'+p.sha256;
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
const baseHeaders=(label:string)=>new Headers({'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':EXPOSE,'Accept-Ranges':'bytes','X-Transcode-Pinned':label});
// Same headers as a normal HIT, keyed to the pinned identity; 416 for a bad range.
function pinnedHeaders(request:Request,p:VideoPinIdentity,meta:Record<string,string>|undefined,cache:string,label:string):{headers:Headers;range:ReturnType<typeof byteRange>}|Response{
  const headers=baseHeaders(label);
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
// Read-only: never writes or deletes R2. Tries identities in order, each one's
// candidate keys in order, and serves the first object that verifies. Throws on
// a storage error; returns null when nothing verified.
async function serveVerified(request:Request,bucket:R2Bucket,ids:readonly VideoPinIdentity[],label:string):Promise<Response|null>{
  const heads:Heads=new Map();
  for(const p of ids)for(const key of p.keys){
    const object=await verify(bucket,key,p,heads);
    if(!object)continue;
    const shaped=pinnedHeaders(request,p,object.customMetadata,'HIT',label);
    if(shaped instanceof Response)return shaped;
    const {headers,range}=shaped;
    if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
    const hit=await bucket.get(key,range?{range}:undefined);
    if(!hit||!('body' in hit)||hit.etag!==object.etag||hit.size!==p.bytes){await (hit as R2ObjectBody|null)?.body?.cancel().catch(()=>{});continue;}
    return new Response(hit.body,{status:range?206:200,headers});
  }
  return null;
}
// Legacy: returns null to fall through to servePinnedFallback (fail-closed).
export async function serveLegacyVideoPin(request:Request,bucket:R2Bucket|undefined,p:LegacyVideoPin|undefined,log:Log=logError):Promise<Response|null>{
  if(!p||!bucket||!['GET','HEAD'].includes(request.method))return null;
  try{
    const served=await serveVerified(request,bucket,[p],LEGACY_PIN_LABEL);
    if(served)return served;
  }catch(error){log({event:'legacy-video-pin-error',sha256:p.sha256,error:String(error)});return null;}
  log({event:'legacy-video-pin-unverified',sha256:p.sha256,keys:p.keys});
  return null;
}
// Published: X-Transcode-Pinned: published. Returns null when no identity
// verifies in this tier's bucket; the caller then serves the normal path and
// marks it stale (operator rule: never prevent a video from being watched).
export async function servePublishedVideoPin(request:Request,bucket:R2Bucket|undefined,ids:readonly PublishedVideoIdentity[]|undefined,log:Log=logError):Promise<Response|null>{
  if(!ids?.length||!bucket||!['GET','HEAD'].includes(request.method))return null;
  try{return await serveVerified(request,bucket,ids,PUBLISHED_PIN_LABEL);}
  catch(error){log({event:'published-video-pin-error',sha256:ids.map(p=>p.sha256),error:String(error)});return null;}
}
// The normal path's response for a published path whose pinned bytes did not
// verify: served as-is (status, body, other headers) with X-Transcode-Pinned:
// stale, and one structured warning naming what was expected and what was sent.
export function markPublishedPinStale(response:Response,path:string,ids:readonly PublishedVideoIdentity[],log:Log=logWarn):Response{
  const stale=new Response(response.body,response);
  stale.headers.set('X-Transcode-Pinned',STALE_PIN_LABEL);
  const expose=stale.headers.get('Access-Control-Expose-Headers');
  if(expose!==null&&!expose.split(',').some(h=>h.trim().toLowerCase()==='x-transcode-pinned'))stale.headers.set('Access-Control-Expose-Headers',expose+', X-Transcode-Pinned');
  log({event:'published-video-pin-stale',level:'warn',path,status:response.status,etag:response.headers.get('ETag'),cache:response.headers.get('X-Transcode-Cache'),pinned:ids.map(p=>`${p.tier}:${p.sha256}`),keys:[...new Set(ids.flatMap(p=>p.keys))]});
  return stale;
}
// No retained object verified: the unchanged encode path may run, but its full
// output must equal the pinned length and SHA-256 before any byte is served under
// the legacy identity (app owner amendment, PR #101). Otherwise an explicit 503.
// The encode path's own cache write stays under its current-encoder key.
export async function servePinnedFallback(request:Request,p:LegacyVideoPin,fetchFull:()=>Promise<Response>,log:Log=logError):Promise<Response>{
  const unavailable=(reason:string)=>{log({event:'legacy-video-pin-fallback-rejected',sha256:p.sha256,reason});return new Response(request.method==='HEAD'?null:'Pinned release bytes unavailable',{status:503,headers:baseHeaders(LEGACY_PIN_LABEL)});};
  let upstream:Response;
  try{upstream=await fetchFull();}catch(error){return unavailable(String(error));}
  if(upstream.status!==200||!upstream.body){
    await upstream.body?.cancel().catch(()=>{});
    // Encoder-side failures keep their status; no bytes are served.
    log({event:'legacy-video-pin-fallback-rejected',sha256:p.sha256,reason:`encode status ${upstream.status}`});
    return new Response(request.method==='HEAD'?null:'Pinned release bytes unavailable',{status:upstream.status===200||upstream.status<400?503:upstream.status,headers:baseHeaders(LEGACY_PIN_LABEL)});
  }
  const reader=upstream.body.getReader(),digest=createHash('sha256'),data=new Uint8Array(p.bytes);let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(size+value.byteLength>p.bytes)throw Error('Encoded bytes exceed pin');data.set(value,size);size+=value.byteLength;digest.update(value);}}
  catch(error){await reader.cancel().catch(()=>{});return unavailable(String(error));}
  if(size!==p.bytes||digest.digest('hex')!==p.sha256)return unavailable(`encoded ${size} bytes do not match pin`);
  const shaped=pinnedHeaders(request,p,{width:upstream.headers.get('X-Transcode-Video-Width')||'',height:upstream.headers.get('X-Transcode-Video-Height')||''},upstream.headers.get('X-Transcode-Cache')||'MISS',LEGACY_PIN_LABEL);
  if(shaped instanceof Response)return shaped;
  const {headers,range}=shaped;
  if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
  return new Response(range?data.slice(range.offset,range.offset+range.length):data,{status:range?206:200,headers});
}
export function clearPinVerification(){verified.clear();}
export const clearLegacyPinVerification=clearPinVerification;
