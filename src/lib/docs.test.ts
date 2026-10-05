import { test, expect } from "bun:test";
import { docs, docsSchema, DOCS_REPOSITORY } from "./docs";
import {z} from "zod";
const wrap=(result:any)=>({content:[{type:"text",text:JSON.stringify({result})}]});
const hit={uri:"klappy://docs/one",title:"Title",score:1,snippet:"Match"};
const search={status:"FOUND",data:[hit],total:23,limit:1,offset:2,disclosure_applied:[],filters_applied:{include:["canon"]}};
const output=(r:any)=>JSON.parse(r.content[0].text);
test("default search is floor only and preserves totals/echoes/order",async()=>{
 let request:any;const r=await docs({query:"video"},async a=>{request=a;return wrap(search)});
 expect(request).toEqual({action:"search",input:"video",knowledge_base_url:DOCS_REPOSITORY,disclosure:[],result_grouping:"overlay_first"});
 expect(output(r).result).toEqual(search);expect(output(r).answer).toBeUndefined();expect(output(r).governance_source).toBe("undeclared");
});
test("forwards structural filters and independent flags without local ranking",async()=>{
 let request:any;await docs({query:"x",disclosure:["metadata","blockquote"],audience:["canon","public"],include:["journals"],limit:20,offset:40,public:false},async a=>{request=a;return wrap(search)});
 expect(request.disclosure).toEqual(["metadata","blockquote"]);expect(request.audience).toEqual(["canon","public"]);expect(request.offset).toBe(40);expect(request.public).toBe(false);expect(request.include).toEqual(["journals"]);
});
test("single URI get defaults body; explicit narrower disclosure preserved",async()=>{
 for(const disclosure of [undefined,[]] as any[]){let calls=0;await docs({query:hit.uri,action:"get",disclosure},async a=>{calls++;expect(a.disclosure).toEqual(disclosure??["body"]);return wrap({status:"FOUND",data:{...hit,...(disclosure===undefined?{body:"Full"}:{}),content_hash:"opaque"}})});expect(calls).toBe(1);}
});
test("upstream cap and forbidden disclosure errors remain structured",async()=>{
 const error={status:"ERROR",error_code:"DISCLOSURE_FLAG_NOT_PERMITTED",requested_flag:"body"};
 const r=await docs({query:"x",disclosure:["body"]},async()=>wrap(error));expect(r.isError).toBe(true);expect(output(r).result).toEqual(error);
});
test("legacy depth2/3 never calls upstream; depth1 remains floor",async()=>{
 for(const depth of ["2","3"] as const){const r=await docs({query:"x",depth},async()=>{throw Error("must not call")});expect(output(r).result.error_code).toBe("DEPTH_MIGRATION_REQUIRED");}
 expect(output(await docs({query:"x",depth:"1"},async()=>wrap(search))).result).toEqual(search);
 expect(output(await docs({query:"x",depth:"1",disclosure:["metadata"]},async()=>wrap(search))).result.error_code).toBe("DEPTH_CONFLICT");
});
test("get rejects multiple URIs and search-only filters",async()=>{
 for(const args of [{query:hit.uri+" "+hit.uri,action:"get" as const},{query:hit.uri,action:"get" as const,limit:2}])expect((await docs(args,async()=>{throw Error("no call")})).isError).toBe(true);
});
test("no hits differ from failure; opt-in aliases retain canonical data",async()=>{
 expect(output(await docs({query:"x"},async()=>wrap({...search,data:[],total:0}))).result.total).toBe(0);
 expect((await docs({query:"x"},async()=>{throw Error("secret")})).isError).toBe(true);
 const r=output(await docs({query:"x",include_legacy_envelope:true},async()=>wrap(search)));expect(r.answer).toBe("Match");expect(r.result).toEqual(search);expect(r.deeper).toEqual([]);
});
test("malformed and oversized responses fail closed",async()=>{
 for(const raw of [wrap({status:"FOUND",data:{}}),{content:[{type:"text",text:"bad"}]},wrap({...search,data:[{...hit,snippet:"x".repeat(300000)}]})])expect((await docs({query:"x"},async()=>raw)).isError).toBe(true);
});
test("shared deadline aborts hanging upstream",async()=>{
 let signal:AbortSignal|undefined;const r=await docs({query:"x"},async(_,s)=>{signal=s;return new Promise(()=>{});},5);expect(r.isError).toBe(true);expect(signal!.aborted).toBe(true);
});
test("public schema exposes progressive controls and rejects invalid arguments",()=>{
 const schema=z.object(docsSchema);expect(schema.parse({query:"x"}).action).toBe("search");expect(schema.safeParse({query:"x",disclosure:["full"]}).success).toBe(false);expect(schema.safeParse({query:"x",limit:501}).success).toBe(false);
});

test("unavailable bound knowledge base cannot masquerade as valid fallback",async()=>{
 for(const flags of [{knowledge_base_error:"missing"},{debug:{knowledge_base_error:"missing"}}]) {
  const raw={content:[{type:"text",text:JSON.stringify({result:search,...flags})}]};
  const r=await docs({query:"x"},async()=>raw);expect(output(r).result.error_code).toBe("DOCS_UNAVAILABLE");
 }
});
test("invalid identities and unrequested disclosure fail closed",async()=>{
 for(const entry of [{title:"missing URI"},{uri:"x"},{...hit,body:"forbidden"},{...hit,metadata:{hidden:true}},{...hit,summary:"unrequested"}]) {
  expect((await docs({query:"x"},async()=>wrap({...search,data:[entry]}))).isError).toBe(true);
 }
});
