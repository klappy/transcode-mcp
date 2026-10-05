import { test, expect } from "bun:test";
import { docs, DOCS_REPOSITORY } from "./docs";
const wrap=(data:any,status="FOUND")=>({content:[{type:"text",text:JSON.stringify({result:{status,data}})}]});
const hits=[1,2,3,4].map(n=>({uri:`klappy://docs/${n}`,title:`Title ${n}`,snippet:`Snippet ${n}`}));
const result=(r:any)=>JSON.parse(r.content[0].text);
for(const depth of ["1","2","3"] as const) test(`depth ${depth} preserves upstream order and content`,async()=>{
 const calls:any[]=[];
 const r=await docs({query:"video",audience:"headless",depth},async a=>{calls.push(a);return a.action==="search"?wrap(hits):wrap({uri:a.input,body:`Body ${a.input}`,content_hash:"opaque"});});
 expect(r.isError).toBeUndefined();expect(calls.length).toBe(depth==="1"?1:depth==="2"?2:4);
 expect(calls.every(a=>a.knowledge_base_url===DOCS_REPOSITORY)).toBe(true);expect(calls[0].audience).toBe("headless");
 expect(result(r).governance_source).toBe("undeclared");expect(result(r).deeper.length).toBe(depth==="3"?2:0);
});
test("empty results differ from unreachable",async()=>{
 expect(result(await docs({query:"x"},async()=>wrap([],"NOT_FOUND"))).status).toBe("no_hits");
 expect((await docs({query:"x"},async()=>{throw Error("secret")})).isError).toBe(true);
});
test("malformed and oversized envelopes fail closed",async()=>{
 for(const raw of [wrap({hits:[]}),{content:[{type:"text",text:"bad"}]},wrap([{uri:"x",title:"y",snippet:"x".repeat(300000)}])])expect((await docs({query:"x"},async()=>raw)).isError).toBe(true);
});
test("shared deadline aborts a hanging upstream",async()=>{
 let signal:AbortSignal|undefined;const r=await docs({query:"x"},async(_,s)=>{signal=s;return new Promise(()=>{});},5);
 expect(r.isError).toBe(true);expect(signal!.aborted).toBe(true);
});
test("failed top get cannot masquerade as a complete result",async()=>{
 expect((await docs({query:"x",depth:"2"},async a=>a.action==="search"?wrap(hits):wrap({uri:"wrong",body:"text"}))).isError).toBe(true);
});
