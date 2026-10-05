// Qualification only: reuse one verified source; never publish a selected recipe.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open,stat,readdir,rm,copyFile} from 'node:fs/promises';
import {createReadStream,constants} from 'node:fs';
import {measureMp4,qualifyMatchedPair,selectSustainableFixture} from '../container/video-measurements.mjs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {twoPassArguments} from '../container/video-two-pass.mjs';
import {contract,runBounded,encoderIdentity,validateOutput} from '../container/video.mjs';
const plan=JSON.parse(await readFile(new URL('../container/video-benchmark-recipes.json',import.meta.url)));
const output=resolve(process.argv[2]||'/evidence');await mkdir(output,{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
const control=new AbortController(),deadline=Date.now()+plan.limits.benchmarkMs;
let expired=false;const timer=setTimeout(()=>{expired=true;control.abort();},plan.limits.benchmarkMs);
const receipt={status:'running',scope:'Three provisional optimization candidates; no selected delivery recipe or browser/visual acceptance',source:contract.source,plan,planSha256:digest(JSON.stringify(plan)),startedAt:new Date().toISOString(),sourceRequests:0,candidates:[]};
const save=()=>writeFile(join(output,'benchmark-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const probe=async path=>JSON.parse((await runBounded('/usr/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{signal:control.signal})).toString());
const total=async()=>{let bytes=0,meta=0,stats=0;for(const name of await readdir(output)){const s=await stat(join(output,name));if(!s.isFile())throw Error('Unexpected artifact directory');bytes+=s.size;if(name.startsWith('pass-'))stats+=s.size;else if(!name.endsWith('.mp4')&&!name.endsWith('.jpg'))meta+=s.size;}assert.ok(bytes<=plan.limits.totalBytes,'Aggregate artifact ceiling');assert.ok(stats<=plan.limits.passlogTotalBytes,'Aggregate passlog ceiling');assert.ok(meta<=plan.limits.metadataBytes,'Aggregate metadata ceiling');return bytes;};
const metadata=async(name,value)=>{const body=typeof value==='string'?value:JSON.stringify(value,null,2);assert.ok(Buffer.byteLength(body)<1024*1024,'Metadata file ceiling');await writeFile(join(output,name),body);};
let frames=0;
async function frame(path,name,time){assert.ok(++frames<=plan.limits.frameCount);const target=join(output,name);await runBounded('/usr/bin/ffmpeg',['-nostdin','-v','error','-ss',String(time),'-i',path,'-frames:v','1','-q:v','2','-y',target],{signal:control.signal,outputPath:target,limit:plan.limits.frameBytes});await total();}
try{
 await save();receipt.encoder=await encoderIdentity(control.signal);receipt.measurementModuleSha256=digest(await readFile(new URL('../container/video-measurements.mjs',import.meta.url)));receipt.builderSha256=digest(await readFile(new URL('../container/video-two-pass.mjs',import.meta.url)));receipt.benchmarkScriptSha256=digest(await readFile(new URL(import.meta.url)));
 const limitFile=join(output,'limit-test.bin');await assert.rejects(runBounded('/usr/local/bin/node',['-e',"require('fs').writeFileSync(process.argv[1],Buffer.alloc(2*1024*1024))",limitFile],{outputPath:limitFile,limit:1024,signal:control.signal}));assert.ok((await stat(limitFile)).size<=1024);await rm(limitFile);receipt.rapidWriteLimitPassed=true;
 const source=join(output,'verified-source.mp4');
 if(process.argv[3]){
  const retained=resolve(process.argv[3]);assert.equal((await stat(retained)).size,contract.source.bytes);const h=createHash('sha256');for await(const bytes of createReadStream(retained))h.update(bytes);assert.equal(h.digest('hex'),contract.source.sha256);await copyFile(retained,source,constants.COPYFILE_EXCL);receipt.sourceAcquisition='retained-hash-verified';
 }else{
  const fd=await open(source,'wx');let size=0;const h=createHash('sha256');
  try{receipt.sourceRequests++;receipt.sourceAcquisition='single-origin-fetch';await save();const r=await fetch(contract.source.url,{redirect:'error',signal:AbortSignal.any([control.signal,AbortSignal.timeout(contract.limits.sourceMs)])});assert.equal(r.status,200);for await(const part of r.body){size+=part.length;assert.ok(size<=contract.limits.bytes);h.update(part);let at=0;while(at<part.length){const w=await fd.write(part,at,part.length-at);assert.ok(w.bytesWritten);at+=w.bytesWritten;}}}finally{await fd.close();}
  assert.equal(size,contract.source.bytes);assert.equal(h.digest('hex'),contract.source.sha256);
 }
 const finalSourceHash=createHash('sha256');for await(const bytes of createReadStream(source))finalSourceHash.update(bytes);assert.equal((await stat(source)).size,contract.source.bytes);assert.equal(finalSourceHash.digest('hex'),contract.source.sha256);
 const sourceProbe=await probe(source);receipt.sourceProbe=sourceProbe;
 const video=sourceProbe.streams.find(s=>s.codec_type==='video');assert.equal(video.width,1280);assert.equal(video.height,720);const [n,d]=video.avg_frame_rate.split('/').map(Number),fps=n/d;assert.equal(fps,50,'Accepted source cadence');
 const sourceVideoDuration=Number(video.duration);assert.ok(sourceVideoDuration>0);const nominalVideoBytes=plan.videoClassBps*sourceVideoDuration/8;
 const nominalCombinedBytes=nominalVideoBytes+(sourceProbe.streams.some(s=>s.codec_type==='audio')?plan.audioKbps*1000*Number(sourceProbe.format.duration)/8:0);
 const matching={videoBytes:nominalVideoBytes,combinedBytes:nominalCombinedBytes,videoTolerance:plan.videoTolerance,pairTolerance:plan.pairTolerance,muxAllowance:plan.muxAllowance};receipt.budgetDefinition={...matching,sourceVideoDuration,audioBudgetDuration:Number(sourceProbe.format.duration)};
 // Scene candidates are measurements, not asserted ground-truth cuts.
 const scenesFile=join(output,'source-scenes.txt');await runBounded('/usr/bin/ffmpeg',['-nostdin','-v','error','-i',source,'-vf',`select='gt(scene,0.3)',metadata=print:file=${scenesFile}`,'-an','-f','null','/dev/null'],{signal:control.signal,outputPath:scenesFile,limit:plan.limits.passlogFileBytes});
 const sceneText=await readFile(scenesFile,'utf8');const cuts=[...sceneText.matchAll(/pts_time:([\d.]+)/g)].map(m=>Number(m[1])).filter(t=>t>.1&&t<Number(sourceProbe.format.duration)-.1).slice(0,3);receipt.sceneCandidateTimes=cuts;
 const times=[10,40,70,...cuts.flatMap(t=>[Math.max(0,t-.08),t+.08])];for(let i=0;i<times.length;i++)await frame(source,`source-${i}.jpg`,times[i]);
 for(const candidate of plan.candidates){
  const {id}=candidate,keyint=Math.round(fps*candidate.gopSeconds);
  assert.ok(Date.now()<deadline&&!control.signal.aborted,'Benchmark deadline');const candidateStart=Date.now(),candidateSignal=AbortSignal.any([control.signal,AbortSignal.timeout(plan.limits.candidateMs)]);
  const entry={id,configuration:candidate,status:'running',startedAt:new Date().toISOString(),passes:[]};receipt.candidates.push(entry);await save();
  const prefix=join(output,`pass-${id}`),target=join(output,`candidate-${id}.mp4`);
  for(const pass of [1,2]){let log='';const args=twoPassArguments(plan,{source,output:target,prefix,id,fps,pass});const start=Date.now();await runBounded('/usr/bin/ffmpeg',args,{timeout:Math.max(1,plan.limits.candidateMs-(Date.now()-candidateStart)),signal:candidateSignal,outputPath:pass===1?'/dev/null':target,limit:pass===1?plan.limits.passlogFileBytes:contract.limits.bytes,onStderr:b=>{log=(log+b.toString()).slice(-65536);}});await metadata(`candidate-${id}-pass${pass}.log`,log);const settings=pass===1?(await readFile(prefix+'-0.log','utf8')).split('\n')[0]:log;for(const token of [`bitrate=${Math.floor(plan.encoderRequestBps/1000)}`,`vbv_maxrate=${plan.maxrateBps/1000}`,`vbv_bufsize=${plan.bufferBits/1000}`,`keyint=${keyint}`,`scenecut=${candidate.scenecut}`,pass===1?'rc=abr':'rc=2pass'])assert.ok(settings.includes(token),`Installed encoder must confirm ${token}`);entry.passes.push({pass,args,elapsedMs:Date.now()-start,logSha256:digest(log),settingsSha256:digest(settings),settings:pass===1?settings:undefined});let stats=0;for(const name of(await readdir(output)).filter(n=>n.startsWith(`pass-${id}`))){assert.match(name,new RegExp(`^pass-${id}-0\\.log(?:\\.mbtree)?(?:\\.temp)?$`));stats+=(await stat(join(output,name))).size;}assert.ok(stats<=plan.limits.passlogTotalBytes);await total();await save();}
  const actual=await probe(target),checked=validateOutput(sourceProbe,actual),body=await readFile(target),measurement=measureMp4(body);
  assert.equal(checked.width,candidate.width);assert.equal(checked.height,candidate.height);assert.equal(actual.streams.find(s=>s.codec_type==='video').avg_frame_rate,video.avg_frame_rate);
  const individual=qualifyMatchedPair(measurement,measurement,matching),budgetAccepted=individual.accepted;
  entry.metadata={...checked,bytes:body.length,sha256:digest(body),elapsedMs:Date.now()-candidateStart,sourceSha256:contract.source.sha256,requestedVideoBps:plan.encoderRequestBps,measuredVideoBps:measurement.tracks.find(t=>t.type==='vide').bytes*8/measurement.tracks.find(t=>t.type==='vide').duration,budgetAccepted,individualBudgetReasons:individual.reasons,measurement};
  const frameData=JSON.parse((await runBounded('/usr/bin/ffprobe',['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=key_frame,best_effort_timestamp_time,pict_type','-of','json',target],{signal:control.signal})).toString());entry.frameTypes=frameData.frames.reduce((counts,f)=>{counts[f.pict_type]=(counts[f.pict_type]||0)+1;return counts;},{});entry.keyframes=frameData.frames.filter(f=>f.key_frame===1).map(f=>Number(f.best_effort_timestamp_time));
  for(let i=0;i<times.length;i++)await frame(target,`candidate-${id}-${i}.jpg`,times[i]);
  entry.passlogs=[];for(const name of(await readdir(output)).filter(n=>n.startsWith(`pass-${id}`))){const bytes=await readFile(join(output,name));entry.passlogs.push({name,bytes:bytes.length,sha256:digest(bytes)});await rm(join(output,name));}entry.status=budgetAccepted?'measured-review-pending':'rejected-budget';await total();await save();
 }
 assert.equal(expired,false);receipt.status='measured-review-pending';receipt.budgetAcceptedCandidates=receipt.candidates.filter(c=>c.metadata.budgetAccepted).map(c=>c.id);
 const candidate=id=>receipt.candidates.find(c=>c.id===id);receipt.matchedPairs={resolution:qualifyMatchedPair(candidate('A').metadata.measurement,candidate('B').metadata.measurement,matching),gop:qualifyMatchedPair(candidate('B').metadata.measurement,candidate('C').metadata.measurement,matching)};
 const available=['A','B'].map(id=>({id,bps:candidate(id).metadata.bytes*8/candidate(id).metadata.duration})),bRate=available.find(r=>r.id==='B').bps,aRate=available.find(r=>r.id==='A').bps;
 receipt.selectionFixture={scope:'Synthetic bandwidth policy only; no network/player or production adaptation claim',cases:[
  {name:'low bandwidth',bandwidth:.75*bRate,available,result:selectSustainableFixture(available,.75*bRate,plan.selectionHeadroom)},
  {name:'sufficient bandwidth',bandwidth:1.5*bRate,available,result:selectSustainableFixture(available,1.5*bRate,plan.selectionHeadroom)},
  {name:'720 unavailable,360 sustainable',bandwidth:1.5*aRate,available:available.filter(r=>r.id==='A'),result:selectSustainableFixture(available.filter(r=>r.id==='A'),1.5*aRate,plan.selectionHeadroom)},
  {name:'no available rendition',bandwidth:1.5*bRate,available:[],result:selectSustainableFixture([],1.5*bRate,plan.selectionHeadroom)}]};
 assert.equal(receipt.selectionFixture.cases[1].result.id,'B');assert.equal(receipt.selectionFixture.cases[2].result.id,'A');assert.equal(receipt.selectionFixture.cases[3].result.id,null);
receipt.artifactBytes=await total();
}catch(e){receipt.status='failed';receipt.error=String(e);process.exitCode=1;}
finally{clearTimeout(timer);if(expired){receipt.status='failed';receipt.error='Shared ten-minute benchmark deadline';process.exitCode=1;}receipt.finishedAt=new Date().toISOString();await save();}
