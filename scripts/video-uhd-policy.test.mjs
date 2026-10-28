import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uhdInput,verifyUhdProbe} from './video-uhd-policy.mjs';
const valid={UHD_SOURCE_URL:'https://s3.amazonaws.com/cbbt-er.public/master.mp4',UHD_SOURCE_SHA256:'a'.repeat(64),UHD_SOURCE_BYTES:'226599540',UHD_SOURCE_DURATION:'79.168'};
test('UHD qualification requires complete pinned bounded input and unchanged host policy',()=>{
 assert.equal(uhdInput(valid).bytes,226599540);
 assert.equal(uhdInput({...valid,UHD_SOURCE_BYTES:'226599540'}).bytes,226599540);
 for(const key of Object.keys(valid))assert.throws(()=>uhdInput({...valid,[key]:''}));
 for(const bytes of ['0','-1','268435457','Infinity','1.5'])assert.throws(()=>uhdInput({...valid,UHD_SOURCE_BYTES:bytes}));
 for(const url of ['https://s3.amazonaws.com.evil/cbbt-er.public/a','https://evil.test/master.mp4',valid.UHD_SOURCE_URL+'?x=1'])assert.throws(()=>uhdInput({...valid,UHD_SOURCE_URL:url}));
 assert.throws(()=>uhdInput({...valid,UHD_SOURCE_DURATION:'601'}));
});
test('source proof requires genuine pinned4K50 master rather than an upscaled proxy claim',()=>{
 const input=uhdInput(valid),probe={streams:[{codec_type:'video',width:3840,height:2160,sample_aspect_ratio:'1:1',avg_frame_rate:'50/1',r_frame_rate:'50/1'}],format:{duration:'79.168'}};
 verifyUhdProbe(probe,input);
 assert.throws(()=>verifyUhdProbe({...probe,streams:[{...probe.streams[0],width:1616}]},input));
 assert.throws(()=>verifyUhdProbe({...probe,format:{duration:80}},input));
 for(const duration of [undefined,'nan','Infinity',0])assert.throws(()=>verifyUhdProbe({...probe,format:{duration}},input));
 for(const change of [{sample_aspect_ratio:'2:1'},{tags:{rotate:90}},{side_data_list:[{rotation:-90}]}])assert.throws(()=>verifyUhdProbe({...probe,streams:[{...probe.streams[0],...change}]},input));
});
test('existing qualification preserves retained artifact gate while UHD uses separate explicit mode in same workflow',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/video-qualification.yml',import.meta.url),'utf8');
 assert.match(workflow,/artifact-ids: 11321498762/);assert.match(workflow,/inputs.mode != 'uhd'/);assert.match(workflow,/inputs.mode == 'uhd'/);
 assert.match(workflow,/node scripts\/video-qualify-targets.mjs/);assert.match(workflow,/node scripts\/video-qualify-uhd.mjs/);
 assert.doesNotMatch(workflow,/wrangler deploy/);
});
