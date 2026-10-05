import {test,expect} from 'bun:test';
import {videoContracts,selectVideoContract,videoKey} from './video.ts';
import {selectVideoContract as containerSelect,deliveryPassArguments} from '../../container/video.mjs';
import xsmall from '../../container/video-contract-xsmall.json';
import small from '../../container/video-contract-small.json';
import medium from '../../container/video-contract-medium.json';
import extension from '../../container/video-source-extension.json';
test('one catalog binds all twelve exact source/profile pairs identically in Worker and container',async()=>{
 const keys=[];
 for(const source of videoContracts)for(const size of ['xsmall','small','medium','large']){
  const selected=selectVideoContract(source.source.url,size);expect(selected).toBeDefined();expect(selected).toEqual(containerSelect(source.source.url,size));
  expect(selected.source.url).toBe(source.source.url);expect(selected.source.sha256).toBe(source.source.sha256);expect(selected.source.bytes).toBe(source.source.bytes);expect(selected.source.provenance.assetId).toBe(source.source.provenance.assetId);
  const profile=size==='large'?source:size==='xsmall'?xsmall:size==='small'?small:medium;expect(selected.encoding).toEqual(profile.encoding);expect(selected.limits).toEqual(profile.limits);expect(selected.recipe).toBe(profile.recipe);
  if(size==='large'||source===videoContracts[0])expect(selected).toEqual(profile);else expect(selected.sourceExtensionRevision).toBe(extension.recipeRevision);
  const args=deliveryPassArguments('input','output','stats',2,selected);expect(args[args.indexOf('-ac')+1]).toBe(['xsmall','small'].includes(size)?'1':'2');expect(args).not.toContain('-r');keys.push(await videoKey('a'.repeat(64),selected));
 }
 expect(new Set(keys).size).toBe(12);
 for(const source of videoContracts){expect(selectVideoContract(source.source.url)).toBe(selectVideoContract(source.source.url,'large'));for(const bad of ['tiny','320','constructor','__proto__'])expect(selectVideoContract(source.source.url,bad)).toBeUndefined();expect(selectVideoContract(source.source.url+'?x=1','small')).toBeUndefined();}
});

test('additive xsmall uses exact aligned25fps profile and same closed option path',async()=>{
 const {videoOptions}=await import('./video.ts');expect(videoOptions({size:'xsmall'})).toEqual({preset:'fia',q:'medium',f:'mp4',size:'xsmall'});const c=selectVideoContract(videoContracts[0].source.url,'xsmall');expect(c.encoding).toMatchObject({width:576,height:320,sar:'80:81',dar:'16:9',fps:25,outputFrameRate:'25/1',videoBps:133334,classBps:133334,maxrateBps:266667,bufferBits:533334,audioBps:42667,audioChannels:1,keyint:750});const args=deliveryPassArguments('i','o','p',2,c);expect(args[args.indexOf('-vf')+1]).toBe('fps=fps=25/1:round=near,scale=576:320:flags=lanczos,setsar=80/81:max=65535');expect(args[args.indexOf('-b:a')+1]).toBe('42667');expect(args[args.indexOf('-ac')+1]).toBe('1');expect(c.recipe).toBe('fia-video@5-xsmall');
});
