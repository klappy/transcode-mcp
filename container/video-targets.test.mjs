import {test,expect} from 'bun:test';
import {contract,selectVideoContract,deliveryPassArguments,validateOutput} from './video.mjs';
const value=(args,key)=>args[args.indexOf(key)+1];
test('three target arguments apply revised video rates while retaining audio and geometry',()=>{
 const rows=[['small',864,480,300000,42667,1,'80:81'],['medium',960,544,379688,54000,2,'136:135'],['large',1280,720,658536,96000,2,'1:1']];
 for(const [size,w,h,v,a,ch,sar] of rows){const c=selectVideoContract(contract.source.url,size);const args=deliveryPassArguments('i','o','p',2,c);expect(value(args,'-b:v')).toBe(String(v));expect(value(args,'-b:a')).toBe(size==='large'?'96k':String(a));expect(value(args,'-ac')).toBe(String(ch));expect(value(args,'-vf')).toBe(`scale=${w}:${h}:flags=lanczos${sar?',setsar='+sar.replace(':','/')+':max=65535':''}`);expect(value(args,'-g')).toBe('1500');expect(args).not.toContain('-r');}
 expect(selectVideoContract(contract.source.url,'large')).toBe(contract);expect(selectVideoContract(contract.source.url,'__proto__')).toBeUndefined();
});
test('lower targets reject mismatched raster SAR cadence and audio channels before publication',()=>{
 const c=selectVideoContract(contract.source.url,'small');const source={streams:[{codec_type:'video',width:1280,height:720},{codec_type:'audio'}],format:{duration:'79.153'}};const out={streams:[{codec_type:'video',codec_name:'h264',pix_fmt:'yuv420p',width:864,height:480,avg_frame_rate:'50/1',sample_aspect_ratio:'80:81',display_aspect_ratio:'16:9'},{codec_type:'audio',codec_name:'aac',channels:1,sample_rate:'48000'}],format:{duration:'79.168'}};expect(validateOutput(source,out,c).width).toBe(864);
 for(const [stream,key,val] of [[0,'width',852],[0,'sample_aspect_ratio','1:1'],[0,'display_aspect_ratio',undefined],[0,'display_aspect_ratio','4:3'],[0,'avg_frame_rate','25/1'],[1,'channels',2],[1,'sample_rate','44100']]){const changed=structuredClone(out);changed.streams[stream][key]=val;expect(()=>validateOutput(source,changed,c)).toThrow();}
});

test('quality revision pins exact average class peak buffer and does not claim prior qualification',()=>{
 const rows={small:[300000,300000,600000,1200000],medium:[379688,379688,759375,1518750],large:[658536,675000,1350000,2700000]};
 for(const [size,expected] of Object.entries(rows)){const c=selectVideoContract(contract.source.url,size),e=c.encoding;expect([e.videoBps,e.classBps,e.maxrateBps,e.bufferBits]).toEqual(expected);expect(e.fps).toBe(50);expect(e.qualificationRevision).toBeUndefined();expect(c.recipe).toBe('fia-video@4-'+size);for(const pass of [1,2]){const a=deliveryPassArguments('i','o','p',pass,c);expect(value(a,'-maxrate')).toBe(String(expected[2]));expect(value(a,'-bufsize')).toBe(String(expected[3]));}}
});

test('aspect validation rejects aligned but visibly distorted contracts and missing output DAR',async()=>{const {validateGeometryContract}=await import('./video.mjs');for(const size of ['small','medium','large']){const c=selectVideoContract(contract.source.url,size);expect(()=>validateGeometryContract(c.encoding)).not.toThrow();for(const delta of [{sar:'1:2'},{dar:'4:3'},{sar:undefined},{width:c.encoding.width+2}])expect(()=>validateGeometryContract({...c.encoding,...delta})).toThrow();}});
