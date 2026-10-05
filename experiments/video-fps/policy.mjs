import assert from 'node:assert/strict';
export function requireJobCapacity(plan,{remainingMs,diskBytes}) {
 assert.ok(remainingMs>=plan.limits.jobMs+plan.limits.cleanupMs,'Insufficient shared deadline reserve');
 assert.ok(diskBytes+plan.limits.fileBytes+plan.limits.passlogTotalBytes+1048576<=plan.limits.diskBytes,'Insufficient disk reserve');
}
export function fpsArguments(builder,contract,{source,output,prefix,pass,fps}) {
 assert.ok([25,50].includes(fps),'Only reviewed cadence');
 const selected=structuredClone(contract);selected.encoding.keyint=30*fps;
 const args=builder(source,output,prefix,pass,selected);
 if(fps===25){const i=args.indexOf('-vf');assert.ok(i>=0);args[i+1]+=',fps=fps=25:round=near';}
 return args;
}
export function qualifyFpsPair(left,right,target=439024){
 const a=left.tracks.find(t=>t.type==='vide'),b=right.tracks.find(t=>t.type==='vide'),aa=left.tracks.find(t=>t.type==='soun'),ab=right.tracks.find(t=>t.type==='soun');
 assert.ok(a&&b&&aa&&ab,'Required video and AAC measurements');
 const nominal=target*Math.min(a.duration,b.duration)/8,reasons=[];
 if(Math.abs(a.duration-b.duration)>.05)reasons.push('video-duration');
 for(const [name,t]of [['50',a],['25',b]])if(Math.abs(t.bytes*8/t.duration-target)>target*.05)reasons.push(name+':rate-target');
 if(Math.abs(a.bytes-b.bytes)>nominal*.01)reasons.push('video-pair-mismatch');
 if(aa.payloadSha256!==ab.payloadSha256||aa.samples!==ab.samples||aa.duration!==ab.duration)reasons.push('audio-identity');
 return{accepted:!reasons.length,reasons,nominalVideoBytes:nominal,pairDifferenceBytes:Math.abs(a.bytes-b.bytes)};
}
