// Qualification only: reuse one verified source; never publish a selected recipe.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open,stat,readdir,rm} from 'node:fs/promises';
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
 await save();receipt.encoder=await encoderIdentity(control.signal);receipt.builderSha256=digest(await readFile(new URL('../container/video-two-pass.mjs',import.meta.url)));receipt.benchmarkScriptSha256=digest(await readFile(new URL(import.meta.url)));
 const limitFile=join(output,'limit-test.bin');await assert.rejects(runBounded('/usr/local/bin/node',['-e',"require('fs').writeFileSync(process.argv[1],Buffer.alloc(2*1024*1024))",limitFile],{outputPath:limitFile,limit:1024,signal:control.signal}));assert.ok((await stat(limitFile)).size<=1024);await rm(limitFile);receipt.rapidWriteLimitPassed=true;
 const source=join(output,'verified-source.mp4'),fd=await open(source,'wx');let size=0;const h=createHash('sha256');
 try{receipt.sourceRequests++;await save();const r=await fetch(contract.source.url,{redirect:'error',signal:AbortSignal.any([control.signal,AbortSignal.timeout(contract.limits.sourceMs)])});assert.equal(r.status,200);for await(const part of r.body){size+=part.length;assert.ok(size<=contract.limits.bytes);h.update(part);let at=0;while(at<part.length){const w=await fd.write(part,at,part.length-at);assert.ok(w.bytesWritten);at+=w.bytesWritten;}}}finally{await fd.close();}
 assert.equal(size,contract.source.bytes);assert.equal(h.digest('hex'),contract.source.sha256);const sourceProbe=await probe(source);receipt.sourceProbe=sourceProbe;
 const video=sourceProbe.streams.find(s=>s.codec_type==='video');assert.equal(video.width,1280);assert.equal(video.height,720);const [n,d]=video.avg_frame_rate.split('/').map(Number),fps=n/d;assert.ok(Number.isFinite(fps)&&fps>0&&fps<=120);const keyint=Math.round(fps*plan.gopSeconds);receipt.keyint=keyint;
 // Scene candidates are measurements, not asserted ground-truth cuts.
 const scenesFile=join(output,'source-scenes.txt');await runBounded('/usr/bin/ffmpeg',['-nostdin','-v','error','-i',source,'-vf',`select='gt(scene,0.3)',metadata=print:file=${scenesFile}`,'-an','-f','null','/dev/null'],{signal:control.signal,outputPath:scenesFile,limit:plan.limits.passlogFileBytes});
 const sceneText=await readFile(scenesFile,'utf8');const cuts=[...sceneText.matchAll(/pts_time:([\d.]+)/g)].map(m=>Number(m[1])).filter(t=>t>.1&&t<Number(sourceProbe.format.duration)-.1).slice(0,3);receipt.sceneCandidateTimes=cuts;
 const times=[10,40,70,...cuts.flatMap(t=>[Math.max(0,t-.08),t+.08])];for(let i=0;i<times.length;i++)await frame(source,`source-${i}.jpg`,times[i]);
 for(const kbps of plan.videoKbps){
  assert.ok(Date.now()<deadline&&!control.signal.aborted,'Benchmark deadline');const candidateStart=Date.now(),candidateSignal=AbortSignal.any([control.signal,AbortSignal.timeout(plan.limits.candidateMs)]);
  const entry={videoKbps:kbps,status:'running',startedAt:new Date().toISOString(),passes:[]};receipt.candidates.push(entry);await save();
  const prefix=join(output,`pass-${kbps}`),target=join(output,`candidate-${kbps}.mp4`),maxrate=kbps*plan.maxrateMultiplier;
  for(const pass of [1,2]){let log='';const args=twoPassArguments(plan,{source,output:target,prefix,kbps,fps,pass});const start=Date.now();await runBounded('/usr/bin/ffmpeg',args,{timeout:Math.max(1,plan.limits.candidateMs-(Date.now()-candidateStart)),signal:candidateSignal,outputPath:pass===1?'/dev/null':target,limit:pass===1?plan.limits.passlogFileBytes:contract.limits.bytes,onStderr:b=>{log=(log+b.toString()).slice(-65536);}});await metadata(`candidate-${kbps}-pass${pass}.log`,log);for(const token of [`bitrate=${kbps}`,`vbv_maxrate=${maxrate}`,`vbv_bufsize=${maxrate*plan.bufferSeconds}`,`keyint=${keyint}`,`scenecut=${plan.scenecut}`,pass===1?'rc=abr':'rc=2pass'])assert.ok(log.includes(token),`Installed encoder must confirm ${token}`);entry.passes.push({pass,args,elapsedMs:Date.now()-start,logSha256:digest(log)});let stats=0;for(const name of(await readdir(output)).filter(n=>n.startsWith(`pass-${kbps}`))){assert.match(name,new RegExp(`^pass-${kbps}-0\\.log(?:\\.mbtree)?(?:\\.temp)?$`));stats+=(await stat(join(output,name))).size;}assert.ok(stats<=plan.limits.passlogTotalBytes);await total();await save();}
  const actual=await probe(target),checked=validateOutput(sourceProbe,actual),body=await readFile(target);const byteBudget=Math.ceil(Number(sourceProbe.format.duration)*(kbps+(sourceProbe.streams.some(s=>s.codec_type==='audio')?plan.audioKbps:0))*1000/8*plan.muxAllowance);assert.ok(body.length<=byteBudget,'Declared byte budget');assert.equal(actual.streams.find(s=>s.codec_type==='video').avg_frame_rate,video.avg_frame_rate);
  entry.metadata={...checked,bytes:body.length,sha256:digest(body),byteBudget,elapsedMs:Date.now()-candidateStart,sourceSha256:contract.source.sha256};
  const frameData=JSON.parse((await runBounded('/usr/bin/ffprobe',['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=key_frame,best_effort_timestamp_time,pict_type','-of','json',target],{signal:control.signal})).toString());entry.keyframes=frameData.frames.filter(f=>f.key_frame===1).map(f=>Number(f.best_effort_timestamp_time));
  for(let i=0;i<times.length;i++)await frame(target,`candidate-${kbps}-${i}.jpg`,times[i]);
  entry.passlogs=[];for(const name of(await readdir(output)).filter(n=>n.startsWith(`pass-${kbps}`))){const bytes=await readFile(join(output,name));entry.passlogs.push({name,bytes:bytes.length,sha256:digest(bytes)});await rm(join(output,name));}entry.status='measured-review-pending';await total();await save();
 }
 assert.equal(expired,false);receipt.status='measured-review-pending';receipt.artifactBytes=await total();
}catch(e){receipt.status='failed';receipt.error=String(e);process.exitCode=1;}
finally{clearTimeout(timer);if(expired){receipt.status='failed';receipt.error='Shared ten-minute benchmark deadline';process.exitCode=1;}receipt.finishedAt=new Date().toISOString();await save();}
