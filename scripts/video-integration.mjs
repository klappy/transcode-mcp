// Real Linux container proof. One approved source acquisition by the container;
// this client never downloads the source separately. No deployment or R2 writes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const contract=JSON.parse(await readFile(new URL('../container/video-contract.json',import.meta.url)));
const output=resolve(process.argv[2]||'video-evidence');await mkdir(output,{recursive:true});
const receipt={status:'running',scope:'Actual Linux container encode; browser/range/R2 acceptance remains separate',startedAt:new Date().toISOString(),source:contract.source,recipe:contract.recipe};
const controller=new AbortController();let expired=false;const timer=setTimeout(()=>{expired=true;controller.abort();},600000);
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
try{
 await save();
 const boundedProbe=`import {runBounded} from '/app/video.mjs';import {stat} from 'node:fs/promises';import assert from 'node:assert/strict';const path='/evidence/limit-test.bin';await assert.rejects(runBounded('/usr/local/bin/node',['-e',"require('fs').writeFileSync(process.argv[1],Buffer.alloc(2*1024*1024))",path],{outputPath:path,limit:1024}));assert.ok((await stat(path)).size<=1024);console.log('prlimit rapid-write rejection passed');`;
 receipt.fileSizeLimitProof=execFileSync('docker',['exec','fia-video-proof','node','--input-type=module','-e',boundedProbe],{timeout:30000,maxBuffer:1048576}).toString();
 let info;
 for(let n=0;n<30;n++){
  try{const r=await fetch('http://127.0.0.1:8080/video-info',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3000)])});if(r.status===200){info=await r.json();break;}}catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 assert.match(info?.revision||'',/^[a-f0-9]{64}$/);receipt.encoder=info;
 const response=await fetch('http://127.0.0.1:8080/video-transcode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source_url:contract.source.url,recipe:contract.recipe,encoderRevision:info.revision}),signal:controller.signal});
 if(response.status!==200)throw Error(`Encode status ${response.status}: ${(await response.text()).slice(0,300)}`);
 assert.equal(response.headers.get('Content-Type'),'video/mp4');
 const meta=JSON.parse(response.headers.get('X-Video-Metadata'));receipt.metadata=meta;
 assert.equal(meta.sourceSha256,contract.source.sha256);assert.equal(meta.sourceBytes,contract.source.bytes);assert.equal(meta.encoderRevision,info.revision);assert.equal(meta.recipe,contract.recipe);
 const parts=[];let size=0;for await(const part of response.body){size+=part.length;assert.ok(size<=contract.limits.bytes);parts.push(part);}const bytes=Buffer.concat(parts);assert.equal(size,meta.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);await writeFile(join(output,'output.mp4'),bytes);
 const probe=JSON.parse(execFileSync('docker',['exec','fia-video-proof','/usr/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json','/evidence/output.mp4'],{timeout:30000,maxBuffer:1048576}).toString());receipt.probe=probe;
 const video=probe.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');assert.equal(video.width,1280);assert.equal(video.height,720);assert.ok(Math.abs(Number(probe.format.duration)-79.153)<=.25);assert.equal(Number(probe.format.duration),meta.duration);assert.deepEqual(meta.rights,contract.source.provenance);
 for(const second of [10,40,70])execFileSync('docker',['exec','fia-video-proof','/usr/bin/ffmpeg','-nostdin','-v','error','-ss',String(second),'-i','/evidence/output.mp4','-frames:v','1','-y',`/evidence/frame-${second}.png`],{timeout:30000,maxBuffer:1048576});
 assert.equal(expired,false);receipt.status='passed';
}catch(e){receipt.status='failed';receipt.error=String(e);process.exitCode=1;}
finally{clearTimeout(timer);if(expired){receipt.status='failed';receipt.error='Ten-minute proof deadline exceeded';process.exitCode=1;}receipt.finishedAt=new Date().toISOString();await save();}
