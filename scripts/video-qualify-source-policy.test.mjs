import {test,expect} from 'bun:test';
import {assertBlob,assertSource,assertContainer,assertReceipt,PIN} from './video-qualify-source-policy.mjs';
const clone=structuredClone;
const image={Id:'sha256:actual',Config:{Labels:{'org.opencontainers.image.revision':PIN.commit}}};
const container={Image:image.Id,State:{ExitCode:0,Running:false,OOMKilled:false},HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,NanoCpus:4000000000,Memory:8589934592,MemorySwap:8589934592,PidsLimit:256,Tmpfs:{'/tmp':'rw,size=1408m'}},Mounts:[{Destination:'/input',RW:false},{Destination:'/proof.mjs',RW:false}]};
test('proof evidence refuses wrong image, running/OOM container and isolation/resource drift',()=>{
 expect(()=>assertContainer(container,image)).not.toThrow();
 const mutations=[c=>c.Image='other',c=>c.State.Running=true,c=>c.State.OOMKilled=true,c=>c.State.ExitCode=1,c=>c.HostConfig.NetworkMode='bridge',c=>c.HostConfig.ReadonlyRootfs=false,c=>c.HostConfig.MemorySwap*=2,c=>c.HostConfig.NanoCpus=8000000000,c=>c.Mounts[0].RW=true];
 for(const mutate of mutations){const c=clone(container);mutate(c);expect(()=>assertContainer(c,image)).toThrow();}
});
test('proof cannot accept substitute harness or approved-source bytes',()=>{
 expect(()=>assertBlob(Buffer.from('substitute'))).toThrow();expect(()=>assertSource(Buffer.alloc(PIN.bytes))).toThrow();expect(()=>assertSource(Buffer.alloc(1))).toThrow();
});
test('synthetic, wrong-source or incomplete encode receipts cannot pass as the original proof',()=>{
 const r={status:'measured-source-container-review-required',reviewedCommit:PIN.commit,source:{bytes:PIN.bytes,sha256:PIN.sha256},sourceTransportRequests:1,originRequests:0,rejectedSpoofSources:3,cleanupVerified:true,metadata:{sourceBytes:PIN.bytes,sourceSha256:PIN.sha256,width:1280,height:720,encoding:{passes:[{pass:1},{pass:2}],elapsedMs:300000}}};
 expect(()=>assertReceipt(r)).not.toThrow();
 for(const mutate of [v=>v.originRequests=1,v=>v.source.sha256='other',v=>v.reviewedCommit='other',v=>v.cleanupVerified=false,v=>v.metadata.encoding.passes.pop(),v=>v.metadata.encoding.elapsedMs=300001]){const v=clone(r);mutate(v);expect(()=>assertReceipt(v)).toThrow();}
});
