import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {acquireUhd} from './video-uhd-acquire.mjs';
test('retained local acquisition verifies bytes/hash with zero origin requests and no fallback',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'uhd-acquire-'));try{
  const body=Buffer.from('existing owned bytes'),sourceFile=join(dir,'source'),input={url:'https://cdn.fiaguide.app/identity.mp4',bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};await writeFile(sourceFile,body);
  const fetchImpl=()=>{throw Error('Offline path must never fetch');};
  assert.deepEqual(await acquireUhd(input,join(dir,'copy'),{sourceFile,fetchImpl}),{mode:'retained-local',originRequests:0,bytes:body.length,sha256:input.sha256});assert.deepEqual(await readFile(join(dir,'copy')),body);
  await assert.rejects(acquireUhd({...input,sha256:'a'.repeat(64)},join(dir,'bad'),{sourceFile,fetchImpl}));
  await assert.rejects(acquireUhd({...input,bytes:body.length+1},join(dir,'wrongsize'),{sourceFile,fetchImpl}));
  await symlink(sourceFile,join(dir,'link'));await assert.rejects(acquireUhd(input,join(dir,'linked'),{sourceFile:join(dir,'link'),fetchImpl}));
  await assert.rejects(acquireUhd(input,join(dir,'missing'),{sourceFile:join(dir,'absent'),fetchImpl}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
