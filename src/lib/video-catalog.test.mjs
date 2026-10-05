import {test,expect} from 'bun:test';
import {videoContracts,selectVideoContract,videoKey} from './video.ts';
import {selectVideoContract as containerSelect,deliveryPassArguments} from '../../container/video.mjs';
import small from '../../container/video-contract-small.json';
import medium from '../../container/video-contract-medium.json';
import extension from '../../container/video-source-extension.json';
test('one catalog binds all nine exact source/profile pairs identically in Worker and container',async()=>{
 const keys=[];
 for(const source of videoContracts)for(const size of ['small','medium','large']){
  const selected=selectVideoContract(source.source.url,size);expect(selected).toBeDefined();expect(selected).toEqual(containerSelect(source.source.url,size));
  expect(selected.source.url).toBe(source.source.url);expect(selected.source.sha256).toBe(source.source.sha256);expect(selected.source.bytes).toBe(source.source.bytes);expect(selected.source.provenance.assetId).toBe(source.source.provenance.assetId);
  const profile=size==='large'?source:size==='small'?small:medium;expect(selected.encoding).toEqual(profile.encoding);expect(selected.limits).toEqual(profile.limits);expect(selected.recipe).toBe(profile.recipe);
  if(size==='large'||source===videoContracts[0])expect(selected).toEqual(profile);else expect(selected.sourceExtensionRevision).toBe(extension.recipeRevision);
  const args=deliveryPassArguments('input','output','stats',2,selected);expect(args[args.indexOf('-ac')+1]).toBe(size==='small'?'1':'2');expect(args).not.toContain('-r');keys.push(await videoKey('a'.repeat(64),selected));
 }
 expect(new Set(keys).size).toBe(9);
 for(const source of videoContracts){expect(selectVideoContract(source.source.url)).toBe(selectVideoContract(source.source.url,'large'));for(const bad of ['tiny','320','constructor','__proto__'])expect(selectVideoContract(source.source.url,bad)).toBeUndefined();expect(selectVideoContract(source.source.url+'?x=1','small')).toBeUndefined();}
});
