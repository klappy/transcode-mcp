import {open,lstat} from 'node:fs/promises';
import {createReadStream,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Test-only transport. URL stays the real runtime identity even for local bytes.
export async function acquireUhd(input,target,{sourceFile,signal,fetchImpl=(...args)=>fetch(...args)}={}){
 let body,originRequests=0;
 if(sourceFile){
  const info=await lstat(sourceFile);assert.ok(info.isFile()&&!info.isSymbolicLink(),'Retained source must be a regular file');assert.equal(info.size,input.bytes);
  body=createReadStream(sourceFile,{flags:constants.O_RDONLY|constants.O_NOFOLLOW,signal});
 }else{
  originRequests=1;const response=await fetchImpl(input.url,{redirect:'error',signal});assert.equal(response.status,200);assert.ok(response.body);if(response.headers.has('content-length'))assert.equal(Number(response.headers.get('content-length')),input.bytes);body=response.body;
 }
 const fd=await open(target,'wx'),digest=createHash('sha256');let bytes=0;
 try{for await(const b of body){signal?.throwIfAborted();bytes+=b.length;assert.ok(bytes<=input.bytes,'Source exceeds pinned bytes');digest.update(b);let at=0;while(at<b.length){const w=await fd.write(b,at,b.length-at);assert.ok(w.bytesWritten);at+=w.bytesWritten;}}}finally{await fd.close();}
 assert.equal(bytes,input.bytes);assert.equal(digest.digest('hex'),input.sha256);
 return {mode:sourceFile?'retained-local':'public-get',originRequests,bytes,sha256:input.sha256};
}
