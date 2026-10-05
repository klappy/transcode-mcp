import {test} from 'node:test';import assert from 'node:assert/strict';
import {candidate,passArguments,lowArguments,budget} from './policy.mjs';
import {selectVideoContract,contract} from '../../container/video.mjs';
test('experimental raster/budget preserve core target selection and conservative AAC floor',()=>{
 assert.equal(selectVideoContract(contract.source.url,'320'),undefined);assert.equal(selectVideoContract(contract.source.url,'small').encoding.height,480);
 assert.equal(candidate.encoding.videoBps,Math.round(88889*1.5));
 const a=passArguments('source','output','stats',2);assert.equal(a[a.indexOf('-vf')+1],'scale=576:320:flags=lanczos,setsar=80/81:max=65535');assert.equal(a[a.indexOf('-b:a')+1],'42667');assert.equal(a[a.indexOf('-ac')+1],'1');assert.equal(a[a.indexOf('-ar')+1],'48000');assert.ok(!a.includes('libopus'));
});
test('Low reference is actual Opus Low recipe rather than cross-codec bitrate equivalence',()=>{const a=lowArguments('source','reference.opus');assert.equal(a[a.indexOf('-b:a')+1],'8k');assert.equal(a[a.indexOf('-ar')+1],'8000');assert.equal(a[a.indexOf('-application')+1],'voip');assert.equal(a[a.indexOf('-c:a')+1],'libopus');});
test('budget rejection is preserved at fixed five percent without adjusting target',()=>{assert.equal(budget({tracks:[{type:'vide',bytes:133334/8*10,duration:10}]}).accepted,true);assert.equal(budget({tracks:[{type:'vide',bytes:160000/8*10,duration:10}]}).accepted,false);});

test('aligned canvas has exact declared display shape and preserved VBV convention',()=>{assert.equal(candidate.encoding.width*80*9,candidate.encoding.height*81*16);assert.equal(candidate.encoding.dar,'16:9');assert.equal(candidate.encoding.width%32,0);assert.equal(candidate.encoding.height%32,0);const a=passArguments('source','output','stats',2);assert.equal(a[a.indexOf('-b:v')+1],'133334');assert.equal(a[a.indexOf('-maxrate')+1],'266667');assert.equal(a[a.indexOf('-bufsize')+1],'533334');assert.equal(candidate.encoding.fps,50);});
