import assert from 'node:assert/strict';
import {resolveRecipe} from '../../container/recipes.mjs';
export const voiceBudget=v=>Math.max(8000,Math.min(32000,Math.round(v*16000/450000/1000)*1000));
export function args(baseline,source,output){return ['-nostdin','-hide_banner','-y','-copyts','-i',baseline,'-i',source,'-map','0:v:0','-map','1:a:0','-c:v','copy',...resolveRecipe('opus','voice','medium').args,'-movflags','+faststart',output];}
export function verifyVideo(a,b,packetsA,packetsB){assert.deepEqual(b,a,'Video payload/sample identity');assert.deepEqual(packetsB,packetsA,'Ordered video PTS/DTS/duration identity');}
