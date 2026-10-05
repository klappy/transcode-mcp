import {readFile,writeFile,mkdir,readdir,stat,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {TARGETS,LIMIT,admit} from './video-qualification-policy.mjs';
const out=resolve(process.argv[2]||'target-qualification'),prior=join(out,'prior');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.match(process.env.REVIEWED_COMMIT||'',/^[a-f0-9]{40}$/);assert.equal(commit,process.env.REVIEWED_COMMIT);
const started=Date.now(),deadline=started+1800000;let expired=false,child;
const receipt={status:'running',reviewedCommit:commit,startedAt:new Date(started).toISOString(),sourceOriginRequests:0,targets:[],scope:'One explicit three-target comparison; actual tier delivery qualification remains separate'};
await mkdir(out,{recursive:true});const marker=join(out,'qualification-started.json');await writeFile(marker,JSON.stringify({commit,started}),{flag:'wx'});
const save=()=>writeFile(join(out,'qualification.json'),JSON.stringify(receipt,null,2)+'\n');
async function usage(dir){let total=0;for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isSymbolicLink())throw Error('Unexpected qualification symlink');total+=e.isDirectory()?await usage(path):(await stat(path)).size;}return total;}
const stop=()=>{child?.kill('SIGKILL');try{execFileSync('docker',['rm','-f','fia-video-proof'],{timeout:10000,stdio:'ignore'});}catch{}};
const run=(command,args,extra={})=>new Promise((res,rej)=>{if(expired)return rej(Error('Shared deadline exceeded'));child=spawn(command,args,{stdio:'inherit',env:{...process.env,FIA_QUALIFICATION_DEADLINE:String(deadline)},...extra});child.once('error',rej);child.once('exit',(code,signal)=>{child=undefined;code===0?res():rej(Error(`Qualification child ${code}/${signal}`));});});
const timer=setTimeout(()=>{expired=true;stop();},1800000);let checking=false;
const monitor=setInterval(async()=>{if(checking)return;checking=true;try{const used=await usage(out);receipt.peakRetainedBytes=Math.max(receipt.peakRetainedBytes||0,used);if(used>LIMIT){receipt.diskFailure=true;expired=true;stop();}}catch(e){receipt.monitorError=String(e);expired=true;stop();}finally{checking=false;}},500);
try{
 await save();const evidence=await readFile(join(prior,'benchmark-receipt.json'));assert.equal(createHash('sha256').update(evidence).digest('hex'),'add833e6bb754fb1edbdf7019eebbd8fd54d50ec42aba1d5865775c665daf668');const source=await readFile(join(prior,'verified-source.mp4'));assert.equal(source.length,49851846);assert.equal(createHash('sha256').update(source).digest('hex'),'257f632552979b05716ca438ab654b7489229f34ca59c6bca22149d3b42f3718');
 for(const size of TARGETS){
  admit({now:Date.now(),deadline,used:await usage(out)});if(expired)throw Error('Shared deadline exceeded');const dir=join(out,size);await mkdir(dir);await copyFile(join(prior,'verified-source.mp4'),join(dir,'verified-source.mp4'),1);await writeFile(join(dir,'acquisition.json'),JSON.stringify({status:'verified',assetId:'a13',originRequests:0,scope:'Exact retained source; no origin fallback'}));
  const image=execFileSync('docker',['image','inspect','fia-video-proof'],{timeout:10000,maxBuffer:1048576});await writeFile(join(dir,'image.json'),image);
  await run('docker',['run','-d','--name','fia-video-proof','-e','FIA_PROOF_ASSET=a13','-p','127.0.0.1:8080:8080','-v',`${dir}:/evidence`,'-v',`${process.cwd()}:/proof:ro`,'fia-video-proof','node','--import','/proof/scripts/video-retained-source.mjs','/app/server.mjs']);
  try{await run(process.execPath,['scripts/video-integration.mjs',dir,'a13',size]);const measured=JSON.parse(await readFile(join(dir,'receipt.json')));receipt.targets.push({size,status:measured.status,receiptSha256:createHash('sha256').update(await readFile(join(dir,'receipt.json'))).digest('hex'),bytes:measured.metadata?.bytes,sha256:measured.metadata?.sha256,timings:measured.timings});await save();}
  finally{try{await writeFile(join(dir,'container.log'),execFileSync('docker',['logs','fia-video-proof'],{timeout:10000,maxBuffer:1048576}));}finally{stop();}}
 }
 assert.equal(expired,false);assert.equal(receipt.targets.length,3);receipt.status='measured-independent-review-required';
}catch(e){receipt.status='failed-no-retry';receipt.error=String(e);process.exitCode=1;}
finally{clearTimeout(timer);clearInterval(monitor);while(checking)await new Promise(r=>setTimeout(r,10));if(expired){receipt.status='failed-no-retry';receipt.error=receipt.error||'Shared deadline or disk ceiling';process.exitCode=1;stop();}receipt.finishedAt=new Date().toISOString();receipt.elapsedMs=Date.now()-started;await save();}
