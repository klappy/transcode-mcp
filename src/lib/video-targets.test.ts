import {test,expect} from 'bun:test';
import {videoContract,videoContracts,selectVideoContract,videoOptions,videoKey,videoSlot,VideoOwner} from './video';
import {parseProxyPath} from './parse-proxy-path';
import {buildToolResponse} from './mcp-tool';
import {generateTranscodeUrl} from './generate-transcode-url';
const url=videoContract.source.url;
test('closed target parser and MCP preserve absent/large identity and quality meaning',async()=>{
 expect(videoOptions({size:'large'})).toEqual(videoOptions({}));
 expect(selectVideoContract(url,'large')).toBe(selectVideoContract(url));
 expect(await videoSlot(url,5,'large')).toBe(await videoSlot(url,5));
 for(const size of ['small','medium','large'] as const){const args={media_type:'video' as const,source_url:url,size};const r=buildToolResponse(args,'https://example.test');const parsed=parseProxyPath(r.proxy_path);expect(parsed.mediaType).toBe('video');expect(parsed.options.q).toBe('medium');expect(selectVideoContract(url,size)?.encoding.height).toBe({small:480,medium:540,large:720}[size]);}
 for(const invalid of ['size=1080','size=4k','size=__proto__','w=854','h=480','s=480','resolution=480','size=small,size=large'])expect(()=>parseProxyPath('/video/'+invalid+'/'+url)).toThrow();
 expect(()=>buildToolResponse({media_type:'video',source_url:url,size:'small',w:854},'https://x')).toThrow();
 expect(()=>generateTranscodeUrl({mediaType:'video',sourceUrl:url,options:{size:'4k'} as never})).toThrow();
});
test('full contracts separate cache/admission and unsupported source combinations fail closed',async()=>{
 const contracts=['small','medium','large'].map(size=>selectVideoContract(url,size)!);
 expect(new Set(await Promise.all(contracts.map(c=>videoKey('a'.repeat(64),c)))).size).toBe(3);
 for(const c of videoContracts.slice(1)){expect(selectVideoContract(c.source.url)).toBe(c);expect(selectVideoContract(c.source.url,'small')).toBeUndefined();expect(()=>buildToolResponse({media_type:'video',source_url:c.source.url,size:'medium'},'https://x')).toThrow();}
 expect(selectVideoContract(url,'constructor')).toBeUndefined();
 let resolve!:()=>void,calls=0;const owner=new VideoOwner(()=>{});const pending=owner.run(JSON.stringify(contracts[0]),()=>{calls++;return new Promise<void>(r=>resolve=r)});const joined=owner.run(JSON.stringify(contracts[0]),async()=>{calls++});await expect(owner.run(JSON.stringify(contracts[1]),async()=>{})).rejects.toThrow('busy');await Promise.resolve();expect(calls).toBe(1);resolve();await Promise.all([pending,joined]);
});
