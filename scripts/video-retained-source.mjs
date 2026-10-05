// CI-only transport fixture. Production server/runtime has no local-source option.
// Exact approved URL is served from pinned retained bytes; all other fetches fail.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import assert from 'node:assert/strict';
const receiptBytes=await readFile('/prior/benchmark-receipt.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(receiptBytes),'add833e6bb754fb1edbdf7019eebbd8fd54d50ec42aba1d5865775c665daf668');
const contract=JSON.parse(await readFile('/app/video-contract.json'));
const source=await readFile('/prior/verified-source.mp4');assert.equal(source.length,contract.source.bytes);assert.equal(sha(source),contract.source.sha256);
const proof={scope:'CI source transport fixture; real delivery handler/encoder, no origin GET',priorReceiptSha256:sha(receiptBytes),sourceSha256:sha(source),sourceBytes:source.length,requests:0,unexpectedRequests:0};
const save=()=>writeFile('/evidence/source-fixture.json',JSON.stringify(proof,null,2)+'\n');await save();
globalThis.fetch=async(input,options={})=>{
 const url=typeof input==='string'?input:input.url||String(input);
 if(url!==contract.source.url||options.method&&options.method!=='GET'){proof.unexpectedRequests++;await save();throw Error('Unapproved fixture request');}
 if(++proof.requests!==1){await save();throw Error('No fixture retries');}await save();options.signal?.throwIfAborted();
 const stream=createReadStream('/prior/verified-source.mp4');const abort=()=>stream.destroy(Error('Source request cancelled'));options.signal?.addEventListener('abort',abort,{once:true});stream.once('close',()=>options.signal?.removeEventListener('abort',abort));
 return new Response(Readable.toWeb(stream),{status:200,headers:{'Content-Type':'video/mp4','Content-Length':String(source.length)}});
};
