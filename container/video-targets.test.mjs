import {test,expect} from 'bun:test';
import {contract,selectVideoContract,deliveryPassArguments,validateOutput} from './video.mjs';
const value=(args,key)=>args[args.indexOf(key)+1];
test('three target arguments preserve baseline and derive proportional audio/geometry',()=>{
 const rows=[['small',854,480,200000,42667,1,'1280:1281'],['medium',960,540,253125,54000,2,'1:1'],['large',1280,720,439024,96000,2,null]];
 for(const [size,w,h,v,a,ch,sar] of rows){const c=selectVideoContract(contract.source.url,size);const args=deliveryPassArguments('i','o','p',2,c);expect(value(args,'-b:v')).toBe(String(v));expect(value(args,'-b:a')).toBe(size==='large'?'96k':String(a));expect(value(args,'-ac')).toBe(String(ch));expect(value(args,'-vf')).toBe(`scale=${w}:${h}:flags=lanczos${sar?',setsar='+sar.replace(':','/')+':max=65535':''}`);expect(value(args,'-g')).toBe('1500');expect(args).not.toContain('-r');}
 expect(selectVideoContract(contract.source.url,'large')).toBe(contract);expect(selectVideoContract(contract.source.url,'__proto__')).toBeUndefined();
});
test('lower targets reject mismatched raster SAR cadence and audio channels before publication',()=>{
 const c=selectVideoContract(contract.source.url,'small');const source={streams:[{codec_type:'video',width:1280,height:720},{codec_type:'audio'}],format:{duration:'79.153'}};const out={streams:[{codec_type:'video',codec_name:'h264',pix_fmt:'yuv420p',width:854,height:480,avg_frame_rate:'50/1',sample_aspect_ratio:'1280:1281'},{codec_type:'audio',codec_name:'aac',channels:1,sample_rate:'48000'}],format:{duration:'79.168'}};expect(validateOutput(source,out,c).width).toBe(854);
 for(const [stream,key,val] of [[0,'width',852],[0,'sample_aspect_ratio','1:1'],[0,'avg_frame_rate','25/1'],[1,'channels',2],[1,'sample_rate','44100']]){const changed=structuredClone(out);changed.streams[stream][key]=val;expect(()=>validateOutput(source,changed,c)).toThrow();}
});
