// Runs inside the existing encoder image, against its actual lazy HTTP handler.
import {spawn} from 'node:child_process';
import {readFile,writeFile,open,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {selectLazyVideoContract,deriveLazyContract,validateLazyOutput} from '/app/video-lazy.mjs';
import {runBounded} from '/app/video.mjs';
import {verifyUhdProbe,UHD_TARGETS} from '/proof/scripts/video-uhd-policy.mjs';
const size=process.argv[2];assert.ok(UHD_TARGETS.includes(size));
const input=JSON.parse(await readFile('/input/input.json')),contract=selectLazyVideoContract(input.url,size);assert.ok(contract);
const receipt={status:'running',size,input,contract,reviewedCommit:process.env.REVIEWED_COMMIT,startedAt:new Date().toISOString(),scope:'Actual container lazy handler; retained source. Public Worker/R2/browser and perceived quality remain separate.'};
const start=Date.now(),signal=AbortSignal.timeout(contract.limits.jobMs+30000);
let server,logs='';
const probe=async path=>JSON.parse((await runBounded('/usr/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{signal})).toString());
try{
 const sourceProbe=await probe('/input/source.mp4');verifyUhdProbe(sourceProbe,input);receipt.sourceProbe=sourceProbe;
 server=spawn(process.execPath,['--import','/proof/scripts/video-uhd-transport.mjs','/app/server.mjs'],{stdio:['ignore','pipe','pipe']});
 const capture=b=>{logs=(logs+b).slice(-1048576);};server.stdout.on('data',capture);server.stderr.on('data',capture);
 let encoder;
 for(let n=0;n<30;n++){
  try{const r=await fetch('http://127.0.0.1:8080/video-lazy-info?source_url='+encodeURIComponent(input.url)+'&size='+size,{signal:AbortSignal.any([signal,AbortSignal.timeout(2000)])});if(r.status!==200)throw Error('Info status '+r.status);encoder=await r.json();break;}catch(error){if(n===29)throw error;await new Promise(r=>setTimeout(r,500));}
 }
 assert.match(encoder.revision,/^[a-f0-9]{64}$/);receipt.encoder=encoder;
 const began=Date.now();const response=await fetch('http://127.0.0.1:8080/video-lazy-transcode',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source_url:input.url,size,recipe:contract.recipe,encoderRevision:encoder.revision}),signal});
 if(response.status!==200)throw Error('Encode HTTP'+response.status+': '+(await response.text()).slice(0,500));
 const meta=JSON.parse(response.headers.get('x-video-metadata'));receipt.metadata=meta;
 assert.equal(meta.sourceSha256,input.sha256);assert.equal(meta.sourceBytes,input.bytes);assert.equal(meta.encoderRevision,encoder.revision);assert.equal(meta.recipe,contract.recipe);
 const fd=await open('/evidence/output.mp4','wx'),hash=createHash('sha256');let bytes=0;
 try{for await(const b of response.body){bytes+=b.length;assert.ok(bytes<=contract.limits.bytes);hash.update(b);let at=0;while(at<b.length){const w=await fd.write(b,at,b.length-at);assert.ok(w.bytesWritten);at+=w.bytesWritten;}}}finally{await fd.close();}
 assert.equal(bytes,meta.bytes);assert.equal(hash.digest('hex'),meta.sha256);assert.equal(Number(response.headers.get('content-length')),bytes);
 const outputProbe=await probe('/evidence/output.mp4'),derived=deriveLazyContract(contract,sourceProbe.streams.find(s=>s.codec_type==='video'));receipt.outputProbe=outputProbe;
 validateLazyOutput(sourceProbe,outputProbe,derived);
 const target={'1080p':[1920,1080],'3k':[3072,1728],'4k':[3840,2160]}[size],video=outputProbe.streams.find(s=>s.codec_type==='video');assert.deepEqual([video.width,video.height],target);assert.equal(video.sample_aspect_ratio,'1:1');
 assert.deepEqual(meta.encoding.passes.map(p=>p.pass),[1,2]);assert.ok(meta.encoding.elapsedMs<=contract.limits.encodeMs);
 assert.ok(meta.encoding.statistics.every(s=>s.bytes<=contract.limits.passlogFileBytes));assert.ok(meta.encoding.statistics.reduce((n,s)=>n+s.bytes,0)<=contract.limits.passlogTotalBytes);
 for(const ratio of [.1,.5,.9])await runBounded('/usr/bin/ffmpeg',['-nostdin','-v','error','-ss',String(input.duration*ratio),'-i','/evidence/output.mp4','-frames:v','1','-y',`/evidence/frame-${ratio}.png`],{signal,outputPath:`/evidence/frame-${ratio}.png`,limit:8388608});
 receipt.transport=JSON.parse(await readFile('/evidence/transport.json'));assert.equal(receipt.transport.requests,1);assert.equal(receipt.transport.unexpectedRequests,0);
 let pending;for(let n=0;n<30;n++){pending=(await readdir('/tmp')).filter(x=>x.startsWith('fia-video-'));if(!pending.length)break;await new Promise(r=>setTimeout(r,100));}assert.deepEqual(pending,[]);
 receipt.handlerMs=Date.now()-began;receipt.cleanupVerified=true;receipt.status='measured-review-required';
}catch(error){receipt.status='failed';receipt.error=String(error);process.exitCode=1;}
finally{if(server){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('close',r)),new Promise(r=>setTimeout(r,2000))]);if(server.exitCode===null)server.kill('SIGKILL');}receipt.elapsedMs=Date.now()-start;receipt.finishedAt=new Date().toISOString();await writeFile('/evidence/server.log',logs);await writeFile('/evidence/receipt.json',JSON.stringify(receipt,null,2)+'\n');}
