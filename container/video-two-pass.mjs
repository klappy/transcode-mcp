// Experimental qualification recipe builder. No delivery preset is selected here.
export function twoPassArguments(plan,{source,output,prefix,kbps,fps,pass}){
 if(!plan.videoKbps.includes(kbps)||![1,2].includes(pass)||!Number.isFinite(fps)||fps<=0||fps>120)throw Error('Unsupported qualification recipe');
 const maximum=kbps*plan.maxrateMultiplier;
 const common=['-nostdin','-hide_banner','-y','-protocol_whitelist','file,pipe','-i',source,'-map','0:v:0','-vf',`scale=1280:${plan.encodeHeight}:flags=lanczos`,'-c:v','libx264','-preset',plan.preset,'-pix_fmt','yuv420p','-b:v',`${kbps}k`,'-maxrate',`${maximum}k`,'-bufsize',`${maximum*plan.bufferSeconds}k`,'-g',String(Math.round(fps*plan.gopSeconds)),'-keyint_min',String(plan.minKeyint),'-sc_threshold',String(plan.scenecut),'-passlogfile',prefix];
 return pass===1?[...common,'-pass','1','-an','-f','null','/dev/null']:[...common,'-map','0:a:0?','-pass','2','-c:a','aac','-b:a',`${plan.audioKbps}k`,'-ac','2','-movflags','+faststart',output];
}
