import {contract,deliveryPassArguments} from '../../container/video.mjs';
import {resolveRecipe} from '../../container/recipes.mjs';
export const candidate={...structuredClone(contract),recipe:'private-a13-320-v1',encoding:{width:568,height:320,fps:50,preset:'medium',videoBps:88889,classBps:88889,maxrateBps:177778,bufferBits:355556,keyint:1500,minKeyint:1,scenecut:60,passes:2,audioBps:42667,audioChannels:1,sar:'640:639'}};
export const passArguments=(source,output,prefix,pass)=>deliveryPassArguments(source,output,prefix,pass,candidate);
export const lowArguments=(source,output)=>['-nostdin','-hide_banner','-y','-protocol_whitelist','file,pipe','-i',source,'-map','0:a:0','-vn',...resolveRecipe('opus','voice','low').args,output];
export function budget(measurement){const v=measurement.tracks.find(t=>t.type==='vide');const bps=v.bytes*8/v.duration;return{actualVideoBps:bps,nominalVideoBps:88889,relativeDeviation:Math.abs(bps-88889)/88889,accepted:Math.abs(bps-88889)/88889<=.05};}
