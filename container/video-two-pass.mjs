// Experimental qualification recipe builder. No delivery preset is selected here.
export function twoPassArguments(plan,{source,output,prefix,id,fps,pass}){
 const candidate=plan.candidates.find(c=>c.id===id);
 if(!candidate||![1,2].includes(pass)||!Number.isFinite(fps)||fps<=0||fps>120)throw Error('Unsupported qualification recipe');

 const common=['-nostdin','-hide_banner','-y','-protocol_whitelist','file,pipe','-i',source,'-map','0:v:0','-vf',`scale=${candidate.width}:${candidate.height}:flags=lanczos`,'-c:v','libx264','-preset',plan.preset,'-pix_fmt','yuv420p','-b:v',String(candidate.encoderRequestBps??plan.encoderRequestBps),'-maxrate',String(plan.maxrateBps),'-bufsize',String(plan.bufferBits),'-g',String(Math.round(fps*candidate.gopSeconds)),'-keyint_min',String(plan.minKeyint),'-sc_threshold',String(candidate.scenecut),'-passlogfile',prefix];
 return pass===1?[...common,'-pass','1','-an','-f','null','/dev/null']:[...common,'-map','0:a:0?','-pass','2','-c:a','aac','-b:a',`${plan.audioKbps}k`,'-ac','2','-movflags','+faststart',output];
}
