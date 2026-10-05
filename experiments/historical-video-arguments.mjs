// Frozen pre-cap argument builder for historical manual experiments only. Not imported by delivery runtime.
import {validateGeometryContract} from "../container/video.mjs";
export function deliveryPassArguments(input,output,prefix,pass,contract){
 const e=contract.encoding;validateGeometryContract(e);if(![1,2].includes(pass))throw Error('Invalid pass');
 const common=['-nostdin','-hide_banner','-y','-protocol_whitelist','file,pipe','-i',input,'-map','0:v:0','-vf',`scale=${e.width}:${e.height}:flags=lanczos${e.sar?',setsar='+e.sar.replace(':','/')+':max=65535':''}`,'-c:v','libx264','-preset',e.preset,'-pix_fmt','yuv420p','-b:v',String(e.videoBps),'-maxrate',String(e.maxrateBps),'-bufsize',String(e.bufferBits),'-g',String(e.keyint),'-keyint_min',String(e.minKeyint),'-sc_threshold',String(e.scenecut),'-passlogfile',prefix];
 return pass===1?[...common,'-pass','1','-an','-f','null','/dev/null']:[...common,'-map','0:a:0?','-pass','2','-c:a','aac','-b:a',e.audioBps?String(e.audioBps):`${e.audioKbps}k`,'-ac',String(e.audioChannels||2),...(e.audioBps?['-ar','48000']:[]),'-movflags','+faststart',output];
}
