// CI-only exact retained source transport. Never copied into production image.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const input=JSON.parse(await readFile('/input/input.json'));
assert.equal((await stat('/input/source.mp4')).size,input.bytes);
const digest=createHash('sha256');for await(const b of createReadStream('/input/source.mp4'))digest.update(b);assert.equal(digest.digest('hex'),input.sha256);
const proof={requests:0,unexpectedRequests:0,sourceSha256:input.sha256,sourceBytes:input.bytes,scope:'Verified retained source transport; origin acquisition recorded separately'};
const save=()=>writeFile('/evidence/transport.json',JSON.stringify(proof));await save();
globalThis.fetch=async(value,options={})=>{
 const url=typeof value==='string'?value:value.url||String(value);
 if(url!==input.url||(options.method&&options.method!=='GET')){proof.unexpectedRequests++;await save();throw Error('Unexpected source request');}
 if(++proof.requests!==1){await save();throw Error('No source retry');}await save();options.signal?.throwIfAborted();
 const body=createReadStream('/input/source.mp4');const abort=()=>body.destroy(Error('Source aborted'));options.signal?.addEventListener('abort',abort,{once:true});body.once('close',()=>options.signal?.removeEventListener('abort',abort));
 return new Response(Readable.toWeb(body),{status:200,headers:{'content-length':String(input.bytes)}});
};
