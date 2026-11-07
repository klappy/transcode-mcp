// One test-only adapter for the already reviewed PR112 runtime and harness.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
export const PIN=Object.freeze({commit:'652d536c8b64903dc01ba09a4b9ab034cce6797c',harness:'3cea8143d87aa57dd73535ab10e1b8f6297e41e4',url:'https://cdn.3dreview.app/overview/5d92d72d3946/3D-Review-120s-Raphael-narrated-draft.mp4',bytes:3574594,sha256:'5d92d72d3946bad622cee72b5bdebc8029e43cced4e9b01e4e65b4d6ada4d059'});
const sha=b=>createHash('sha256').update(b).digest('hex');
export function assertBlob(bytes){assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),PIN.harness,'Harness Git identity');}
export function assertSource(bytes){assert.equal(bytes.length,PIN.bytes);assert.equal(sha(bytes),PIN.sha256,'Approved original identity');}
export function assertContainer(c,image){
 assert.equal(image.Config.Labels['org.opencontainers.image.revision'],PIN.commit);
 assert.equal(c.Image,image.Id);assert.equal(c.State.ExitCode,0);assert.equal(c.State.Running,false);assert.equal(c.State.OOMKilled,false);
 const h=c.HostConfig;assert.equal(h.NetworkMode,'none');assert.equal(h.ReadonlyRootfs,true);assert.equal(h.NanoCpus,4000000000);
 assert.equal(h.Memory,8589934592);assert.equal(h.MemorySwap,8589934592);assert.equal(h.PidsLimit,256);assert.deepEqual(h.Tmpfs,{'/tmp':'rw,size=1408m'});
 for(const path of ['/input','/proof.mjs'])assert.equal(c.Mounts.find(m=>m.Destination===path)?.RW,false);
}
export function assertReceipt(r){
 assert.equal(r.status,'measured-source-container-review-required');assert.equal(r.reviewedCommit,PIN.commit);
 assert.equal(r.source.bytes,PIN.bytes);assert.equal(r.source.sha256,PIN.sha256);
 assert.equal(r.sourceTransportRequests,1);assert.equal(r.originRequests,0);assert.equal(r.rejectedSpoofSources,3);assert.equal(r.cleanupVerified,true);
 assert.deepEqual(r.metadata.encoding.passes.map(p=>p.pass),[1,2]);assert.ok(r.metadata.encoding.elapsedMs<=300000);
 assert.equal(r.metadata.sourceSha256,PIN.sha256);assert.equal(r.metadata.sourceBytes,PIN.bytes);assert.equal(r.metadata.width,1280);assert.equal(r.metadata.height,720);
}
async function main(){
 const runtime=resolve(process.argv[2]),out=resolve(process.argv[3]),name='transcode-3d-proof';
 await mkdir(out,{recursive:true});const receipt={status:'running',runtimeCommit:PIN.commit,orchestrationCommit:process.env.GITHUB_SHA,startedAt:new Date().toISOString()};
 const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',timeout:120000,maxBuffer:1048576,...options});
 const save=()=>writeFile(join(out,'qualification.json'),JSON.stringify(receipt,null,2)+'\n');
 let owned=false;
 try{
  await save();assert.equal(process.env.REVIEWED_COMMIT,PIN.commit);assert.equal(process.versions.node.split('.')[0],'22');
  assert.equal(run('git',['rev-parse','HEAD'],{cwd:runtime}).trim(),PIN.commit);
  run('git',['diff','--exit-code'],{cwd:runtime});run('git',['diff','--cached','--exit-code'],{cwd:runtime});
  assert.equal(run('git',['ls-files','--others','--','container'],{cwd:runtime}).trim(),'','Untracked Docker build inputs');
  run('docker',['info']);assert.equal(run('docker',['ps','-aq','--filter',`name=^/${name}$`]).trim(),'','Existing container is not ours');
  // Exactly one ordinary source acquisition. Redirects, retries and fallback are forbidden.
  const response=await fetch(PIN.url,{redirect:'error',signal:AbortSignal.timeout(120000)});assert.equal(response.status,200);
  assert.equal(Number(response.headers.get('content-length')),PIN.bytes);
  const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;assert.ok(total<=PIN.bytes);chunks.push(chunk);}
  const source=Buffer.concat(chunks);assertSource(source);const input=join(out,'input');await mkdir(input);await writeFile(join(input,'approved-original.mp4'),source,{flag:'wx'});
  const blobResponse=await fetch(`https://api.github.com/repos/klappy/transcode-mcp/git/blobs/${PIN.harness}`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(30000)});
  assert.equal(blobResponse.status,200);const blob=await blobResponse.json();assert.equal(blob.encoding,'base64');const harness=Buffer.from(blob.content,'base64');assertBlob(harness);const measuredDir=join(out,'encode');await mkdir(measuredDir);const harnessPath=join(out,'proof.mjs');await writeFile(harnessPath,harness,{flag:'wx'});
  const buildLog=openSync(join(out,'build.log'),'wx');try{run('docker',['build','--label',`org.opencontainers.image.revision=${PIN.commit}`,'-t',name,join(runtime,'container')],{timeout:600000,stdio:['ignore',buildLog,buildLog]});}finally{closeSync(buildLog);}
  const image=JSON.parse(run('docker',['image','inspect',name]))[0];await writeFile(join(out,'image-inspect.json'),JSON.stringify(image,null,2));
  const encodeLog=openSync(join(out,'harness-run.log'),'wx');let result;owned=true;
  try{result=spawnSync('docker',['run','--name',name,'--network','none','--read-only','--cpus','4','--memory','8g','--memory-swap','8g','--pids-limit','256','--tmpfs','/tmp:rw,size=1408m','--mount',`type=bind,src=${input},dst=/input,readonly`,'--mount',`type=bind,src=${measuredDir},dst=/evidence`,'--mount',`type=bind,src=${harnessPath},dst=/proof.mjs,readonly`,'--env',`REVIEWED_COMMIT=${PIN.commit}`,'--entrypoint','node',image.Id,'/proof.mjs'],{timeout:660000,killSignal:'SIGKILL',stdio:['ignore',encodeLog,encodeLog]});}finally{closeSync(encodeLog);}
  receipt.exitStatus=result.status;receipt.signal=result.signal;assert.equal(result.error,undefined);assert.equal(result.status,0);
  const c=JSON.parse(run('docker',['inspect',name]))[0];await writeFile(join(out,'container-inspect.json'),JSON.stringify(c,null,2));assertContainer(c,image);
  const measured=JSON.parse(await readFile(join(measuredDir,'receipt.json'),'utf8'));assertReceipt(measured);
  const output=await readFile(join(measuredDir,'output.mp4'));assert.equal(output.length,measured.metadata.bytes);assert.equal(sha(output),measured.metadata.sha256);
  receipt.image=image.Id;receipt.output={bytes:output.length,sha256:sha(output)};receipt.status='passed-offline-independent-acceptance-required';
 }catch(error){receipt.status='failed-no-retry';receipt.error=String(error);process.exitCode=1;}
 finally{
  if(owned){try{await writeFile(join(out,'final-container-inspect.json'),run('docker',['inspect',name]));run('docker',['rm','-f',name]);assert.equal(run('docker',['ps','-aq','--filter',`name=^/${name}$`]).trim(),'');receipt.containerRemoved=true;}catch(error){receipt.status='failed-no-retry';receipt.cleanupError=String(error);process.exitCode=1;}}
  receipt.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify(receipt));
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
