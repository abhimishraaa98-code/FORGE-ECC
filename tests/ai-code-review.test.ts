import {describe,it,expect,vi} from "vitest";
import {mkdtemp,writeFile,symlink,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {generateAIReview} from "../src/core/ai-code-review.js";
import type {AgentProvider} from "../src/core/orchestrator.js";
import type {CodeReviewReport} from "../src/core/code-review.js";
const base:CodeReviewReport={root:process.cwd(),generatedAt:new Date().toISOString(),scope:"source-files",base:"HEAD",filesReviewed:["package.json"],findings:[],summary:{high:0,medium:0,low:0},warnings:[]};
describe("AI code review",()=>{
 it("accepts only structured suggestions for supplied files",async()=>{
  const provider:AgentProvider={name:"test",complete:vi.fn(async()=>({provider:"test",model:"mock",content:JSON.stringify({suggestions:[{file:"package.json",line:1,severity:"low",title:"Check config",explanation:"Potential concern",recommendation:"Verify it",confidence:"medium",patch:"--- a/package.json\n+++ b/package.json\n@@ -1 +1 @@\n- old\n+ new"},{file:"secret.ts",line:1,severity:"high",title:"Invented",explanation:"x",recommendation:"x",confidence:"high"},{file:"package.json",line:1,severity:"low",title:"Bad patch",explanation:"x",recommendation:"x",confidence:"low",patch:"--- a/other.ts\\n+++ b/other.ts\\n@@ -1 +1 @@"}]})}))};
  const result=await generateAIReview(base,provider);expect(result.suggestions).toHaveLength(2);expect(result.suggestions[0]?.file).toBe("package.json");expect(result.suggestions[0]?.patch).toContain("@@ -1 +1 @@");expect(result.suggestions[1]?.patch).toBeUndefined();
 });
 it("does not read paths outside the project or symlinks escaping it",async()=>{
  const parent=await mkdtemp(path.join(tmpdir(),"forge-ai-review-"));
  const root=path.join(parent,"project");
  await import("node:fs/promises").then(fs=>fs.mkdir(root));
  await writeFile(path.join(parent,"outside.txt"),"SECRET OUTSIDE CONTENT");
  await symlink(path.join(parent,"outside.txt"),path.join(root,"linked.txt"));
  let submitted="";
  const provider:AgentProvider={name:"boundary-test",async complete(request){submitted=request.task.prompt;return {provider:"boundary-test",content:'{"suggestions":[]}'};}};
  try{
   const report={...base,root,filesReviewed:["../outside.txt","linked.txt"]};
   const result=await generateAIReview(report,provider);
   expect(submitted).not.toContain("SECRET OUTSIDE CONTENT");
   expect(result.suggestions).toHaveLength(0);
   expect(result.warnings.join(" ")).toContain("file path(s) were skipped");
  }finally{await rm(parent,{recursive:true,force:true});}
 });

 it("rejects out-of-range lines, invalid fields, and duplicate findings",async()=>{
  const provider:AgentProvider={name:"strict",complete:vi.fn(async()=>({provider:"strict",content:JSON.stringify({suggestions:[
   {file:"package.json",line:99999,severity:"high",title:"Out of range",explanation:"x",recommendation:"x",confidence:"high"},
   {file:"package.json",line:1,severity:"critical",title:"Invalid severity",explanation:"x",recommendation:"x",confidence:"high"},
   {file:"package.json",line:1,severity:"low",title:" ",explanation:"x",recommendation:"x",confidence:"high"},
   {file:"package.json",line:1,severity:"low",title:"Duplicate",explanation:"First",recommendation:"Verify",confidence:"medium"},
   {file:"package.json",line:1,severity:"low",title:" duplicate ",explanation:"Second",recommendation:"Verify",confidence:"medium"}
  ]})}))};
  const result=await generateAIReview(base,provider);
  expect(result.suggestions).toHaveLength(1);
  expect(result.suggestions[0]?.title).toBe("Duplicate");
 });
 it("rejects oversized provider responses before parsing",async()=>{
  const provider:AgentProvider={name:"oversized",complete:vi.fn(async()=>({provider:"oversized",content:" ".repeat(128_001)}))};
  await expect(generateAIReview(base,provider)).rejects.toThrow("exceeded the 128 KB review limit");
 });
 it("rejects malformed provider output",async()=>{
  const provider:AgentProvider={name:"bad",complete:vi.fn(async()=>({provider:"bad",content:"not json"}))};
  await expect(generateAIReview(base,provider)).rejects.toThrow("not valid JSON");
 });
});
