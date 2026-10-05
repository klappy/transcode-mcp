import {readFile,readdir,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runBounded} from '../../container/video.mjs';
import {candidate,passArguments} from './policy.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function encodeSample(input,output,dir,sourceProbe,signal,phase=()=>{},contract=candidate){
 const e=contract.encoding,v=sourceProbe.streams.find(s=>s.codec_type==='video');
 if(v?.width!==1280||v?.height!==720||v?.avg_frame_rate!=='50/1')throw Error('Unqualified source geometry/cadence');
 const prefix=join(dir,'pass'),start=Date.now(),passes=[],statistics=[];
 const local=AbortSignal.any([signal,AbortSignal.timeout(contract.limits.encodeMs)]);
 try{
  for(const pass of [1,2]){
   const remaining=contract.limits.encodeMs-(Date.now()-start);if(remaining<=0)throw Error('Combined encode deadline');let log='',spawned=false,reported=false;const began=Date.now();
   await runBounded('/usr/bin/ffmpeg',passArguments(input,output,prefix,pass),{timeout:remaining,signal:local,outputPath:pass===1?'/dev/null':output,limit:pass===1?contract.limits.passlogFileBytes:contract.limits.bytes,onSpawn:()=>{spawned=true;},onClose:({outcome})=>phase('encode-exited',{pass,outcome}),onStderr:b=>{log=(log+b.toString()).slice(-contract.limits.stderrBytes);if(spawned&&!reported&&/frame=\s*[1-9]\d*/.test(log)){reported=true;phase('encode-spawned',{pass});}}});
   const settings=pass===1?(await readFile(prefix+'-0.log','utf8')).split('\n')[0]:log;
   for(const token of [`bitrate=${Math.floor(e.videoBps/1000)}`,`vbv_maxrate=${Math.floor(e.maxrateBps/1000)}`,`vbv_bufsize=${Math.floor(e.bufferBits/1000)}`,`keyint=${e.keyint}`,`scenecut=${e.scenecut}`,pass===1?'rc=abr':'rc=2pass'])if(!settings.includes(token))throw Error('Unconfirmed encoder setting '+token);
   let total=0;for(const name of (await readdir(dir)).filter(n=>n.startsWith('pass'))){if(!/^pass-0\.log(?:\.mbtree)?(?:\.temp)?$/.test(name))throw Error('Unexpected statistics file');const length=(await stat(join(dir,name))).size;if(length>contract.limits.passlogFileBytes)throw Error('Statistics file ceiling');total+=length;}if(total>contract.limits.passlogTotalBytes)throw Error('Statistics aggregate ceiling');
   passes.push({pass,elapsedMs:Date.now()-began,settingsSha256:hash(settings),appliedSettings:pass===1?settings:undefined});
  }
  for(const name of (await readdir(dir)).filter(n=>n.startsWith('pass'))){const bytes=await readFile(join(dir,name));statistics.push({name,bytes:bytes.length,sha256:hash(bytes)});}
  local.throwIfAborted();return {passes,statistics,elapsedMs:Date.now()-start};
 }finally{for(const name of (await readdir(dir)).filter(n=>n.startsWith('pass')))await rm(join(dir,name),{force:true});}
}
