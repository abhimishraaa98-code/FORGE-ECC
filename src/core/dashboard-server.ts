import { createServer, type Server } from "node:http";
import { inspectProject } from "./project-inspector.js";
import { mapArchitecture } from "./architecture-map.js";
import { decideTaskApproval, listRuns, loadRun } from "./run-store.js";
import { loadAgentRegistry } from "./agent-registry.js";
import { auditProject } from "./quality-audit.js";
import { listVerifications } from "./verification-history.js";
import { generateProjectHealth } from "./project-health.js";
import { listReviews } from "./review-history.js";
import { generateRegressionReport } from "./regression-intelligence.js";
import { listWorkspaceDirectory, readWorkspaceFile } from "./workspace-browser.js";
import { searchWorkspace } from "./code-search.js";

const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#090b10"><title>FORGE — Engineering Workbench</title>
<style>
:root{color-scheme:dark;--bg:#090b10;--panel:#11151e;--panel2:#151b27;--line:#252d3b;--muted:#8e9aab;--text:#edf2f8;--accent:#a3e635;--cyan:#67e8f9}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 75% -15%,#1c2935 0,transparent 38%),var(--bg);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}
.shell{max-width:1440px;margin:auto;padding:28px 34px}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:22px}.brand{display:flex;gap:13px;align-items:center}.mark{width:42px;height:42px;border:1px solid #52652e;background:#18220f;color:var(--accent);display:grid;place-items:center;border-radius:12px;font-weight:900;font-size:19px;letter-spacing:-2px}.brand strong{font-size:17px;letter-spacing:2px}.brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:.4px}.status{color:var(--accent);font-size:12px;border:1px solid #3d5127;padding:6px 10px;border-radius:30px}.hero{padding:36px 0 25px}.eyebrow{color:var(--accent);font-size:11px;letter-spacing:2px;font-weight:700}.hero h1{font-size:clamp(27px,4vw,42px);line-height:1.1;letter-spacing:-1.5px;margin:8px 0}.hero p{color:var(--muted);margin:0;max-width:680px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:linear-gradient(145deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:15px;padding:18px;min-width:0}.metric-label{color:var(--muted);font-size:12px}.metric{font-size:30px;font-weight:700;letter-spacing:-1px;margin-top:5px}.metric-sub{color:#718094;font-size:11px;margin-top:2px}.section{margin-top:24px}.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.section h2{font-size:15px;margin:0;letter-spacing:.2px}.muted{color:var(--muted)}.columns{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.list{display:grid;gap:10px}.rowitem{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #202734}.rowitem:last-child{border:0}.rowitem b{font-weight:600}.pill{font-size:10px;border:1px solid var(--line);border-radius:20px;padding:3px 8px;color:#c3cedb;white-space:nowrap}.barline{height:6px;background:#252d3b;border-radius:10px;margin-top:7px;overflow:hidden}.barline span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--cyan));border-radius:10px}.run{padding:13px 0;border-bottom:1px solid #202734}.run:last-child{border:0}.run-title{display:flex;justify-content:space-between;gap:12px}.run-goal{font-weight:600;overflow-wrap:anywhere}.run-meta{color:var(--muted);font-size:11px;margin-top:4px}.activity{display:grid;gap:9px}.activity-item{display:grid;grid-template-columns:10px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid #202734}.activity-dot{width:8px;height:8px;margin-top:6px;border-radius:50%;background:#8e9aab}.activity-dot.completed{background:var(--accent)}.activity-dot.failed,.activity-dot.blocked{background:#fb7185}.activity-dot.awaiting_approval{background:#fbbf24}.activity-dot.running{background:var(--cyan)}.task-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.task-card{border:1px solid var(--line);border-radius:9px;padding:10px;background:#0d131c}.task-card b{display:block;font-size:12px}.task-card small{display:block;color:var(--muted);margin-top:4px}.activity-toolbar{display:flex;gap:8px;align-items:center}.run{cursor:pointer;border-radius:7px;padding-left:8px;padding-right:8px}.run:hover{background:#192231}.run.selected{outline:1px solid var(--accent)}.inspector{display:grid;gap:12px}.inspector-task{border:1px solid var(--line);border-radius:10px;padding:13px;background:#0d131c}.inspector-task pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#cbd5e1;font:12px/1.6 ui-monospace,monospace;margin:10px 0 0}.approval{border-color:#7c5a1d;background:#211b10}.approval-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.btn.approve{border-color:#526c2e;color:#c7f78a}.btn.reject{border-color:#78404a;color:#fda4af}.approval-audit{font-size:11px;color:var(--muted);margin-top:8px}.empty{padding:25px 10px;text-align:center;color:var(--muted)}.actions{display:flex;gap:8px}.btn{background:#1a222e;color:var(--text);border:1px solid #354154;border-radius:9px;padding:8px 12px;font:inherit;font-size:12px;cursor:pointer}.btn:hover{border-color:var(--accent)}.architecture{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px}.graph-wrap{border:1px solid var(--line);border-radius:12px;background:#0c1119;overflow:hidden;margin-bottom:14px}.graph-wrap svg{display:block;width:100%;height:360px}.graph-edge{stroke:#405064;stroke-width:1.4;opacity:.8}.graph-node{fill:#182331;stroke:#8da4bc;stroke-width:1.5;cursor:pointer}.graph-node.entry{stroke:var(--accent);stroke-width:2.5}.graph-node.selected{fill:#34451f;stroke:var(--accent);stroke-width:3}.graph-label{fill:var(--text);font-size:10px;pointer-events:none}.graph-hint,.graph-detail{padding:10px 12px;color:var(--muted);font-size:12px;overflow-wrap:anywhere}.graph-hint{border-top:1px solid var(--line)}.node{background:#151c28;border:1px solid #2b3748;border-radius:9px;padding:10px;font-size:11px;overflow-wrap:anywhere}.node small{display:block;color:var(--muted);margin-top:4px}.footer{margin:28px 0 5px;padding-top:15px;border-top:1px solid var(--line);color:#718094;font-size:11px;display:flex;justify-content:space-between;gap:10px}.error{color:#fca5a5}.loading{color:var(--muted);padding:15px 0}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.columns{grid-template-columns:1fr}}@media(max-width:560px){.shell{padding:18px 15px}.top{align-items:flex-start}.status{font-size:10px}.grid{gap:9px}.card{padding:14px}.metric{font-size:25px}.hero{padding:28px 0 20px}.footer{flex-direction:column}}
</style></head>
<body><main class="shell">
<header class="top"><div class="brand"><div class="mark">F.</div><div><strong>FORGE</strong><small>THE AI ENGINEERING WORKBENCH</small></div></div><div class="status">● LOCAL WORKSPACE</div></header>
<section class="hero"><div class="eyebrow">ENGINEERING CONTROL CENTER / 01</div><h1>Build with context.<br>Ship with confidence.</h1><p>A live overview of your codebase, architecture signals and AI-assisted engineering runs.</p></section>
<section class="grid" id="metrics"><div class="card"><div class="metric-label">Source files</div><div class="metric">—</div><div class="metric-sub">Scanning workspace</div></div><div class="card"><div class="metric-label">Directories</div><div class="metric">—</div><div class="metric-sub">Project structure</div></div><div class="card"><div class="metric-label">Dependencies</div><div class="metric">—</div><div class="metric-sub">Production + development</div></div><div class="card"><div class="metric-label">Saved runs</div><div class="metric">—</div><div class="metric-sub">Local execution history</div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Language composition</h2><span class="pill">PROJECT INTELLIGENCE</span></div><div id="languages" class="list"><div class="loading">Loading language data…</div></div></div><div class="card"><div class="section-head"><h2>Detected stack</h2><span class="pill">ENVIRONMENT</span></div><div id="stack" class="list"><div class="loading">Detecting frameworks…</div></div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Specialist agents</h2><span class="pill">AGENT REGISTRY</span></div><div id="agents"><div class="loading">Loading agent roles…</div></div></div><div class="card"><div class="section-head"><h2>Recent runs</h2><span class="pill">LOCAL HISTORY</span></div><div id="runs"><div class="loading">Loading saved runs…</div></div></div><div class="card"><div class="section-head"><h2>Project signals</h2><span class="pill">INSIGHTS</span></div><div id="signals" class="list"><div class="loading">Collecting project signals…</div></div></div></section>
<section class="section card"><div class="section-head"><h2>Project Health Center</h2><div class="actions"><span class="pill">SNAPSHOT + TRENDS</span><button class="btn" id="refreshHealth">Refresh snapshot</button></div></div><div id="healthPanel" class="list"><div class="loading">Generating project health snapshot…</div></div></section>\n<section class="section columns"><div class="card"><div class="section-head"><h2>Regression intelligence</h2><div class="actions"><span class="pill">VERIFICATION TRENDS</span><button class="btn" id="refreshRegression">Refresh</button></div></div><div id="regressionPanel" class="list"><div class="loading">Comparing saved verification runs…</div></div></div><div class="card"><div class="section-head"><h2>Code review history</h2><div class="actions"><span class="pill">SAVED REVIEWS</span><button class="btn" id="refreshReviews">Refresh</button></div></div><div id="reviewPanel" class="list"><div class="loading">Loading saved review snapshots…</div></div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Engineering quality</h2><span class="pill">STATIC AUDIT</span></div><div id="qualityPanel" class="list"><div class="loading">Loading quality findings…</div></div></div><div class="card"><div class="section-head"><h2>Verification history</h2><span class="pill">REAL COMMAND RESULTS</span></div><div id="verificationPanel" class="list"><div class="loading">Loading verification history…</div></div></div></section>\n<section class="section card"><div class="section-head"><h2>Code search</h2><span class="pill">SYMBOL-AWARE SOURCE SEARCH</span></div><div class="actions"><input id="codeSearchQuery" type="search" placeholder="Search symbols or source text…" style="flex:1;min-width:0;background:#0b1018;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit"><button class="btn" id="codeSearchButton">Search</button></div><div id="codeSearchMeta" class="run-meta">Searches source files only; results open in the workspace preview.</div><div id="codeSearchResults" class="list"><div class="empty">Enter at least two characters to search.</div></div></section>\n<section class="section card"><div class="section-head"><h2>Workspace explorer</h2><span class="pill">SAFE FILE PREVIEW</span></div><div class="columns"><div><div class="actions"><button class="btn" id="workspaceUp">↑ Up</button><span id="workspacePath" class="pill">/</span></div><div id="workspaceFiles" class="list" style="margin-top:10px"><div class="loading">Loading workspace files…</div></div></div><div><div id="workspacePreview" class="inspector"><div class="empty">Select a source file to preview it here.</div></div></div></div></section>
<section class="section card"><div class="section-head"><h2>Run inspector</h2><span id="inspectorLabel" class="pill">SELECT A RUN</span></div><div id="runInspector" class="inspector"><div class="empty">Select a saved run to inspect its task results and approval state.</div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Agent activity</h2><div class="activity-toolbar"><span id="activityUpdated" class="pill">Waiting for data</span><button class="btn" id="refreshActivity">Refresh</button></div></div><div id="activity" class="activity"><div class="loading">Loading task activity…</div></div></div><div class="card"><div class="section-head"><h2>Task status</h2><span class="pill">LATEST RUN</span></div><div id="taskStatus" class="task-grid"><div class="loading">Waiting for a saved run…</div></div></div></section>
<section class="section card"><div class="section-head"><h2>Architecture snapshot</h2><div class="actions"><span class="pill">STATIC IMPORT MAP</span><button class="btn" id="refreshMap">Refresh map</button></div></div><div class="graph-wrap"><svg id="architectureGraph" viewBox="0 0 900 360" role="img" aria-label="Interactive source module dependency graph"><text x="24" y="35" fill="#8e9aab">Loading architecture graph…</text></svg><div class="graph-hint">Select a node to inspect imports and incoming dependencies. Lines represent detected relative imports.</div></div><div id="graphDetail" class="graph-detail">Choose a module in the graph.</div><div id="architecture" class="architecture"></div></section>
<footer class="footer"><span>FORGE v0.26.0 · ENGINEERING INTELLIGENCE</span><span>Read-only dashboard · Data stays on this machine</span></footer>
</main>
<script>
const el=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path){const response=await fetch(path,{headers:{"accept":"application/json"}});if(!response.ok)throw new Error("Request failed ("+response.status+")");return response.json()}
function metric(label,value,sub){return '<div class="card"><div class="metric-label">'+esc(label)+'</div><div class="metric">'+esc(value)+'</div><div class="metric-sub">'+esc(sub)+'</div></div>'}
async function loadOverview(){try{const data=await api("/api/overview");const s=data.summary;el("metrics").innerHTML=metric("Source files",s.filesScanned,"Files inspected")+metric("Directories",s.directoriesScanned,"Project folders")+metric("Dependencies",data.dependencies.production+data.dependencies.development,data.dependencies.production+" production · "+data.dependencies.development+" development")+metric("Saved runs",data.runCount,"Local execution history");
const total=Math.max(1,s.languages.reduce((n,x)=>n+x.files,0));el("languages").innerHTML=s.languages.length?s.languages.slice(0,8).map(x=>'<div><div class="rowitem"><b>'+esc(x.name)+'</b><span class="muted">'+x.files+' files</span></div><div class="barline"><span style="width:'+Math.round(x.files/total*100)+'%"></span></div></div>').join(""):'<div class="empty">No recognized source files found.</div>';
const stack=[...(data.packageManagers||[]),...(data.frameworks||[])];el("stack").innerHTML=stack.length?stack.map(x=>'<div class="rowitem"><b>'+esc(x)+'</b><span class="pill">DETECTED</span></div>').join(""):'<div class="empty">No common stack detected.</div>';
const signals=[["Important files",data.importantFiles.length],["Available scripts",Object.keys(data.scripts).length],["Scan warnings",data.warnings.length],["Architecture candidates","Refresh below"]];el("signals").innerHTML=signals.map(([k,v])=>'<div class="rowitem"><b>'+esc(k)+'</b><span class="pill">'+esc(v)+'</span></div>').join("")+(data.warnings.length?'<div class="error">'+data.warnings.map(esc).join("<br>")+'</div>':"");
}catch(error){el("metrics").innerHTML='<div class="card error">Dashboard error: '+esc(error.message)+'</div>';}}
async function loadAgents(){try{const data=await api("/api/agents");el("agents").innerHTML=data.length?data.map(agent=>'<div class="rowitem"><div><b>'+esc(agent.name)+'</b><div class="run-meta">'+esc(agent.description)+'</div></div><span class="pill">'+esc(agent.source)+'</span></div>').join(""):'<div class="empty">No agent roles found.</div>';}catch(error){el("agents").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function submitApproval(runId,taskId,decision){const reviewer=window.prompt("Reviewer label for the local audit log:","local-user");if(!reviewer)return;const reason=decision==="rejected"?window.prompt("Reason for rejecting this task (optional):")||"":"";try{const response=await fetch("/api/runs/"+encodeURIComponent(runId)+"/tasks/"+encodeURIComponent(taskId)+"/approval",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({taskId,decision,reviewer,reason})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Approval action failed.");await inspectRun(runId);await loadRuns();await loadActivity();}catch(error){el("runInspector").insertAdjacentHTML("afterbegin",'<div class="error">'+esc(error.message)+'</div>');}}
async function inspectRun(id){try{const run=await api("/api/runs/"+encodeURIComponent(id));el("inspectorLabel").textContent=run.id;el("runInspector").innerHTML='<div><b>'+esc(run.goal)+'</b><div class="run-meta">'+esc(run.status)+' · '+esc(new Date(run.createdAt).toLocaleString())+'</div></div>'+run.tasks.map(task=>'<article class="inspector-task '+(task.status==="awaiting_approval"?"approval":"")+'"><div class="run-title"><b>'+esc(task.title)+'</b><span class="pill">'+esc(task.status)+'</span></div><div class="run-meta">'+esc(task.agent)+' · '+esc(task.id)+'</div>'+(task.result?'<pre>'+esc(task.result.content)+'</pre>':"")+(task.error?'<div class="error">'+esc(task.error)+'</div>':"")+(task.approval?'<div class="approval-audit">'+esc(task.approval.decision)+' by '+esc(task.approval.reviewer)+' · '+esc(new Date(task.approval.at).toLocaleString())+(task.approval.reason?' · '+esc(task.approval.reason):"")+'</div>':"")+(task.status==="awaiting_approval"?'<div class="run-meta">Human decision required before this task can proceed.</div><div class="approval-actions"><button class="btn approve" data-approval="approved" data-task="'+esc(task.id)+'">Approve task</button><button class="btn reject" data-approval="rejected" data-task="'+esc(task.id)+'">Reject task</button></div>':"")+'</article>').join("");el("runInspector").querySelectorAll("[data-approval]").forEach(button=>button.addEventListener("click",()=>submitApproval(id,button.getAttribute("data-task"),button.getAttribute("data-approval"))));document.querySelectorAll(".run").forEach(item=>item.classList.toggle("selected",item.getAttribute("data-run-id")===id));}catch(error){el("runInspector").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadRuns(){try{const data=await api("/api/runs");el("runs").innerHTML=data.length?data.slice(0,7).map(run=>'<div class="run" data-run-id="'+esc(run.id)+'" tabindex="0" role="button"><div class="run-title"><span class="run-goal">'+esc(run.goal)+'</span><span class="pill">'+esc(run.status)+'</span></div><div class="run-meta">'+esc(run.id)+' · '+esc(new Date(run.createdAt).toLocaleString())+' · '+run.tasks.length+' tasks</div></div>').join(""):'<div class="empty">No saved runs yet. Create one with <code>forge plan --goal "..."</code>.</div>';el("runs").querySelectorAll("[data-run-id]").forEach(item=>{const select=()=>inspectRun(item.getAttribute("data-run-id"));item.addEventListener("click",select);item.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select();}});});}catch(error){el("runs").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadActivity(){
try{const runs=await api("/api/runs");el("activityUpdated").textContent="Updated "+new Date().toLocaleTimeString();
if(!runs.length){el("activity").innerHTML='<div class="empty">No agent activity yet. Create a plan or run to populate this view.</div>';el("taskStatus").innerHTML='<div class="empty">No tasks recorded.</div>';return;}
const latest=runs[0],events=latest.events||[];
el("activity").innerHTML=events.length?events.slice(-12).reverse().map(event=>'<div class="activity-item"><span class="activity-dot '+esc(event.type)+'"></span><div><b>'+esc(event.type.replaceAll("_"," ")) +'</b><div class="run-meta">'+esc(event.message)+'</div><div class="run-meta">'+esc(event.taskId)+' · '+esc(new Date(event.at).toLocaleTimeString())+'</div></div></div>').join(""):'<div class="empty">Latest run has no recorded events yet.</div>';
el("taskStatus").innerHTML=latest.tasks.length?latest.tasks.map(task=>'<div class="task-card"><b>'+esc(task.title||task.id)+'</b><small>'+esc(task.agent||"Agent")+'</small><span class="pill">'+esc(task.status)+'</span></div>').join(""):'<div class="empty">No tasks recorded.</div>';
}catch(error){el("activity").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
function renderGraph(data){
 const svg=el("architectureGraph"), nodes=data.nodes.slice(0,48), visible=new Set(nodes.map(n=>n.file));
 const width=900,height=360,cx=width/2,cy=height/2,rx=width*.39,ry=height*.36;
 const positions=new Map(nodes.map((n,i)=>[n.file,{x:cx+rx*Math.cos(2*Math.PI*i/Math.max(1,nodes.length)-Math.PI/2),y:cy+ry*Math.sin(2*Math.PI*i/Math.max(1,nodes.length)-Math.PI/2)}]));
 const edges=data.edges.filter(e=>visible.has(e.from)&&visible.has(e.to));
 const edgeMarkup=edges.map(e=>{const a=positions.get(e.from),b=positions.get(e.to);return '<line class="graph-edge" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>';}).join("");
 const nodeMarkup=nodes.map(n=>{const p=positions.get(n.file),label=n.file.split("/").slice(-2).join("/");return '<g data-file="'+esc(n.file)+'"><circle class="graph-node '+(n.role==="entry"?"entry":"")+'" cx="'+p.x+'" cy="'+p.y+'" r="7"/><text class="graph-label" x="'+(p.x+10)+'" y="'+(p.y+3)+'">'+esc(label.length>24?label.slice(-21)+"…":label)+'</text></g>';}).join("");
 svg.innerHTML=edgeMarkup+nodeMarkup;
 svg.querySelectorAll("g[data-file]").forEach(group=>group.addEventListener("click",()=>{svg.querySelectorAll(".graph-node").forEach(n=>n.classList.remove("selected"));group.querySelector("circle").classList.add("selected");const file=group.getAttribute("data-file"),node=data.nodes.find(n=>n.file===file),incoming=data.edges.filter(e=>e.to===file).map(e=>e.from);el("graphDetail").innerHTML='<b>'+esc(file)+'</b> · '+esc(node.role)+' · '+node.lines+' lines<br>Imports: '+(node.imports.length?node.imports.map(esc).join(", "):"none detected")+'<br>Imported by: '+(incoming.length?incoming.map(esc).join(", "):"no mapped modules");}));
 if(nodes.length===0)svg.innerHTML='<text x="24" y="35" fill="#8e9aab">No source modules found.</text>';
}
async function loadMap(){el("architecture").innerHTML='<div class="loading">Mapping source relationships…</div>';try{const data=await api("/api/architecture");renderGraph(data);el("architecture").innerHTML=data.nodes.slice(0,36).map(node=>'<div class="node">'+esc(node.file)+'<small>'+esc(node.role)+' · '+node.imports.length+' imports · '+node.lines+' lines</small></div>').join("")+(data.nodes.length>36?'<div class="muted">Showing 36 of '+data.nodes.length+' modules; graph displays up to 48.</div>':"");}catch(error){el("architecture").innerHTML='<div class="error">'+esc(error.message)+'</div>';el("architectureGraph").innerHTML='<text x="24" y="35" fill="#fca5a5">'+esc(error.message)+'</text>';}}
async function loadHealth(){
 try{const data=await api("/api/health");const c=data.current;
 const rate=c.verification.successRate===null?"—":c.verification.successRate+"%";
 const metrics=[["Quality score",c.quality.score+"/100 ("+c.quality.grade+")"],["Verification success",rate],["Source files",c.project.files],["Architecture links",c.architecture.edges]];
 const cards=metrics.map(([name,value])=>'<div class="card"><div class="metric-label">'+esc(name)+'</div><div class="metric">'+esc(value)+'</div></div>').join("");
 const points=data.history.slice(-12);const values=points.map(p=>p.quality.score);
 const chart=values.length>1?(()=>{const min=Math.min(...values,0),max=Math.max(...values,100),range=Math.max(1,max-min);const coords=values.map((v,i)=>(24+i*252/Math.max(1,values.length-1))+","+(86-(v-min)*66/range));return '<div class="card"><b>Quality score trend</b><svg viewBox="0 0 300 100" role="img" aria-label="Quality score history" style="width:100%;height:110px"><polyline fill="none" stroke="#a3e635" stroke-width="2.5" points="'+coords.join(" ")+'"/>'+coords.map((point,i)=>{const xy=point.split(",");return '<circle cx="'+xy[0]+'" cy="'+xy[1]+'" r="3" fill="#67e8f9"><title>'+esc(values[i])+':100</title></circle>';}).join("")+'</svg><div class="run-meta">'+values.length+' saved health snapshots</div></div>';})():'<div class="card"><b>Quality score trend</b><div class="empty">Generate more health snapshots to see a trend.</div></div>';
 const severity=Object.entries(c.quality.bySeverity).map(([name,count])=>'<span class="pill">'+esc(name)+": "+esc(count)+'</span>').join(" ");
 const langs=c.project.languages.slice(0,6).map(x=>'<span class="pill">'+esc(x.name)+": "+esc(x.files)+'</span>').join(" ");
 const recent=c.verification.recent.slice(0,5).map(x=>'<div class="rowitem"><b>'+esc(x.script)+'</b><span class="pill">'+esc(x.status)+' · '+esc(x.durationMs)+' ms</span></div>').join("");
 el("healthPanel").innerHTML='<div class="grid">'+cards+'</div>'+chart+'<div><b>Findings by severity</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+severity+'</div></div><div><b>Languages</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+(langs||"No language data") +'</div></div><div><b>Recent checks</b>'+(recent||'<div class="empty">No verification runs yet.</div>')+'</div><div class="run-meta">Snapshots are created on request. Quality score is heuristic; verification rate excludes timeouts and spawn errors.</div>';
 }catch(error){el("healthPanel").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
async function loadRegression(){
 try{const data=await api("/api/regression");const s=data.summary;
 const cards=[["Regressions",s.regressions],["Recovered",s.recovered],["Persistent failures",s.persistentFailures],["Checks tracked",s.checksReviewed]];
 const top='<div class="grid">'+cards.map(([k,v])=>'<div class="card"><div class="metric-label">'+esc(k)+'</div><div class="metric">'+esc(v)+'</div></div>').join("")+'</div>';
 const checks=data.checks.slice(0,8).map(item=>'<div class="rowitem"><div><b>'+esc(item.script)+'</b><div class="run-meta">'+(item.previous?esc(item.previous.status)+' → '+esc(item.latest.status):'First recorded baseline')+(item.newFailureSignature?' · New failure signature':'')+'</div></div><span class="pill">'+esc(item.state.replaceAll("_"," "))+'</span></div>').join("");
 const changed=data.changedFiles.slice(0,6).map(item=>'<div class="rowitem"><b>'+esc(item.file)+'</b><span class="pill">'+esc(item.status)+'</span></div>').join("");
 el("regressionPanel").innerHTML=top+(checks||'<div class="empty">No verification history yet. Run forge verify SCRIPT to establish a baseline.</div>')+'<div class="run-meta"><b>Git changes</b></div>'+(changed||'<div class="empty">No changed files detected, or Git context is unavailable.</div>')+'<div class="run-meta">Signals compare saved command outcomes; they do not prove causation. Suggested tests are not executed.</div>';
 }catch(error){el("regressionPanel").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
async function loadReviews(){
 try{const data=await api("/api/reviews");
 el("reviewPanel").innerHTML=data.length?data.slice(0,8).map(item=>'<div class="rowitem"><div><b>'+esc(item.id)+'</b><div class="run-meta">'+esc(new Date(item.createdAt).toLocaleString())+' · '+esc(item.filesReviewed)+' files · '+esc(item.staticFindings)+' static findings · '+esc(item.aiSuggestions)+' AI suggestions</div>'+(item.topFindings.length?'<div class="run-meta">'+item.topFindings.map(esc).join(" · ")+'</div>':"")+'</div><span class="pill">'+esc(item.scope)+'</span></div>').join(""):'<div class="empty">No saved reviews yet. Run forge review . to create one.</div>';
 }catch(error){el("reviewPanel").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
async function loadQuality(){
 try{const data=await api("/api/quality");
 const head='<div class="rowitem"><b>Rule-based score</b><span class="pill">'+esc(data.score)+'/100 · '+esc(data.grade)+'</span></div><div class="run-meta">'+esc(data.findings.length)+' findings · '+esc(data.metrics.sourceFiles)+' source files · '+esc(data.metrics.testFiles)+' test files</div>';
 const items=data.findings.slice(0,6).map(item=>'<div class="rowitem"><div><b>'+esc(item.title)+'</b><div class="run-meta">'+esc(item.recommendation)+'</div></div><span class="pill">'+esc(item.severity)+'</span></div>').join("");
 el("qualityPanel").innerHTML=head+(items||'<div class="empty">No findings from available static checks.</div>')+'<div class="run-meta">Static heuristic only — not a security certification.</div>';
 }catch(error){el("qualityPanel").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
let workspaceDirectory="";
async function loadWorkspace(pathValue=workspaceDirectory){
 workspaceDirectory=pathValue;
 try{
  const data=await api("/api/workspace?path="+encodeURIComponent(workspaceDirectory));
  workspaceDirectory=data.path;el("workspacePath").textContent="/"+(data.path||"");
  el("workspaceFiles").innerHTML=data.entries.length?data.entries.map(item=>'<div class="rowitem"><button class="btn" data-workspace-kind="'+esc(item.kind)+'" data-workspace-path="'+esc(item.path)+'">'+(item.kind==="directory"?"▸ ":"") +esc(item.name)+'</button><span class="pill">'+(item.kind==="file"?esc(item.size)+" B":"FOLDER")+'</span></div>').join(""):'<div class="empty">No previewable files or folders here.</div>';
  if(data.truncated)el("workspaceFiles").insertAdjacentHTML("beforeend",'<div class="run-meta">Showing first 200 entries.</div>');
  el("workspaceFiles").querySelectorAll("[data-workspace-path]").forEach(button=>button.addEventListener("click",()=>button.dataset.workspaceKind==="directory"?loadWorkspace(button.dataset.workspacePath):previewWorkspace(button.dataset.workspacePath)));
 }catch(error){el("workspaceFiles").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
async function previewWorkspace(filePath){
 try{const file=await api("/api/workspace/file?path="+encodeURIComponent(filePath));
 el("workspacePreview").innerHTML='<div><b>'+esc(file.name)+'</b><div class="run-meta">'+esc(file.path)+' · '+esc(file.size)+' bytes</div></div><pre style="white-space:pre;overflow:auto;max-height:520px;background:#0b1018;border:1px solid var(--line);padding:14px;border-radius:9px;font:12px/1.6 ui-monospace,monospace">'+esc(file.content)+'</pre>';
 }catch(error){el("workspacePreview").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
async function runCodeSearch(){const query=el("codeSearchQuery").value.trim();if(query.length<2){el("codeSearchMeta").textContent="Enter at least two characters.";return;}el("codeSearchResults").innerHTML='<div class="loading">Searching source files…</div>';try{const data=await api("/api/search?q="+encodeURIComponent(query));el("codeSearchMeta").textContent=data.total+" matches · "+data.filesScanned+" files scanned"+(data.truncated?" · showing first "+data.results.length:"");el("codeSearchResults").innerHTML=data.results.length?data.results.map(item=>'<button class="btn" style="text-align:left;white-space:normal" data-search-path="'+esc(item.path)+'"><b>'+esc(item.symbol||item.path)+'</b> <span class="pill">'+esc(item.kind)+'</span><div class="run-meta">'+esc(item.path)+':'+item.line+':'+item.column+'</div><code>'+esc(item.snippet)+'</code></button>').join(""):'<div class="empty">No matches found.</div>';el("codeSearchResults").querySelectorAll("[data-search-path]").forEach(button=>button.addEventListener("click",()=>previewWorkspace(button.dataset.searchPath)));}catch(error){el("codeSearchResults").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadVerifications(){
 try{const data=await api("/api/verifications");
 if(!data.length){el("verificationPanel").innerHTML='<div class="empty">No verification runs yet. Use forge verify SCRIPT.</div>';return;}
 el("verificationPanel").innerHTML=data.slice(0,8).map(item=>'<div class="rowitem"><div><b>'+esc(item.script)+'</b><div class="run-meta">'+esc(new Date(item.startedAt).toLocaleString())+' · '+esc(item.durationMs)+' ms</div></div><span class="pill">'+esc(item.status)+'</span></div>').join("");
 }catch(error){el("verificationPanel").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
el("codeSearchButton").addEventListener("click",runCodeSearch);el("codeSearchQuery").addEventListener("keydown",event=>{if(event.key==="Enter")runCodeSearch();});\nel("workspaceUp").addEventListener("click",()=>loadWorkspace(workspaceDirectory.includes("/")?workspaceDirectory.slice(0,workspaceDirectory.lastIndexOf("/")):""));
el("refreshMap").addEventListener("click",loadMap);loadWorkspace();el("refreshHealth").addEventListener("click",loadHealth);el("refreshRegression").addEventListener("click",loadRegression);el("refreshReviews").addEventListener("click",loadReviews);el("refreshActivity").addEventListener("click",()=>{loadActivity();loadRuns();});loadOverview();loadAgents();loadRuns();loadActivity();loadMap();loadQuality();loadVerifications();loadHealth();loadRegression();loadReviews();setInterval(()=>{loadActivity();loadRuns();loadVerifications();},5000);
</script></body></html>`;

export interface DashboardOptions {
  projectPath: string;
  port?: number;
}

export interface DashboardHandle {
  server: Server;
  url: string;
}

export async function startDashboard(options: DashboardOptions): Promise<DashboardHandle> {
  const host = "127.0.0.1";
  const port = options.port ?? 4173;
  const projectPath = options.projectPath;

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:");
    response.setHeader("Cache-Control", "no-store");

    try {
      if (request.method !== "GET" && request.method !== "POST") {
        response.writeHead(405, { "content-type": "application/json" }).end(JSON.stringify({ error: "Method not allowed." }));
        return;
      }
      if (request.method === "POST") {
        const approvalRoute = requestUrl.pathname.match(/^\/api\/runs\/([^/]+)\/tasks\/([^/]+)\/approval$/);
        if (!approvalRoute) {
          response.writeHead(405, { "content-type": "application/json" }).end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }
        const origin = request.headers.origin;
        if (origin && new URL(origin).host !== request.headers.host) {
          response.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: "Cross-origin requests are not allowed." }));
          return;
        }
        if (!request.headers["content-type"]?.includes("application/json")) {
          response.writeHead(415, { "content-type": "application/json" }).end(JSON.stringify({ error: "Expected application/json." }));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 8192) {
            response.writeHead(413, { "content-type": "application/json" }).end(JSON.stringify({ error: "Request body is too large." }));
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { taskId?: string; decision?: string; reviewer?: string; reason?: string };
        if (!["approved", "rejected"].includes(body.decision ?? "") || typeof body.taskId !== "string" || typeof body.reviewer !== "string" || (body.reason !== undefined && typeof body.reason !== "string")) {
          response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "Invalid approval request." }));
          return;
        }
        const runId = decodeURIComponent(approvalRoute[1]!);
        const taskId = decodeURIComponent(approvalRoute[2]!);
        if (body.taskId !== taskId) {
          response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "Task identifier mismatch." }));
          return;
        }
        const run = await decideTaskApproval(projectPath, runId, taskId, body.decision as "approved" | "rejected", body.reviewer, body.reason);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({ id: run.id, status: run.status, task: run.tasks.find(item => item.task.id === taskId) }));
        return;
      }
      if (requestUrl.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
        return;
      }
      if (requestUrl.pathname === "/api/overview") {
        const report = await inspectProject(projectPath);
        const runs = await listRuns(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({
          summary: report.summary,
          dependencies: report.dependencies,
          packageManagers: report.packageManagers,
          frameworks: report.frameworks,
          scripts: report.scripts,
          importantFiles: report.importantFiles,
          warnings: report.warnings,
          runCount: runs.length,
        }));
        return;
      }
      if (requestUrl.pathname === "/api/agents") {
        const agents = await loadAgentRegistry(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(agents.map(agent => ({
          id: agent.id, name: agent.name, description: agent.description, source: agent.source,
        }))));
        return;
      }
      if (requestUrl.pathname.startsWith("/api/runs/")) {
        const runId = decodeURIComponent(requestUrl.pathname.slice("/api/runs/".length));
        const run = await loadRun(projectPath, runId);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({
          id: run.id, goal: run.goal, status: run.status, createdAt: run.createdAt, updatedAt: run.updatedAt,
          tasks: run.tasks.map(record => ({
            id: record.task.id, title: record.task.title, agent: record.task.agent, status: record.status,
            result: record.result ? { provider: record.result.provider, model: record.result.model, content: record.result.content } : undefined,
            error: record.error,
            approval: record.approval,
          })),
          events: run.events.map(event => ({ at: event.at, taskId: event.taskId, type: event.type, message: event.message })),
        })));
        return;
      }
      if (requestUrl.pathname === "/api/runs") {
        const runs = await listRuns(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(runs.map(run => ({
          id: run.id, goal: run.goal, status: run.status, createdAt: run.createdAt,
          tasks: run.tasks.map(task => ({ id: task.task.id, title: task.task.title, agent: task.task.agent, status: task.status })),
          events: run.events.map(event => ({ at: event.at, taskId: event.taskId, type: event.type, message: event.message })),
        }))));
        return;
      }
      if (requestUrl.pathname === "/api/health") {
        const report = await generateProjectHealth(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(report));
        return;
      }
      if (requestUrl.pathname === "/api/quality") {
        const report = await auditProject(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({
          score: report.score, grade: report.grade, generatedAt: report.generatedAt, metrics: report.metrics,
          findings: report.findings.map(item => ({ id: item.id, severity: item.severity, title: item.title, recommendation: item.recommendation })),
        }));
        return;
      }
      if (requestUrl.pathname === "/api/verifications") {
        const history = await listVerifications(projectPath, 25);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(history.map(item => ({
          id: item.id, script: item.script, status: item.status, exitCode: item.exitCode, durationMs: item.durationMs, startedAt: item.startedAt, finishedAt: item.finishedAt,
        }))));
        return;
      }
      if (requestUrl.pathname === "/api/reviews") {
        const records = await listReviews(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(records.slice(0, 50).map(record => ({
          id: record.id, createdAt: record.createdAt, scope: record.report.scope,
          filesReviewed: record.report.filesReviewed.length, staticFindings: record.report.findings.length,
          aiSuggestions: record.ai?.suggestions.length ?? 0,
          topFindings: [...record.report.findings.slice(0, 3).map(item => item.title), ...(record.ai?.suggestions.slice(0, 2).map(item => item.title) ?? [])],
        }))));
        return;
      }
      if (requestUrl.pathname === "/api/regression") {
        const base = requestUrl.searchParams.get("base") ?? "HEAD";
        const report = await generateRegressionReport(projectPath, base);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(report));
        return;
      }
      if (requestUrl.pathname === "/api/search") {\n        const query=requestUrl.searchParams.get("q")??"";\n        const limit=Number(requestUrl.searchParams.get("limit")??80);\n        const report=await searchWorkspace(projectPath,query,limit);\n        response.writeHead(200,{"content-type":"application/json; charset=utf-8"}).end(JSON.stringify(report));\n        return;\n      }\n      if (requestUrl.pathname === "/api/workspace") {
        const relativePath = requestUrl.searchParams.get("path") ?? "";
        const listing = await listWorkspaceDirectory(projectPath, relativePath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(listing));
        return;
      }
      if (requestUrl.pathname === "/api/workspace/file") {
        const relativePath = requestUrl.searchParams.get("path") ?? "";
        const file = await readWorkspaceFile(projectPath, relativePath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(file));
        return;
      }
      if (requestUrl.pathname === "/api/architecture") {
        const map = await mapArchitecture(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(map));
        return;
      }
      response.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "Not found." }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected dashboard error.";
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({ error: message }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  return { server, url: `http://${host}:${port}` };
}
