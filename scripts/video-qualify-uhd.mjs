import {mkdir,writeFile,readdir,stat,readFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {resolve,join,isAbsolute} from 'node:path';
import assert from 'node:assert/strict';
import {acquireUhd} from './video-uhd-acquire.mjs';
import {uhdInput,UHD_TARGETS,UHD_DISK_LIMIT} from './video-uhd-policy.mjs';
const input=uhdInput(process.env),commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.match(process.env.REVIEWED_COMMIT||'',/^[a-f0-9]{40}$/);assert.equal(commit,process.env.REVIEWED_COMMIT);
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','Qualification requires clean checkout');
if(process.env.UHD_SOURCE_MODE==='retained')assert.ok(process.env.UHD_SOURCE_FILE&&isAbsolute(process.env.UHD_SOURCE_FILE),'Retained mode requires nonempty absolute UHD_SOURCE_FILE');
const image=JSON.parse(execFileSync('docker',['image','inspect','fia-video-proof'],{encoding:'utf8',maxBuffer:1048576}))[0];assert.equal(image.Config?.Labels?.['org.opencontainers.image.revision'],commit,'Build image from reviewed commit with revision label');
const out=resolve(process.argv[2]||'target-qualification'),sourceDir=join(out,'input');await mkdir(sourceDir,{recursive:true});
const receipt={status:'running',reviewedCommit:commit,input,originRequests:0,targets:[],diskLimit:UHD_DISK_LIMIT,containerLimits:{cpus:4,memoryBytes:8*1024**3,tmpfsBytes:1408*1024**2},startedAt:new Date().toISOString(),imageId:image.Id,scope:'UHD Linux qualification only; no deploy, public cache or browser proof; disk accounts evidence plus container tmpfs, excludes preexisting source and Docker images'};
await writeFile(join(out,'uhd-started.json'),JSON.stringify(receipt),{flag:'wx'});
let active=false,child,expired=false,checking=false;const deadline=Date.now()+26*60000;
const save=()=>writeFile(join(out,'uhd-qualification.json'),JSON.stringify(receipt,null,2)+'\n');
const stop=()=>{child?.kill('SIGKILL');if(active){execFileSync('docker',['rm','-f','fia-video-proof'],{timeout:10000,stdio:'ignore'});active=false;}};
async function usage(dir){let total=0;for(const e of await readdir(dir,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const path=join(dir,e.name);total+=e.isDirectory()?await usage(path):(await stat(path)).size;}return total;}
const monitor=setInterval(async()=>{if(checking)return;checking=true;try{
 const retained=await usage(out),accounted=retained+(active?receipt.containerLimits.tmpfsBytes:0);receipt.peakAccountedDiskBytes=Math.max(receipt.peakAccountedDiskBytes||0,accounted);if(accounted>UHD_DISK_LIMIT||Date.now()>deadline){expired=true;stop();}
 if(active){const sample=execFileSync('docker',['stats','--no-stream','--format','{{json .}}','fia-video-proof'],{timeout:10000,encoding:'utf8'}).trim();if(sample)(receipt.resourceSamples??=[]).push(JSON.parse(sample));}
}catch(error){receipt.monitorError=String(error);expired=true;try{stop();}catch{}}finally{checking=false;}},2000);
try{
 await save();const began=Date.now();
 receipt.acquisition=await acquireUhd(input,join(sourceDir,'source.mp4'),{sourceFile:process.env.UHD_SOURCE_FILE,signal:AbortSignal.timeout(120000)});
 receipt.originRequests=receipt.acquisition.originRequests;receipt.acquisitionMs=Date.now()-began;await writeFile(join(sourceDir,'input.json'),JSON.stringify(input));

 for(const size of UHD_TARGETS){
  assert.ok(!expired&&deadline-Date.now()>650000);assert.ok(await usage(out)+receipt.containerLimits.tmpfsBytes+300*1024**2<=UHD_DISK_LIMIT);
  const dir=join(out,size);await mkdir(dir);active=true;
  await new Promise((res,rej)=>{child=spawn('docker',['run','--name','fia-video-proof','--network','none','--read-only','--memory','8g','--memory-swap','8g','--cpus','4','--pids-limit','256','--tmpfs','/tmp:rw,size=1408m','-e','REVIEWED_COMMIT='+commit,'-v',`${sourceDir}:/input:ro`,'-v',`${dir}:/evidence`,'-v',`${process.cwd()}:/proof:ro`,'fia-video-proof','node','/proof/scripts/video-uhd-run.mjs',size],{stdio:'inherit'});child.once('error',rej);child.once('close',code=>{child=undefined;code===0?res():rej(Error('UHD container exit '+code));});});
  const state=JSON.parse(execFileSync('docker',['inspect','fia-video-proof'],{encoding:'utf8',maxBuffer:1048576}))[0].State;receipt.targets.push({size,state,receipt:JSON.parse(await readFile(join(dir,'receipt.json')))});assert.equal(state.OOMKilled,false);assert.equal(state.ExitCode,0);await save();stop();
 }
 assert.equal(expired,false);receipt.status='measured-independent-review-required';
}catch(error){receipt.status='failed-no-retry';receipt.error=String(error);process.exitCode=1;}
finally{clearInterval(monitor);while(checking)await new Promise(r=>setTimeout(r,20));try{stop();}catch(error){receipt.cleanupError=String(error);receipt.status='failed-no-retry';process.exitCode=1;}receipt.finishedAt=new Date().toISOString();await save();}
