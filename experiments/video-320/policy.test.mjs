import {test} from 'node:test';import assert from 'node:assert/strict';
import {candidate,passArguments,lowArguments,budget} from './policy.mjs';
import {selectVideoContract,contract} from '../../container/video.mjs';
test('experimental raster/budget preserve core target selection and conservative AAC floor',()=>{
 assert.equal(selectVideoContract(contract.source.url,'320'),undefined);assert.equal(selectVideoContract(contract.source.url,'small').encoding.height,480);
 assert.equal(candidate.encoding.videoBps,Math.round(450000*(320/720)**2));
 const a=passArguments('source','output','stats',2);assert.equal(a[a.indexOf('-vf')+1],'scale=568:320:flags=lanczos,setsar=640/639:max=65535');assert.equal(a[a.indexOf('-b:a')+1],'42667');assert.equal(a[a.indexOf('-ac')+1],'1');assert.equal(a[a.indexOf('-ar')+1],'48000');assert.ok(!a.includes('libopus'));
});
test('Low reference is actual Opus Low recipe rather than cross-codec bitrate equivalence',()=>{const a=lowArguments('source','reference.opus');assert.equal(a[a.indexOf('-b:a')+1],'8k');assert.equal(a[a.indexOf('-ar')+1],'8000');assert.equal(a[a.indexOf('-application')+1],'voip');assert.equal(a[a.indexOf('-c:a')+1],'libopus');});
test('budget rejection is preserved at fixed five percent without adjusting target',()=>{assert.equal(budget({tracks:[{type:'vide',bytes:88889/8*10,duration:10}]}).accepted,true);assert.equal(budget({tracks:[{type:'vide',bytes:100000/8*10,duration:10}]}).accepted,false);});
