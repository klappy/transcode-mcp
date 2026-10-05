import {readFile,writeFile,mkdir,readdir,stat,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {resolve,join} from 'node:path';import assert from 'node:assert/strict';
import {runBounded,encoderIdentity,validateOutput} from '../../container/video.mjs';
import {measureMp4} from '../../container/video-measurements.mjs';
import {encodeSample} from './encode-sample.mjs';
import {candidate,lowArguments,budget,comparisonTimeline,sampleDuration} from './policy.mjs';
const prior=resolve(process.argv[2]||'/prior'),out=resolve(process.argv[3]||'/evidence');
const cap=60*1024*1024,diskCap=384*1024*1024,tmpReserve=16*1024*1024;
assert.match(process.env.REVIEWED_COMMIT||'',/^[a-f0-9]{40}$/);
await mkdir(out,{recursive:true});assert.equal((await readdir(out)).length,0,'Fresh evidence directory');
const hash=b=>createHash('sha256').update(b).digest('hex'),control=new AbortController(),start=Date.now(),deadline=start+600000;
const receipt={status:'running',scope:'One private39.6-second sampled320p H264/AAC encode plus one audio-only Opus Low reference. No deployed route, audio quality equivalence or device acceptance claimed.',reviewedCommit:process.env.REVIEWED_COMMIT,scriptSha256:hash(await readFile(new URL(import.meta.url))),policySha256:hash(await readFile(new URL('./policy.mjs',import.meta.url))),sampleSupervisorSha256:hash(await readFile(new URL('./encode-sample.mjs',import.meta.url))),comparisonTimeline,sampleDuration,sourceOriginRequests:0,videoEncodeAttempts:0,audioReferenceAttempts:0,startedAt:new Date(start).toISOString(),candidate};
const save=()=>writeFile(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
let monitoring=false,monitorFailure;
async function usage(dir){let total=0;for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink(),'No evidence symlinks');const p=join(dir,e.name);total+=e.isDirectory()?await usage(p):(await stat(p)).size;}return total;}
async function account(){const n=await usage(prior)+await usage(out)+tmpReserve;receipt.peakAccountedBytes=Math.max(receipt.peakAccountedBytes||0,n);assert.ok(n<=diskCap,'384 MiB aggregate ceiling including16MiB tmpfs');return n;}
const timer=setTimeout(()=>control.abort(Error('Shared ten minute deadline')),600000);
const monitor=setInterval(async()=>{if(monitoring)return;monitoring=true;try{await account();}catch(e){monitorFailure=String(e);control.abort(e);}finally{monitoring=false;}},200);
function remaining(max=30000){control.signal.throwIfAborted();const n=deadline-Date.now();assert.ok(n>0,'Shared deadline');return Math.min(max,n);}
async function verified(p,sha,bytes){assert.equal((await stat(p)).size,bytes);assert.ok(bytes<=cap);const b=await readFile(p);assert.equal(hash(b),sha);return b;}
const probe=async p=>JSON.parse((await runBounded('/usr/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',p],{signal:control.signal,timeout:remaining()})).toString());
const decode=async p=>runBounded('/usr/bin/ffmpeg',['-nostdin','-v','error','-i',p,'-map','0:v?','-map','0:a?','-f','null','/dev/null'],{signal:control.signal,timeout:remaining(60000)});
try{
 await save();const rb=await readFile(join(prior,'benchmark-receipt.json'));assert.equal(hash(rb),'add833e6bb754fb1edbdf7019eebbd8fd54d50ec42aba1d5865775c665daf668');receipt.inputReceiptSha256=hash(rb);
 const source=join(prior,'verified-source.mp4'),output=join(out,'candidate-320.mp4'),low=join(out,'reference-opus-low.opus');
 await verified(source,candidate.source.sha256,candidate.source.bytes);receipt.source=candidate.source;receipt.sourceProbe=await probe(source);receipt.encoder=await encoderIdentity(control.signal,candidate);
 // No input copy and all FFmpeg output/pass files are inside out. Reserve both
 //60MiB outputs,64MiB pass logs,24MiB frames and8MiB receipts before encoding.
 const reserve=(60+60+64+24+8)*1024*1024;assert.ok(await account()+reserve<=diskCap,'Full worst-case reservation');const fs=await statfs(out);assert.ok(fs.bavail*fs.bsize>=reserve,'Free disk reservation');
 assert.ok(deadline-Date.now()>=450000,'Enough time for single video+audio jobs');receipt.videoEncodeAttempts=1;await save();
 receipt.encoding=await encodeSample(source,output,out,receipt.sourceProbe,control.signal,()=>{},candidate);
 const bytes=await readFile(output);assert.ok(bytes.length<=cap);const p=await probe(output);receipt.output={sha256:hash(bytes),bytes:bytes.length,metadata:validateOutput({...receipt.sourceProbe,format:{...receipt.sourceProbe.format,duration:String(sampleDuration)}},p,candidate),probe:p,measurement:measureMp4(bytes)};const videoProbe=p.streams.find(s=>s.codec_type==='video');assert.equal(videoProbe.sample_aspect_ratio,candidate.encoding.sar,'Explicit encoded SAR');assert.equal(videoProbe.display_aspect_ratio,candidate.encoding.dar,'Explicit displayed DAR');assert.equal(Number(videoProbe.nb_frames),1980,'Exact sample frame count');receipt.budget=budget(receipt.output.measurement);await decode(output);receipt.output.fullDecode=true;await save();
 receipt.audioReferenceAttempts=1;receipt.audioReferenceArguments=lowArguments(source,low);await save();const audioStart=Date.now();await runBounded('/usr/bin/ffmpeg',receipt.audioReferenceArguments,{signal:control.signal,timeout:remaining(120000),outputPath:low,limit:cap});
 const lb=await readFile(low);assert.ok(lb.length<=cap);const lp=await probe(low);assert.equal(lp.streams.length,1);assert.equal(lp.streams[0].codec_name,'opus');assert.equal(lp.streams[0].channels,1);assert.ok(Math.abs(Number(lp.format.duration)-sampleDuration)<=.25);await decode(low);receipt.audioReference={sha256:hash(lb),bytes:lb.length,probe:lp,elapsedMs:Date.now()-audioStart,fullDecode:true,qualityAcceptance:'pending actual listening; Opus decoded48k does not imply8k input bandwidth is48k'};
 receipt.frames=[];for(const at of [5,18.2,31.4]){const path=join(out,`candidate-${at}s.jpg`);await runBounded('/usr/bin/ffmpeg',['-nostdin','-v','error','-ss',String(at),'-i',output,'-frames:v','1','-q:v','2',path],{signal:control.signal,timeout:remaining(),outputPath:path,limit:2*1024*1024});const f=await readFile(path);receipt.frames.push({at,originalSourceTime:at<13.2?at+5:at<26.4?at-13.2+35:at-26.4+65,bytes:f.length,sha256:hash(f),file:`candidate-${at}s.jpg`});}
 receipt.comparison={compactBytes:2547817,compactSha256:'47c822e37c918eb5a45d3f052481336676d987db69a3ea393eee91b6174d80f8',sampleNotFullFile:true,comparisonWarning:'39.6-second sample bytes cannot be compared as a full-file saving against79.2-second compact',remaining:'Matched source/compact frames and motion, audio Low listening floor, A/V synchronization and browser playback. No quality win claimed.'};
 control.signal.throwIfAborted();await account();receipt.status=receipt.budget.accepted?'measured-independent-review-required':'measured-budget-rejected';
}catch(e){receipt.status='failed-no-retry';receipt.error=String(e);process.exitCode=1;}
finally{clearTimeout(timer);clearInterval(monitor);while(monitoring)await new Promise(r=>setTimeout(r,10));if(control.signal.aborted||Date.now()>=deadline||monitorFailure){receipt.status='failed-no-retry';receipt.error=monitorFailure||String(control.signal.reason||'Shared deadline exceeded');process.exitCode=1;}receipt.cleanup={passFiles:(await readdir(out)).filter(n=>n.startsWith('pass')),scope:'encodeDelivery removes pass files in finally; workflow removes owned container'};if(receipt.cleanup.passFiles.length){receipt.status='failed-no-retry';receipt.error='Pass files remain';process.exitCode=1;}receipt.finishedAt=new Date().toISOString();receipt.elapsedMs=Date.now()-start;await save();}
