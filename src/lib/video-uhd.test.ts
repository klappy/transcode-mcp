import {test,expect} from 'bun:test';
import {selectVideoContract,videoOptions,videoKey} from './video';
import {fitLazyRaster} from '../../container/video-sources.mjs';
// @ts-expect-error Node-only encoder module has no TypeScript declaration.
import {selectLazyVideoContract,deriveLazyContract,lazyPassArguments} from '../../container/video-lazy.mjs';
import {parseProxyPath} from './parse-proxy-path';
import {buildToolResponse} from './mcp-tool';
const source='https://s3.amazonaws.com/cbbt-er.public/master.mp4';
test('UHD targets share worker/container contract and proxy vocabulary with explicit square-pixel dimensions',async()=>{
 const keys=[];
 for(const [size,width,height] of [['1080p',1920,1080],['3k',3072,1728],['4k',3840,2160]] as const){
  const contract=selectVideoContract(source,size)!;
  expect(contract).toEqual(selectLazyVideoContract(source,size));
  expect(contract.encoding).toMatchObject({width,height,sar:'1:1',dar:'16:9'});
  expect(contract.limits).toMatchObject({sourceBytes:268435456,bytes:62914560,encodeMs:300000,jobMs:600000});
  expect(videoOptions({size}).size).toBe(size);
  const result=buildToolResponse({media_type:'video',source_url:source,size},'https://proxy.test');
  const parsed=parseProxyPath(result.proxy_path);
  if(parsed.mediaType!=='video')throw Error('Expected video');
  expect(parsed.options.size).toBe(size);
  const derived=deriveLazyContract(contract,{width:3840,height:2160,sample_aspect_ratio:'1:1',avg_frame_rate:'50/1',r_frame_rate:'50/1'});
  expect(derived.encoding).toMatchObject({width,height,outputFrameRate:'25/1'});
  expect(lazyPassArguments('in','out','pass',2,derived).join(' ')).toContain(`scale=${width}:${height}:flags=lanczos`);
  keys.push(await videoKey('a'.repeat(64),contract));
 }
 expect(new Set(keys).size).toBe(3);
});
test('UHD remains bounded by source geometry and existing host policy; old profiles retain limits',()=>{
 for(const size of ['1080p','3k','4k']){
  const c=selectVideoContract(source,size)!;
  expect(fitLazyRaster(c.encoding,{width:1280,height:720})).toMatchObject({width:1280,height:720});
  expect(fitLazyRaster(c.encoding,{width:2160,height:3840})).toMatchObject({sar:'1:1'});
  expect(selectVideoContract('https://cdn.fiaguide.app.evil.test/master.mp4',size)).toBeUndefined();
 }
 for(const size of ['xsmall','small','medium','large','xlarge'])expect(selectLazyVideoContract(source,size)!.limits.sourceBytes).toBe(268435456);
 expect(selectVideoContract(source,'xlarge')!.encoding).toMatchObject({width:1616,height:912});
 expect(selectVideoContract(source,'5k')).toBeUndefined();
});
