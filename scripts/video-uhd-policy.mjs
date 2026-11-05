import {isApprovedVideoSource} from '../container/video-sources.mjs';
export const UHD_TARGETS=Object.freeze(['1080p','3k','4k']);
export const UHD_DISK_LIMIT=4*1024**3;
export function uhdInput(env){
 const url=env.UHD_SOURCE_URL,sha256=env.UHD_SOURCE_SHA256,bytes=Number(env.UHD_SOURCE_BYTES),duration=Number(env.UHD_SOURCE_DURATION);
 if(!isApprovedVideoSource(url))throw Error('Source must pass unchanged runtime host policy');
 if(!/^[a-f0-9]{64}$/.test(sha256||''))throw Error('Pinned SHA256 required');
 if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>256*1024**2)throw Error('UHD source must be positive and <=256MiB');
 if(!Number.isFinite(duration)||duration<=0||duration>600)throw Error('Pinned duration must be >0 and <=600 seconds');
 return {url,sha256,bytes,duration};
}
export function verifyUhdProbe(probe,input){
 const v=probe.streams?.find(s=>s.codec_type==='video'),duration=Number(probe.format?.duration);
 const rotation=Number(v?.side_data_list?.find(s=>s.rotation!==undefined)?.rotation??v?.tags?.rotate??0);
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(rotation)||rotation%360!==0||v?.sample_aspect_ratio!=='1:1')throw Error('UHD source must have finite duration, square pixels and upright landscape');
 if(v?.width!==3840||v?.height!==2160||v?.avg_frame_rate!=='50/1'||v?.r_frame_rate!=='50/1'||Math.abs(duration-input.duration)>.25)throw Error('Expected pinned genuine3840x2160/50fps master');
}
