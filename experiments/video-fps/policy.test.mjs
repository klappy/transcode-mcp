import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fpsArguments,requireJobCapacity,qualifyFpsPair} from './policy.mjs';
import {deliveryPassArguments,contract} from '../../container/video.mjs';
const plan=JSON.parse(await readFile(new URL('./plan.json',import.meta.url)));
test('25fps changes only filter cadence and30-second GOP;50 remains exact runtimearguments',()=>{
 const options={source:'/source',output:'/output',prefix:'/pass',pass:2};const original=structuredClone(contract);
 assert.deepEqual(fpsArguments(deliveryPassArguments,contract,{...options,fps:50}),deliveryPassArguments(options.source,options.output,options.prefix,2));
 const a=fpsArguments(deliveryPassArguments,contract,{...options,fps:25});assert.equal(a[a.indexOf('-g')+1],'750');assert.equal(a[a.indexOf('-vf')+1],'scale=1280:720:flags=lanczos,fps=fps=25:round=near');assert.equal(a[a.indexOf('-b:v')+1],'439024');assert.equal(a[a.indexOf('-b:a')+1],'96k');assert.equal(a[a.indexOf('-maxrate')+1],'900000');assert.deepEqual(contract,original);assert.throws(()=>fpsArguments(deliveryPassArguments,contract,{...options,fps:30}));
});
test('deadline and disk reservation reject a late or oversized job before starting',()=>{
 requireJobCapacity(plan,{remainingMs:330000,diskBytes:0});assert.throws(()=>requireJobCapacity(plan,{remainingMs:329999,diskBytes:0}),/deadline/);assert.throws(()=>requireJobCapacity(plan,{remainingMs:400000,diskBytes:plan.limits.diskBytes-1}),/disk/);
});
const measurement=(video=439024*80/8,sha='audio',samples=4000)=>({tracks:[{type:'vide',bytes:video,duration:80},{type:'soun',bytes:960000,duration:80,samples,payloadSha256:sha}]});
test('individual5%ratepass cannot falselyqualify mismatchedactualpair',()=>{
 assert.equal(qualifyFpsPair(measurement(),measurement()).accepted,true);const result=qualifyFpsPair(measurement(439024*10*.98),measurement(439024*10*1.02));assert.deepEqual(result.reasons,['video-pair-mismatch']);
});
test('audio payload or samplecount changes reject controlledcadenceclaim',()=>{
 assert.ok(qualifyFpsPair(measurement(),measurement(undefined,'changed')).reasons.includes('audio-identity'));assert.ok(qualifyFpsPair(measurement(),measurement(undefined,'audio',4001)).reasons.includes('audio-identity'));
});
test('workflow is manualonly and lower-rateencode is notpartofscript',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/video-fps-experiment.yml',import.meta.url),'utf8');assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/pull_request:|push:/);assert.match(workflow,/--network none/);const script=await readFile(new URL('./run.mjs',import.meta.url),'utf8');assert.doesNotMatch(script,/fetch\(/);assert.match(script,/await encode\(25\)/);assert.doesNotMatch(script,/329268|351219/);
});
