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
import { buildDependencyGraph } from "./dependency-graph.js";
import { analyzeEngineeringRisk } from "./engineering-risk.js";
import { analyzeChangeIntelligence } from "./change-intelligence.js";
import { compareLatestIntelligence, listIntelligenceSnapshots } from "./intelligence-timeline.js";
import { analyzeDependencies } from "./dependency-intelligence.js";
import { loadExecutionTrace } from "./execution-trace.js";\nimport { createRunFromWorkflow, listWorkflows, loadWorkflow, saveWorkflow } from "./workflow-store.js";

const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#090b10"><title>FORGE — Engineering Workbench</title>
<style>
:root{color-scheme:dark;--bg:#090b10;--panel:#11151e;--panel2:#151b27;--line:#252d3b;--muted:#8e9aab;--text:#edf2f8;--accent:#a3e635;--cyan:#67e8f9}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 75% -15%,#1c2935 0,transparent 38%),var(--bg);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}
.shell{max-width:1440px;margin:auto;padding:28px 34px}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:22px}.brand{display:flex;gap:13px;align-items:center}.mark{width:42px;height:42px;border:1px solid #52652e;background:#18220f;color:var(--accent);display:grid;place-items:center;border-radius:12px;font-weight:900;font-size:19px;letter-spacing:-2px}.brand strong{font-size:17px;letter-spacing:2px}.brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:.4px}.status{color:var(--accent);font-size:12px;border:1px solid #3d5127;padding:6px 10px;border-radius:30px}.hero{padding:36px 0 25px}.eyebrow{color:var(--accent);font-size:11px;letter-spacing:2px;font-weight:700}.hero h1{font-size:clamp(27px,4vw,42px);line-height:1.1;letter-spacing:-1.5px;margin:8px 0}.hero p{color:var(--muted);margin:0;max-width:680px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:linear-gradient(145deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:15px;padding:18px;min-width:0}.metric-label{color:var(--muted);font-size:12px}.metric{font-size:30px;font-weight:700;letter-spacing:-1px;margin-top:5px}.metric-sub{color:#718094;font-size:11px;margin-top:2px}.section{margin-top:24px}.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.section h2{font-size:15px;margin:0;letter-spacing:.2px}.muted{color:var(--muted)}.columns{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.list{display:grid;gap:10px}.rowitem{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #202734}.rowitem:last-child{border:0}.rowitem b{font-weight:600}.pill{font-size:10px;border:1px solid var(--line);border-radius:20px;padding:3px 8px;color:#c3cedb;white-space:nowrap}.barline{height:6px;background:#252d3b;border-radius:10px;margin-top:7px;overflow:hidden}.barline span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--cyan));border-radius:10px}.run{padding:13px 0;border-bottom:1px solid #202734}.run:last-child{border:0}.run-title{display:flex;justify-content:space-between;gap:12px}.run-goal{font-weight:600;overflow-wrap:anywhere}.run-meta{color:var(--muted);font-size:11px;margin-top:4px}.activity{display:grid;gap:9px}.activity-item{display:grid;grid-template-columns:10px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid #202734}.activity-dot{width:8px;height:8px;margin-top:6px;border-radius:50%;background:#8e9aab}.activity-dot.completed{background:var(--accent)}.activity-dot.failed,.activity-dot.blocked{background:#fb7185}.activity-dot.awaiting_approval{background:#fbbf24}.activity-dot.running{background:var(--cyan)}.task-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.task-card{border:1px solid var(--line);border-radius:9px;padding:10px;background:#0d131c}.task-card b{display:block;font-size:12px}.task-card small{display:block;color:var(--muted);margin-top:4px}.activity-toolbar{display:flex;gap:8px;align-items:center}.run{cursor:pointer;border-radius:7px;padding-left:8px;padding-right:8px}.run:hover{background:#192231}.run.selected{outline:1px solid var(--accent)}.inspector{display:grid;gap:12px}.inspector-task{border:1px solid var(--line);border-radius:10px;padding:13px;background:#0d131c}.inspector-task pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#cbd5e1;font:12px/1.6 ui-monospace,monospace;margin:10px 0 0}.approval{border-color:#7c5a1d;background:#211b10}.approval-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.btn.approve{border-color:#526c2e;color:#c7f78a}.btn.reject{border-color:#78404a;color:#fda4af}.approval-audit{font-size:11px;color:var(--muted);margin-top:8px}.empty{padding:25px 10px;text-align:center;color:var(--muted)}.actions{display:flex;gap:8px}.btn{background:#1a222e;color:var(--text);border:1px solid #354154;border-radius:9px;padding:8px 12px;font:inherit;font-size:12px;cursor:pointer}.btn:hover{border-color:var(--accent)}.architecture{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px}.graph-wrap{border:1px solid var(--line);border-radius:12px;background:#0c1119;overflow:hidden;margin-bottom:14px}.graph-wrap svg{display:block;width:100%;height:360px}.graph-edge{stroke:#405064;stroke-width:1.4;opacity:.8}.graph-node{fill:#182331;stroke:#8da4bc;stroke-width:1.5;cursor:pointer}.graph-node.entry{stroke:var(--accent);stroke-width:2.5}.graph-node.selected{fill:#34451f;stroke:var(--accent);stroke-width:3}.graph-label{fill:var(--text);font-size:10px;pointer-events:none}.dependency-node{cursor:pointer}.dependency-node circle{stroke-width:2;fill:#172331;stroke:#8da4bc}.dependency-node.file circle{stroke:#67e8f9}.dependency-node.entry circle{stroke:#a3e635}.dependency-node.declared circle{stroke:#67e8f9}.dependency-node.undeclared circle{stroke:#fb7185;fill:#351923}.dependency-node.possible-unused circle{stroke:#fbbf24;fill:#302711}.dependency-node.selected circle{stroke:#fff;stroke-width:3;fill:#34451f}.dependency-label{fill:var(--text);font-size:11px;pointer-events:none}.dependency-edge{stroke:#405064;stroke-width:1.25;opacity:.6;fill:none}.dependency-edge.external{stroke:#a3e635;stroke-dasharray:4 4}.dependency-node.hidden,.dependency-edge.hidden{display:none}.dependency-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:11px;margin:8px 0}.dependency-legend span{display:inline-flex;align-items:center;gap:5px}.dependency-legend i{width:8px;height:8px;border-radius:50%;display:inline-block;background:#67e8f9}.dependency-legend .bad{background:#fb7185}.dependency-legend .warn{background:#fbbf24}.graph-hint,.graph-detail{padding:10px 12px;color:var(--muted);font-size:12px;overflow-wrap:anywhere}.graph-hint{border-top:1px solid var(--line)}.node{background:#151c28;border:1px solid #2b3748;border-radius:9px;padding:10px;font-size:11px;overflow-wrap:anywhere}.node small{display:block;color:var(--muted);margin-top:4px}.footer{margin:28px 0 5px;padding-top:15px;border-top:1px solid var(--line);color:#718094;font-size:11px;display:flex;justify-content:space-between;gap:10px}.error{color:#fca5a5}.loading{color:var(--muted);padding:15px 0}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.columns{grid-template-columns:1fr}}@media(max-width:560px){.shell{padding:18px 15px}.top{align-items:flex-start}.status{font-size:10px}.grid{gap:9px}.card{padding:14px}.metric{font-size:25px}.hero{padding:28px 0 20px}.footer{flex-direction:column}}
.workflow-graph-wrap{height:440px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background-color:#0a1018;background-image:radial-gradient(#263448 1px,transparent 1px);background-size:20px 20px;touch-action:none}.workflow-graph-wrap svg{width:100%;height:100%;display:block;cursor:grab;user-select:none}.workflow-graph-wrap svg:active{cursor:grabbing}.workflow-edge{fill:none;stroke:#8298b2;stroke-width:2.2;opacity:.85}.workflow-graph-node{cursor:grab}.workflow-graph-node rect{fill:#172331;stroke:#52657c;stroke-width:1.5}.workflow-graph-node:hover rect{stroke:#9cc3e8;stroke-width:2}.workflow-graph-node.selected rect{stroke:var(--accent);stroke-width:3;fill:#25321f}.wf-agent{fill:#8fa4bc;font-size:9px;letter-spacing:1px}.wf-title{fill:#f0f4fa;font-size:12px;font-weight:650}.wf-sub{fill:#a6b4c5;font-size:9px}.workflow-toolbar{display:flex;gap:8px;align-items:center;margin:0 0 8px}</style><style>.workflow-canvas{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;padding:8px 2px}.workflow-node{cursor:grab;min-width:0;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025);padding:14px;transition:border-color .15s,transform .15s}.workflow-node:active{cursor:grabbing}.workflow-node:hover{border-color:var(--accent);transform:translateY(-2px)}.workflow-connector{grid-column:1/-1;text-align:center;color:var(--muted);font-size:11px;letter-spacing:.12em;padding:2px}.workflow-node .run-meta{overflow-wrap:anywhere}</style></head>
<body><main class="shell">
<header class="top"><div class="brand"><div class="mark">F.</div><div><strong>FORGE</strong><small>THE AI ENGINEERING WORKBENCH</small></div></div><div class="status">● LOCAL WORKSPACE</div></header>
<section class="hero"><div class="eyebrow">ENGINEERING CONTROL CENTER / 01</div><h1>Build with context.<br>Ship with confidence.</h1><p>A live overview of your codebase, architecture signals and AI-assisted engineering runs.</p></section>
<section class="grid" id="metrics"><div class="card"><div class="metric-label">Source files</div><div class="metric">—</div><div class="metric-sub">Scanning workspace</div></div><div class="card"><div class="metric-label">Directories</div><div class="metric">—</div><div class="metric-sub">Project structure</div></div><div class="card"><div class="metric-label">Dependencies</div><div class="metric">—</div><div class="metric-sub">Production + development</div></div><div class="card"><div class="metric-label">Saved runs</div><div class="metric">—</div><div class="metric-sub">Local execution history</div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Language composition</h2><span class="pill">PROJECT INTELLIGENCE</span></div><div id="languages" class="list"><div class="loading">Loading language data…</div></div></div><div class="card"><div class="section-head"><h2>Detected stack</h2><span class="pill">ENVIRONMENT</span></div><div id="stack" class="list"><div class="loading">Detecting frameworks…</div></div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Specialist agents</h2><span class="pill">AGENT REGISTRY</span></div><div id="agents"><div class="loading">Loading agent roles…</div></div></div><div class="card"><div class="section-head"><h2>Recent runs</h2><span class="pill">LOCAL HISTORY</span></div><div id="runs"><div class="loading">Loading saved runs…</div></div></div><div class="card"><div class="section-head"><h2>Project signals</h2><span class="pill">INSIGHTS</span></div><div id="signals" class="list"><div class="loading">Collecting project signals…</div></div></div></section>
<section class="section card"><div class="section-head"><h2>Project Health Center</h2><div class="actions"><span class="pill">SNAPSHOT + TRENDS</span><button class="btn" id="refreshHealth">Refresh snapshot</button></div></div><div id="healthPanel" class="list"><div class="loading">Generating project health snapshot…</div></div></section>\n<section class="section columns"><div class="card"><div class="section-head"><h2>Regression intelligence</h2><div class="actions"><span class="pill">VERIFICATION TRENDS</span><button class="btn" id="refreshRegression">Refresh</button></div></div><div id="regressionPanel" class="list"><div class="loading">Comparing saved verification runs…</div></div></div><div class="card"><div class="section-head"><h2>Code review history</h2><div class="actions"><span class="pill">SAVED REVIEWS</span><button class="btn" id="refreshReviews">Refresh</button></div></div><div id="reviewPanel" class="list"><div class="loading">Loading saved review snapshots…</div></div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Engineering quality</h2><span class="pill">STATIC AUDIT</span></div><div id="qualityPanel" class="list"><div class="loading">Loading quality findings…</div></div></div><div class="card"><div class="section-head"><h2>Verification history</h2><span class="pill">REAL COMMAND RESULTS</span></div><div id="verificationPanel" class="list"><div class="loading">Loading verification history…</div></div></div></section>\n<section class="section card"><div class="section-head"><h2>Code search</h2><span class="pill">SYMBOL-AWARE SOURCE SEARCH</span></div><div class="actions"><input id="codeSearchQuery" type="search" placeholder="Search symbols or source text…" style="flex:1;min-width:0;background:#0b1018;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit"><button class="btn" id="codeSearchButton">Search</button></div><div id="codeSearchMeta" class="run-meta">Searches source files only; results open in the workspace preview.</div><div id="codeSearchResults" class="list"><div class="empty">Enter at least two characters to search.</div></div></section>\n<section class="section card"><div class="section-head"><h2>Workspace explorer</h2><span class="pill">SAFE FILE PREVIEW</span></div><div class="columns"><div><div class="actions"><button class="btn" id="workspaceUp">↑ Up</button><span id="workspacePath" class="pill">/</span></div><div id="workspaceFiles" class="list" style="margin-top:10px"><div class="loading">Loading workspace files…</div></div></div><div><div id="workspacePreview" class="inspector"><div class="empty">Select a source file to preview it here.</div></div></div></div></section>
<section class="section card" id="workflowEditor"><div class="section-head"><h2>Visual workflow editor</h2><span class="pill">REUSABLE AGENT PIPELINES</span></div><p class="run-meta">Compose specialist tasks, connect dependencies and add human approval gates. Saving a workflow stores a local reusable definition; creating a draft does not execute agents.</p><div class="columns"><div class="inspector"><label class="metric-label" for="workflowName">Workflow name</label><input id="workflowName" maxlength="100" placeholder="e.g. Secure feature delivery" style="background:#0b1018;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit"><label class="metric-label" for="workflowDescription">Description</label><input id="workflowDescription" maxlength="500" placeholder="What this pipeline is for" style="background:#0b1018;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit"><div class="divider"></div><h3 style="margin:4px 0">Add specialist task</h3><label class="metric-label" for="workflowAgent">Agent</label><select id="workflowAgent" class="btn" style="text-align:left"><option value="planner">Planner</option><option value="architect">Architect</option><option value="code-reviewer">Code reviewer</option><option value="security-reviewer">Security reviewer</option><option value="test-engineer">Test engineer</option><option value="documentation-writer">Documentation writer</option><option value="performance-engineer">Performance engineer</option><option value="debugger">Debugger</option><option value="devops-engineer">DevOps engineer</option><option value="database-reviewer">Database reviewer</option><option value="accessibility-reviewer">Accessibility reviewer</option><option value="release-manager">Release manager</option></select><label class="metric-label" for="workflowTaskTitle">Task title</label><input id="workflowTaskTitle" maxlength="120" placeholder="Review API boundaries" style="background:#0b1018;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit"><label class="metric-label" for="workflowTaskPrompt">Task instructions</label><textarea id="workflowTaskPrompt" maxlength="4000" rows="3" placeholder="Describe the specialist's job and expected evidence…" style="background:#0b1018;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit"></textarea><label class="metric-label" for="workflowDependency">Depends on</label><select id="workflowDependency" class="btn" multiple size="4" style="text-align:left;min-height:100px"><option value="">No dependency (start independently)</option></select><div class="run-meta">Use Ctrl/Cmd to select multiple prerequisites for branching and join points.</div><label style="display:flex;gap:8px;align-items:center"><input id="workflowRequiresApproval" type="checkbox"> Require human approval before this task</label><div class="actions"><button class="btn" id="addWorkflowTask">Add task</button><button class="btn" id="clearWorkflowTasks">Clear tasks</button></div><div class="actions"><button class="btn" id="templateFeature">Load feature-delivery template</button><button class="btn" id="templateSecurity">Load security-audit template</button></div></div><div class="inspector"><div class="section-head"><h3 style="margin:0">Pipeline canvas</h3><span class="pill" id="workflowTaskCount">0 TASKS</span></div><div id="workflowCanvas" class="activity"><div class="empty">Add a specialist task to start composing your pipeline.</div></div><div class="actions"><button class="btn" id="applyWorkflowLinks">Apply selected links</button></div><div class="actions"><button class="btn" id="saveWorkflow">Save workflow</button><button class="btn" id="createWorkflowRun">Create draft run</button></div><div id="workflowMessage" class="run-meta" aria-live="polite"></div><div class="section-head" style="margin-top:18px"><h3 style="margin:0">Saved workflows</h3><button class="btn" id="refreshWorkflows">Refresh</button></div><div id="savedWorkflows" class="activity"><div class="loading">Loading reusable workflows…</div></div></div></div></section>\n<section class="section card"><div class="section-head"><h2>Run inspector</h2><span id="inspectorLabel" class="pill">SELECT A RUN</span></div><div id="runInspector" class="inspector"><div class="empty">Select a saved run to inspect its task results and approval state.</div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Agent activity</h2><div class="activity-toolbar"><span id="activityUpdated" class="pill">Waiting for data</span><button class="btn" id="refreshActivity">Refresh</button></div></div><div id="activity" class="activity"><div class="loading">Loading task activity…</div></div></div><div class="card"><div class="section-head"><h2>Task status</h2><span class="pill">LATEST RUN</span></div><div id="taskStatus" class="task-grid"><div class="loading">Waiting for a saved run…</div></div></div></section>
<section class="section card"><div class="section-head"><h2>Dependency security & license intelligence</h2><div class="actions"><span class="pill">OFFLINE ANALYSIS</span><button class="btn" id="refreshDependencyIntel">Refresh inventory</button></div></div><div id="dependencyIntelSummary" class="grid"><div class="loading">Inspecting dependency metadata…</div></div><div id="dependencyIntelList" class="activity"></div><div id="dependencyIntelNotes" class="run-meta"></div></section>
<section class="section card"><div class="section-head"><h2>Engineering intelligence timeline</h2><div class="actions"><span class="pill">SAVED LOCAL SNAPSHOTS</span><button class="btn" id="refreshTimeline">Refresh timeline</button></div></div><div id="timelineSummary" class="grid"><div class="loading">Loading saved engineering snapshots…</div></div><div id="timelineHistory" class="activity"></div><div id="timelineNotes" class="run-meta"></div></section>
<section class="section card"><div class="section-head"><h2>Change risk & test intelligence</h2><div class="actions"><span class="pill">CHANGE-AWARE PRIORITIZATION</span><button class="btn" id="refreshChangeRisk">Refresh change analysis</button></div></div><div id="changeRiskSummary" class="grid"><div class="loading">Analyzing current working-tree changes…</div></div><div id="changeRiskList" class="activity"><div class="loading">Prioritizing changed modules…</div></div><div id="changeRiskNotes" class="run-meta"></div></section>
<section class="section card"><div class="section-head"><h2>Engineering risk intelligence</h2><div class="actions"><span class="pill">STRUCTURAL HOTSPOTS</span><button class="btn" id="refreshRisk">Refresh risk analysis</button></div></div><div id="riskSummary" class="grid"><div class="loading">Calculating engineering hotspots…</div></div><div class="graph-wrap" style="margin-top:12px"><div id="riskHotspots" class="activity"><div class="loading">Ranking modules by structural risk…</div></div></div><div id="riskMethodology" class="run-meta"></div><div id="riskWarnings" class="run-meta"></div></section>
<section class="section card"><div class="section-head"><h2>Dependency risk explorer</h2><div class="actions"><span class="pill">INTERACTIVE PACKAGE GRAPH</span><button class="btn" id="refreshDependencyGraph">Refresh graph</button></div></div><div id="dependencySummary" class="grid"><div class="loading">Mapping package relationships…</div></div><div class="actions" style="margin:12px 0"><input id="dependencyFilter" type="search" placeholder="Filter files or packages…" style="flex:1;min-width:0;background:#0b1018;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;font:inherit"><select id="dependencyMode" class="btn" aria-label="Graph filter"><option value="all">All relationships</option><option value="risk">Risk signals</option><option value="packages">Packages only</option></select></div><div class="graph-wrap"><svg id="dependencyGraph" viewBox="0 0 1100 620" role="img" aria-label="Interactive file and package dependency graph"><text x="24" y="35" fill="#8e9aab">Loading dependency graph…</text></svg><div class="graph-hint">Files appear on the left and packages on the right. Select a node to inspect its consumers and status.</div></div><div id="dependencyDetail" class="graph-detail">Select a package or source module to inspect its relationships.</div><div id="dependencyWarnings" class="run-meta"></div></section>
<section class="section card"><div class="section-head"><h2>Architecture snapshot</h2><div class="actions"><span class="pill">STATIC IMPORT MAP</span><button class="btn" id="refreshMap">Refresh map</button></div></div><div class="graph-wrap"><svg id="architectureGraph" viewBox="0 0 900 360" role="img" aria-label="Interactive source module dependency graph"><text x="24" y="35" fill="#8e9aab">Loading architecture graph…</text></svg><div class="graph-hint">Select a node to inspect imports and incoming dependencies. Lines represent detected relative imports.</div></div><div id="graphDetail" class="graph-detail">Choose a module in the graph.</div><div id="architecture" class="architecture"></div></section>
<footer class="footer"><span>FORGE v0.28.0 · ENGINEERING INTELLIGENCE</span><span>Read-only dashboard · Data stays on this machine</span></footer>
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
let selectedRunId="";
async function inspectRun(id){
 selectedRunId=id;
 try{
  const run=await api("/api/runs/"+encodeURIComponent(id));
  const traceRequest=await api("/api/runs/"+encodeURIComponent(id)+"/trace").catch(()=>null);
  el("inspectorLabel").textContent=run.id;
  const handoffs=run.tasks.map(task=>'<div class="task-card"><b>'+esc(task.title)+'</b><small>'+esc(task.agent)+' · '+esc(task.id)+'</small><span class="pill">'+esc(task.status)+'</span><small>'+(task.dependsOn&&task.dependsOn.length?'Receives findings from: '+esc(task.dependsOn.join(', ')):'No upstream dependencies')+'</small></div>').join("");
  const trace=traceRequest?'<div class="card"><div class="section-head"><h2>Execution telemetry</h2><span class="pill">ESTIMATES · LOCAL</span></div><div class="grid">'+metric("Agent attempts",traceRequest.totals.tasks,"Recorded trace entries")+metric("Input tokens","~"+traceRequest.totals.estimatedInputTokens,"Character-based estimate")+metric("Output tokens","~"+traceRequest.totals.estimatedOutputTokens,"Character-based estimate")+metric("Agent time",traceRequest.totals.durationMs+" ms",traceRequest.totals.fallbacks+" fallbacks · "+traceRequest.totals.failures+" failures")+'</div><div class="activity">'+traceRequest.entries.slice().reverse().map(entry=>'<div class="activity-item"><span class="activity-dot '+(entry.outcome==="success"?"completed":entry.outcome==="failed"?"failed":"running")+'"></span><div><b>'+esc(entry.agent)+' · '+esc(entry.model)+'</b><div class="run-meta">'+esc(entry.taskId)+' · '+esc(entry.tier)+' tier · '+esc(entry.durationMs)+' ms · '+esc(entry.outcome)+'</div></div></div>').join("")+'</div></div>':'<div class="empty">No execution trace is available for this run yet. Start a provider-backed run to record model and timing telemetry.</div>';
  el("runInspector").innerHTML='<div><b>'+esc(run.goal)+'</b><div class="run-meta">'+esc(run.status)+' · '+esc(new Date(run.createdAt).toLocaleString())+'</div></div><div class="card"><div class="section-head"><h2>Agent handoff map</h2><span class="pill">'+run.tasks.length+' TASKS</span></div><div class="task-grid">'+handoffs+'</div><div class="run-meta">Dependency links show which completed agent proposals are passed downstream.</div></div>'+trace+run.tasks.map(task=>'<article class="inspector-task '+(task.status==="awaiting_approval"?"approval":"")+'"><div class="run-title"><b>'+esc(task.title)+'</b><span class="pill">'+esc(task.status)+'</span></div><div class="run-meta">'+esc(task.agent)+' · '+esc(task.id)+(task.dependsOn&&task.dependsOn.length?' · depends on '+esc(task.dependsOn.join(', ')):'')+'</div>'+(task.result?'<pre>'+esc(task.result.content)+'</pre>':"")+(task.error?'<div class="error">'+esc(task.error)+'</div>':"")+(task.approval?'<div class="approval-audit">'+esc(task.approval.decision)+' by '+esc(task.approval.reviewer)+' · '+esc(new Date(task.approval.at).toLocaleString())+(task.approval.reason?' · '+esc(task.approval.reason):"")+'</div>':"")+(task.status==="awaiting_approval"?'<div class="run-meta">Human decision required before this task can proceed.</div><div class="approval-actions"><button class="btn approve" data-approval="approved" data-task="'+esc(task.id)+'">Approve task</button><button class="btn reject" data-approval="rejected" data-task="'+esc(task.id)+'">Reject task</button></div>':"")+'</article>').join("");
  el("runInspector").querySelectorAll("[data-approval]").forEach(button=>button.addEventListener("click",()=>submitApproval(id,button.getAttribute("data-task"),button.getAttribute("data-approval"))));
  document.querySelectorAll(".run").forEach(item=>item.classList.toggle("selected",item.getAttribute("data-run-id")===id));
 }catch(error){el("runInspector").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
async function loadRuns(){try{const data=await api("/api/runs");el("runs").innerHTML=data.length?data.slice(0,7).map(run=>'<div class="run" data-run-id="'+esc(run.id)+'" tabindex="0" role="button"><div class="run-title"><span class="run-goal">'+esc(run.goal)+'</span><span class="pill">'+esc(run.status)+'</span></div><div class="run-meta">'+esc(run.id)+' · '+esc(new Date(run.createdAt).toLocaleString())+' · '+run.tasks.length+' tasks</div></div>').join(""):'<div class="empty">No saved runs yet. Create one with <code>forge plan --goal "..."</code>.</div>';el("runs").querySelectorAll("[data-run-id]").forEach(item=>{const select=()=>inspectRun(item.getAttribute("data-run-id"));item.addEventListener("click",select);item.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select();}});});}catch(error){el("runs").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadActivity(){
try{const runs=await api("/api/runs");el("activityUpdated").textContent="Updated "+new Date().toLocaleTimeString();
if(!runs.length){el("activity").innerHTML='<div class="empty">No agent activity yet. Create a plan or run to populate this view.</div>';el("taskStatus").innerHTML='<div class="empty">No tasks recorded.</div>';return;}
const latest=runs[0],events=latest.events||[];
el("activity").innerHTML=events.length?events.slice(-12).reverse().map(event=>'<div class="activity-item"><span class="activity-dot '+esc(event.type)+'"></span><div><b>'+esc(event.type.replaceAll("_"," ")) +'</b><div class="run-meta">'+esc(event.message)+'</div><div class="run-meta">'+esc(event.taskId)+' · '+esc(new Date(event.at).toLocaleTimeString())+'</div></div></div>').join(""):'<div class="empty">Latest run has no recorded events yet.</div>';
el("taskStatus").innerHTML=latest.tasks.length?latest.tasks.map(task=>'<div class="task-card"><b>'+esc(task.title||task.id)+'</b><small>'+esc(task.agent||"Agent")+'</small><span class="pill">'+esc(task.status)+'</span></div>').join(""):'<div class="empty">No tasks recorded.</div>';
}catch(error){el("activity").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadDependencyIntelligence(){el("dependencyIntelList").innerHTML='<div class="loading">Reading local dependency manifests and lockfile…</div>';try{const data=await api("/api/dependency-intelligence");const s=data.summary;el("dependencyIntelSummary").innerHTML=metric("Direct dependencies",s.direct,"Production "+s.production+" · development "+s.development)+metric("Transitive packages",s.transitive,"From parsed npm lockfile")+metric("Vulnerabilities",data.sources.vulnerabilityReport===null?"N/A":s.vulnerabilities,"Imported report only")+metric("Outdated",data.sources.outdatedReport===null?"N/A":s.outdated,"Imported report only");el("dependencyIntelList").innerHTML=data.dependencies.length?data.dependencies.slice(0,30).map(item=>'<div class="activity-item"><div class="activity-main"><b>'+esc(item.name)+'</b><small>'+(item.direct?"Direct · ":"Transitive · ")+esc(item.kind)+' · '+esc(item.locked||item.requested)+' · license '+esc(item.license||"unknown")+'</small><small>'+esc(item.vulnerabilities.map(v=>v.severity.toUpperCase()+": "+v.title).join(" · ")||"No imported vulnerability findings")+(item.outdated?" · latest "+esc(item.outdated.latest):"")+'</small></div><span class="pill">'+esc(item.licenseClass.toUpperCase())+'</span></div>').join(""):'<div class="empty">No npm dependencies detected.</div>';el("dependencyIntelNotes").textContent=data.limitations.join(" · ");}catch(error){el("dependencyIntelList").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadIntelligenceTimeline(){el("timelineHistory").innerHTML='<div class="loading">Loading snapshot history…</div>';try{const data=await api("/api/intelligence-timeline");const comparison=data.comparison;const snapshots=data.snapshots||[];if(!comparison){el("timelineSummary").innerHTML=metric("Snapshots",0,"No history yet")+metric("Trend","—","Capture with forge snapshot .")+metric("Latest risk","—","Not recorded")+metric("Latest commit","—","Not recorded");el("timelineHistory").innerHTML='<div class="empty">No snapshots yet. Run <code>forge snapshot .</code> to create the first baseline.</div>';el("timelineNotes").textContent="Snapshots stay local in .forge/intelligence and are not committed or uploaded.";return;}const current=comparison.current;const delta=comparison.delta;el("timelineSummary").innerHTML=metric("Snapshots",snapshots.length,"Saved locally")+metric("Trend",comparison.trend.toUpperCase(),delta?"Compared with previous":"Baseline")+metric("Risk index",current.metrics.score+"/100","Structural risk index")+metric("High hotspots",current.metrics.high,delta?"Change "+(delta.high>0?"+":"")+delta.high:"Current snapshot");el("timelineHistory").innerHTML=snapshots.slice(-12).reverse().map(item=>'<div class="activity-item"><div class="activity-main"><b>'+esc(item.generatedAt)+'</b><small>Risk '+item.metrics.score+'/100 · high '+item.metrics.high+' · '+item.metrics.hotspots+' hotspots · commit '+esc(item.commit||"unavailable")+'</small></div><span class="pill">'+esc(item.id)+'</span></div>').join("");el("timelineNotes").textContent="Trend: "+comparison.trend+". New top hotspots: "+(comparison.newHotspots.join(", ")||"none")+". No-longer-top hotspots: "+(comparison.resolvedHotspots.join(", ")||"none")+". Snapshots are local only."; }catch(error){el("timelineHistory").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadChangeRisk(){el("changeRiskList").innerHTML='<div class="loading">Analyzing working-tree changes…</div>';try{const data=await api("/api/change-intelligence");const s=data.summary;el("changeRiskSummary").innerHTML=metric("Changed files",s.changedFiles,"Compared with "+data.base)+metric("Overall risk",data.overallRisk.score+"/100",data.overallRisk.level.toUpperCase())+metric("Affected modules",s.affectedModules,"Static downstream impact")+metric("Test candidates",s.testCandidates,"Existing and suggested paths");el("changeRiskList").innerHTML=data.changes.length?data.changes.map(item=>'<div class="activity-item"><div class="activity-main"><b>'+esc(item.file)+'</b><small>'+esc(item.reasons.join(" "))+'</small><small>'+item.downstreamCount+' downstream modules · '+esc(item.recommendedTests.map(test=>test.file+(test.exists?"":" (suggested)")).join(", ")||"No test candidates")+'</small></div><span class="pill">'+esc(item.level.toUpperCase())+' · '+item.score+'</span></div>').join(""):'<div class="empty">No working-tree changes detected against the selected base.</div>';el("changeRiskNotes").textContent=(data.overallRisk.reasons||[]).concat(data.warnings||[]).join(" · ");}catch(error){el("changeRiskList").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadEngineeringRisk(){el("riskHotspots").innerHTML='<div class="loading">Calculating structural hotspots…</div>';try{const data=await api("/api/engineering-risk");const s=data.summary;el("riskSummary").innerHTML=metric("Hotspots",s.hotspots,"Prioritized modules")+metric("High risk",s.high,"Review these first")+metric("Elevated",s.elevated,"Worth investigating")+metric("No matching tests",s.withoutMatchingTests,"Filename heuristic");el("riskHotspots").innerHTML=data.hotspots.length?data.hotspots.map(item=>'<div class="activity-item"><div class="activity-main"><b>'+esc(item.file)+'</b><small>'+esc(item.signals.join(" "))+'</small><small>Fan-in '+item.fanIn+' · fan-out '+item.fanOut+' · '+item.lines+' lines · test '+(item.hasMatchingTest?"detected":"not detected")+'</small></div><span class="pill">'+esc(item.level.toUpperCase())+' · '+item.score+'</span></div>').join(""):'<div class="empty">No structural hotspots detected by current heuristics.</div>';el("riskMethodology").textContent=data.methodology;el("riskWarnings").textContent=(data.warnings||[]).join(" · ");}catch(error){el("riskHotspots").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
let dependencyGraphData=null;
function renderDependencyGraph(data){
 dependencyGraphData=data;const svg=el("dependencyGraph"),filter=(el("dependencyFilter").value||"").toLowerCase(),mode=el("dependencyMode").value;
 const files=data.nodes.filter(n=>n.kind==="file"),packages=data.nodes.filter(n=>n.kind==="package");
 const shown=n=>(!filter||(n.label+" "+n.detail+" "+n.id).toLowerCase().includes(filter))&&(mode==="all"||(mode==="risk"&&(n.status==="undeclared"||n.status==="possible-unused"))||(mode==="packages"&&n.kind==="package"));
 const visible=new Set(data.nodes.filter(shown).map(n=>n.id)),nodes=data.nodes.filter(n=>visible.has(n.id));
 const fileNodes=nodes.filter(n=>n.kind==="file"),packageNodes=nodes.filter(n=>n.kind==="package");
 const height=Math.max(420,Math.max(fileNodes.length,packageNodes.length)*34+70),width=1100;
 const positions=new Map();fileNodes.forEach((n,i)=>positions.set(n.id,{x:260,y:42+i*(height-80)/Math.max(1,fileNodes.length-1)}));
 packageNodes.forEach((n,i)=>positions.set(n.id,{x:820,y:42+i*(height-80)/Math.max(1,packageNodes.length-1)}));
 const edges=data.edges.filter(e=>visible.has(e.from)&&visible.has(e.to));
 const edgeMarkup=edges.map(e=>{const a=positions.get(e.from),b=positions.get(e.to),mid=(a.x+b.x)/2;return '<path class="dependency-edge '+e.kind+'" d="M '+a.x+' '+a.y+' C '+mid+' '+a.y+', '+mid+' '+b.y+', '+b.x+' '+b.y+'" data-from="'+esc(e.from)+'" data-to="'+esc(e.to)+'"/>';}).join("");
 const nodeMarkup=nodes.map(n=>{const p=positions.get(n.id),r=n.kind==="package"?8:6;return '<g class="dependency-node '+esc(n.kind)+' '+esc(n.status)+'" data-id="'+esc(n.id)+'" tabindex="0" role="button" aria-label="'+esc(n.label)+'"><circle cx="'+p.x+'" cy="'+p.y+'" r="'+r+'"/><text class="dependency-label" x="'+(p.x+(n.kind==="file"?-13:13))+'" y="'+(p.y+4)+'" text-anchor="'+(n.kind==="file"?"end":"start")+'">'+esc(n.label.length>36?n.label.slice(0,33)+"…":n.label)+'</text></g>';}).join("");
 svg.setAttribute("viewBox","0 0 "+width+" "+height);svg.style.height=Math.min(760,Math.max(420,height))+"px";svg.innerHTML='<text x="24" y="22" fill="#8e9aab" font-size="12">SOURCE FILES</text><text x="820" y="22" fill="#8e9aab" font-size="12">PACKAGES</text>'+edgeMarkup+nodeMarkup;
 svg.querySelectorAll("[data-id]").forEach(group=>{const choose=()=>{svg.querySelectorAll(".dependency-node").forEach(n=>n.classList.remove("selected"));group.classList.add("selected");const node=data.nodes.find(n=>n.id===group.getAttribute("data-id"));if(!node)return;const related=data.edges.filter(e=>e.from===node.id||e.to===node.id);const names=related.map(e=>{const other=data.nodes.find(n=>n.id===(e.from===node.id?e.to:e.from));return other?other.label:"";}).filter(Boolean);el("dependencyDetail").innerHTML='<b>'+esc(node.label)+'</b> · '+esc(node.kind)+' · <span class="pill">'+esc(node.status)+'</span><div class="run-meta" style="margin-top:6px">'+esc(node.detail)+'</div><div class="run-meta">Connected relationships: '+related.length+'</div><div class="run-meta">Connected to: '+(names.length?names.map(esc).join(", "):"no visible relationships")+'</div>';};group.addEventListener("click",choose);group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choose();}});});
 el("dependencyWarnings").textContent=(data.warnings||[]).join(" · ");
}
async function loadDependencyGraph(){el("dependencyGraph").innerHTML='<text x="24" y="35" fill="#8e9aab">Mapping dependency relationships…</text>';try{const data=await api("/api/dependency-graph");el("dependencySummary").innerHTML=metric("Source nodes",data.summary.files,"Shown in graph")+metric("Packages",data.summary.packages,"Declared and imported")+metric("Undeclared",data.summary.undeclared,"Imports absent from manifest")+metric("Possible unused",data.summary.possibleUnused,"Static scan candidates");renderDependencyGraph(data);}catch(error){el("dependencyGraph").innerHTML='<text x="24" y="35" fill="#fca5a5">'+esc(error.message)+'</text>';}}
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
 const score=c.engineeringScore;
 const metrics=[["Engineering score",score.score+"/100 ("+score.grade+")"],["Evidence coverage",score.confidencePercent+"%"],["Quality score",c.quality.score+"/100 ("+c.quality.grade+")"],["Verification success",rate]];
 const cards=metrics.map(([name,value])=>'<div class="card"><div class="metric-label">'+esc(name)+'</div><div class="metric">'+esc(value)+'</div></div>').join("");
 const points=data.history.slice(-12);const values=points.map(p=>p.quality.score);
 const chart=values.length>1?(()=>{const min=Math.min(...values,0),max=Math.max(...values,100),range=Math.max(1,max-min);const coords=values.map((v,i)=>(24+i*252/Math.max(1,values.length-1))+","+(86-(v-min)*66/range));return '<div class="card"><b>Quality score trend</b><svg viewBox="0 0 300 100" role="img" aria-label="Quality score history" style="width:100%;height:110px"><polyline fill="none" stroke="#a3e635" stroke-width="2.5" points="'+coords.join(" ")+'"/>'+coords.map((point,i)=>{const xy=point.split(",");return '<circle cx="'+xy[0]+'" cy="'+xy[1]+'" r="3" fill="#67e8f9"><title>'+esc(values[i])+':100</title></circle>';}).join("")+'</svg><div class="run-meta">'+values.length+' saved health snapshots</div></div>';})():'<div class="card"><b>Quality score trend</b><div class="empty">Generate more health snapshots to see a trend.</div></div>';
 const severity=Object.entries(c.quality.bySeverity).map(([name,count])=>'<span class="pill">'+esc(name)+": "+esc(count)+'</span>').join(" ");
 const langs=c.project.languages.slice(0,6).map(x=>'<span class="pill">'+esc(x.name)+": "+esc(x.files)+'</span>').join(" ");
 const recent=c.verification.recent.slice(0,5).map(x=>'<div class="rowitem"><b>'+esc(x.script)+'</b><span class="pill">'+esc(x.status)+' · '+esc(x.durationMs)+' ms</span></div>').join("");
 const dimensions=score.dimensions.map(x=>'<div class="rowitem"><div><b>'+esc(x.label)+'</b><div class="run-meta">'+esc(x.reason)+'</div></div><span class="pill">'+(x.score===null?"NOT ASSESSED":esc(x.score)+"/100")+(x.available?"":" · excluded") +'</span></div>').join("");
 const security=c.dependencySecurity;
 const securityLine='<div class="run-meta"><b>Dependency security:</b> '+(security.assessed?esc(security.vulnerabilities)+' findings (critical '+esc(security.critical)+', high '+esc(security.high)+', moderate '+esc(security.moderate)+', low '+esc(security.low)+')':"NOT ASSESSED — import npm audit JSON to include this dimension")+'</div>';
 el("healthPanel").innerHTML='<div class="grid">'+cards+'</div><div><b>Unified score dimensions</b><div class="activity">'+dimensions+'</div>'+securityLine+'</div>'+chart+'<div><b>Findings by severity</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+severity+'</div></div><div><b>Languages</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+(langs||"No language data") +'</div></div><div><b>Recent checks</b>'+(recent||'<div class="empty">No verification runs yet.</div>')+'</div><div class="run-meta">Snapshots are created on request. Unified score is a weighted heuristic; evidence coverage shows which dimensions were available. Verification history is local, and dependency findings require an imported npm audit report.</div>';
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

let workflowTasks=[];
let workflowDragId="";
function workflowSlug(value){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"custom-workflow";}
function workflowEdges(){
 return workflowTasks.flatMap(task=>(task.dependsOn||[]).map(dep=>({from:dep,to:task.id})));
}
let workflowTasks=[];
let workflowPositions={};
let workflowScale=1;
let workflowPan={x:0,y:0};
let workflowDrag=null;
let workflowSelected="";
function workflowSlug(value){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"custom-workflow";}
function workflowEdges(){return workflowTasks.flatMap(task=>(task.dependsOn||[]).map(dep=>({from:dep,to:task.id})));}
function ensureWorkflowPositions(){
 const levels=new Map();workflowTasks.forEach(task=>{const level=(task.dependsOn||[]).reduce((max,dep)=>Math.max(max,(levels.get(dep)||0)+1),0);levels.set(task.id,level);});
 const rows=new Map();workflowTasks.forEach(task=>{const level=levels.get(task.id)||0,row=rows.get(level)||0;rows.set(level,row+1);if(!workflowPositions[task.id])workflowPositions[task.id]={x:70+level*270,y:65+row*145};});
 Object.keys(workflowPositions).forEach(id=>{if(!workflowTasks.some(task=>task.id===id))delete workflowPositions[id];});
}
function renderWorkflow(){
 ensureWorkflowPositions();el("workflowTaskCount").textContent=workflowTasks.length+" TASKS · "+workflowEdges().length+" LINKS";
 const dependency=el("workflowDependency");const selected=[...dependency.selectedOptions].map(option=>option.value);dependency.innerHTML=workflowTasks.map(task=>'<option value="'+esc(task.id)+'">'+esc(task.title)+'</option>').join("");[...dependency.options].forEach(option=>option.selected=selected.includes(option.value));
 const edges=workflowEdges().map(edge=>{const a=workflowPositions[edge.from],b=workflowPositions[edge.to];if(!a||!b)return "";const x1=a.x+190,y1=a.y+48,x2=b.x,y2=b.y+48,m=(x1+x2)/2;return '<path class="workflow-edge" d="M '+x1+' '+y1+' C '+m+' '+y1+', '+m+' '+y2+', '+x2+' '+y2+'" marker-end="url(#wfArrow)"/>';}).join("");
 const nodes=workflowTasks.map(task=>{const p=workflowPositions[task.id];return '<g class="workflow-graph-node '+(workflowSelected===task.id?"selected":"")+'" data-graph-node="'+esc(task.id)+'" transform="translate('+p.x+' '+p.y+')" tabindex="0"><rect width="190" height="96" rx="11"/><text x="12" y="22" class="wf-agent">'+esc(task.agent.toUpperCase())+'</text><text x="12" y="47" class="wf-title">'+esc(task.title.slice(0,26))+'</text><text x="12" y="69" class="wf-sub">'+(task.dependsOn||[]).length+' prerequisites · '+(task.requiresApproval?"approval gate":"no gate")+'</text><text x="12" y="85" class="wf-sub">'+esc(task.id)+'</text></g>';}).join("");
 el("workflowCanvas").innerHTML=workflowTasks.length?'<div class="workflow-toolbar"><button class="btn" id="wfZoomOut">−</button><button class="btn" id="wfZoomIn">+</button><button class="btn" id="wfFit">Fit</button><span class="run-meta" id="wfZoomLabel">'+Math.round(workflowScale*100)+'%</span></div><div class="workflow-graph-wrap"><svg id="workflowGraph" viewBox="0 0 1100 650" aria-label="Interactive agent dependency graph"><defs><marker id="wfArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#8298b2"/></marker></defs><g id="wfWorld" transform="translate('+workflowPan.x+' '+workflowPan.y+') scale('+workflowScale+')">'+edges+nodes+'</g></svg></div><div class="run-meta">Drag nodes to arrange · drag empty canvas to pan · wheel or buttons to zoom · arrows show dependencies</div><div class="actions"><button class="btn" id="applyWorkflowLinks">Apply selected links</button><button class="btn" id="removeSelectedWorkflowNode">Remove selected node</button></div>':'<div class="empty">Add a specialist task to start composing your pipeline.</div>';
 const svg=el("workflowGraph");if(!svg)return;const world=el("wfWorld");
 function point(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};const q=p.matrixTransform(matrix.inverse());return{x:(q.x-workflowPan.x)/workflowScale,y:(q.y-workflowPan.y)/workflowScale};}
 svg.querySelectorAll("[data-graph-node]").forEach(node=>{node.addEventListener("click",()=>{workflowSelected=node.dataset.graphNode;const task=workflowTasks.find(item=>item.id===workflowSelected);dependency.querySelectorAll("option").forEach(option=>option.selected=!!task&&(task.dependsOn||[]).includes(option.value));});node.addEventListener("pointerdown",event=>{event.stopPropagation();const id=node.dataset.graphNode;workflowSelected=id;const q=point(event),p=workflowPositions[id];workflowDrag={kind:"node",id,dx:p.x-q.x,dy:p.y-q.y};node.setPointerCapture(event.pointerId);});node.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();workflowSelected=node.dataset.graphNode;renderWorkflow();}});});
 svg.addEventListener("pointerdown",event=>{if(event.target.closest("[data-graph-node]"))return;workflowDrag={kind:"pan",x:event.clientX,y:event.clientY,px:workflowPan.x,py:workflowPan.y};svg.setPointerCapture(event.pointerId);});
 svg.addEventListener("pointermove",event=>{if(!workflowDrag)return;if(workflowDrag.kind==="node"){const q=point(event);workflowPositions[workflowDrag.id]={x:Math.max(0,Math.min(3900,q.x+workflowDrag.dx)),y:Math.max(0,Math.min(2900,q.y+workflowDrag.dy))};const n=world.querySelector('[data-graph-node="'+workflowDrag.id+'"]');if(n)n.setAttribute("transform","translate("+workflowPositions[workflowDrag.id].x+" "+workflowPositions[workflowDrag.id].y+")");}else{workflowPan={x:workflowDrag.px+event.clientX-workflowDrag.x,y:workflowDrag.py+event.clientY-workflowDrag.y};world.setAttribute("transform","translate("+workflowPan.x+" "+workflowPan.y+") scale("+workflowScale+")");}});
 svg.addEventListener("pointerup",()=>{if(workflowDrag&&workflowDrag.kind==="node")renderWorkflow();workflowDrag=null;});svg.addEventListener("pointercancel",()=>{workflowDrag=null;});
 function zoom(next){workflowScale=Math.max(.4,Math.min(2,next));world.setAttribute("transform","translate("+workflowPan.x+" "+workflowPan.y+") scale("+workflowScale+")");el("wfZoomLabel").textContent=Math.round(workflowScale*100)+"%";}
 svg.addEventListener("wheel",event=>{event.preventDefault();zoom(workflowScale*(event.deltaY<0?1.1:.9));},{passive:false});el("wfZoomIn").addEventListener("click",()=>zoom(workflowScale+.1));el("wfZoomOut").addEventListener("click",()=>zoom(workflowScale-.1));el("wfFit").addEventListener("click",()=>{workflowPan={x:0,y:0};zoom(1);});
 el("applyWorkflowLinks").addEventListener("click",()=>{const task=workflowTasks.find(item=>item.id===workflowSelected);if(!task){el("workflowMessage").textContent="Select a node first.";return;}task.dependsOn=[...dependency.selectedOptions].map(option=>option.value).filter(id=>id&&id!==task.id);renderWorkflow();el("workflowMessage").textContent="Links updated. Save to persist.";});
 el("removeSelectedWorkflowNode").addEventListener("click",()=>{if(!workflowSelected)return;const id=workflowSelected;workflowTasks=workflowTasks.filter(task=>task.id!==id).map(task=>({...task,dependsOn:(task.dependsOn||[]).filter(dep=>dep!==id)}));delete workflowPositions[id];workflowSelected="";renderWorkflow();});
}
async function refreshWorkflows(){
 try{const workflows=await api("/api/workflows");el("savedWorkflows").innerHTML=workflows.length?workflows.map(workflow=>'<div class="run"><div class="run-title"><b>'+esc(workflow.name)+'</b><span class="pill">'+esc(workflow.tasks.length)+' TASKS</span></div><div class="run-meta">'+esc(workflow.description||"Reusable agent workflow")+' · '+esc(workflow.id)+'</div><div class="actions"><button class="btn" data-load-workflow="'+esc(workflow.id)+'">Load into editor</button><button class="btn" data-create-workflow-run="'+esc(workflow.id)+'">Create draft run</button></div></div>').join(""):'<div class="empty">No saved workflows yet. Compose one and save it here.</div>';
 el("savedWorkflows").querySelectorAll("[data-load-workflow]").forEach(button=>button.addEventListener("click",()=>loadWorkflowIntoEditor(button.dataset.loadWorkflow)));
 el("savedWorkflows").querySelectorAll("[data-create-workflow-run]").forEach(button=>button.addEventListener("click",()=>createWorkflowDraft(button.dataset.createWorkflowRun)));
 }catch(error){el("savedWorkflows").innerHTML='<div class="error">'+esc(error.message)+'</div>';}
}
async function saveCurrentWorkflow(){
 const name=el("workflowName").value.trim();if(!name||!workflowTasks.length){el("workflowMessage").textContent="Enter a workflow name and add at least one task.";return null;}
 const definition={id:workflowSlug(name),name,description:el("workflowDescription").value.trim(),tasks:workflowTasks,positions:workflowPositions};
 try{const saved=await fetch("/api/workflows",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(definition)});const data=await saved.json();if(!saved.ok)throw new Error(data.error||"Could not save workflow.");el("workflowMessage").textContent="Saved locally as .forge/workflows/"+data.id+".json";await refreshWorkflows();return data.id;}
 catch(error){el("workflowMessage").textContent=error.message;return null;}
}
async function createWorkflowDraft(id){
 try{const response=await fetch("/api/workflows/"+encodeURIComponent(id)+"/run",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not create draft run.");el("workflowMessage").textContent="Draft run "+data.id+" created. No agent has been called; review it and explicitly run/resume from the CLI.";await refreshWorkflows();await loadRuns();await inspectRun(data.id);}
 catch(error){el("workflowMessage").textContent=error.message;}
}
async function loadWorkflowIntoEditor(id){
 try{const workflows=await api("/api/workflows");const workflow=workflows.find(item=>item.id===id);if(!workflow)throw new Error("Workflow not found.");el("workflowName").value=workflow.name;el("workflowDescription").value=workflow.description;workflowTasks=workflow.tasks.map(task=>({...task,dependsOn:task.dependsOn||[]}));workflowPositions=workflow.positions||{};workflowPan={x:0,y:0};workflowScale=1;renderWorkflow();el("workflowMessage").textContent="Loaded "+workflow.name+" into the editor. Save to update its local definition.";}
 catch(error){el("workflowMessage").textContent=error.message;}
}

function loadWorkflowTemplate(kind){
 const feature=[
  {id:"scope",agent:"architect",title:"Map architecture and scope",prompt:"Map relevant modules, interfaces, constraints and change boundaries.",dependsOn:[]},
  {id:"plan",agent:"planner",title:"Plan implementation",prompt:"Create a file-level implementation plan with acceptance criteria.",dependsOn:["scope"]},
  {id:"security",agent:"security-reviewer",title:"Review security",prompt:"Review trust boundaries, input validation, permissions and secret handling.",dependsOn:["plan"],requiresApproval:true},
  {id:"tests",agent:"test-engineer",title:"Design verification",prompt:"Define unit, integration and regression tests for the planned change.",dependsOn:["plan"]},
  {id:"review",agent:"code-reviewer",title:"Independent review",prompt:"Review the plan and specialist findings for defects and missed edge cases.",dependsOn:["security","tests"]},
  {id:"release",agent:"release-manager",title:"Readiness summary",prompt:"Summarize unresolved risks and required checks. Do not claim unrun checks passed.",dependsOn:["review"]}
 ];
 const security=[
  {id:"inventory",agent:"architect",title:"Map attack surface",prompt:"Identify entry points, trust boundaries, sensitive data and external dependencies.",dependsOn:[]},
  {id:"appsec",agent:"security-reviewer",title:"Application security review",prompt:"Assess auth, authorization, input validation, injection risks and secret handling.",dependsOn:["inventory"]},
  {id:"deps",agent:"database-reviewer",title:"Data and dependency review",prompt:"Review data access, migrations, dependency exposure and least-privilege assumptions.",dependsOn:["inventory"]},
  {id:"verify",agent:"test-engineer",title:"Security verification plan",prompt:"Propose safe tests for identified security risks. Do not execute destructive tests.",dependsOn:["appsec","deps"],requiresApproval:true},
  {id:"report",agent:"release-manager",title:"Security findings report",prompt:"Prioritize evidence-backed findings, mitigations and follow-up verification.",dependsOn:["verify"]}
 ];
 workflowTasks=(kind==="security"?security:feature).map(task=>({...task,requiresApproval:task.requiresApproval??false}));workflowPositions={};workflowPan={x:0,y:0};workflowScale=1;workflowSelected="";
 el("workflowName").value=kind==="security"?"Security audit pipeline":"Feature delivery pipeline";
 el("workflowDescription").value=kind==="security"?"Parallel security and data review followed by gated verification.":"Architecture-led feature planning with parallel specialist checks and a final readiness review.";
 renderWorkflow();el("workflowMessage").textContent="Template loaded. Customize the tasks and save it as your own workflow.";
}
el("templateFeature").addEventListener("click",()=>loadWorkflowTemplate("feature"));
el("templateSecurity").addEventListener("click",()=>loadWorkflowTemplate("security"));
\nel("addWorkflowTask").addEventListener("click",()=>{
 const title=el("workflowTaskTitle").value.trim(),prompt=el("workflowTaskPrompt").value.trim();if(!title||!prompt){el("workflowMessage").textContent="A task title and instructions are required.";return;}if(workflowTasks.length>=30){el("workflowMessage").textContent="A workflow can contain at most 30 tasks.";return;}
 const id=workflowSlug(title).slice(0,30)+"-"+(workflowTasks.length+1);const dependencies=[...el("workflowDependency").selectedOptions].map(option=>option.value).filter(Boolean);
 workflowTasks.push({id,agent:el("workflowAgent").value,title,prompt,dependsOn:dependencies,requiresApproval:el("workflowRequiresApproval").checked});workflowPositions[id]={x:70+(workflowTasks.length-1)*40,y:65+(workflowTasks.length-1)*115};
 el("workflowTaskTitle").value="";el("workflowTaskPrompt").value="";el("workflowRequiresApproval").checked=false;renderWorkflow();el("workflowMessage").textContent="Task added to the pipeline.";
});
el("clearWorkflowTasks").addEventListener("click",()=>{workflowTasks=[];renderWorkflow();});
el("applyWorkflowLinks").addEventListener("click",()=>{const id=el("applyWorkflowLinks").dataset.taskId;const task=workflowTasks.find(item=>item.id===id);if(!task)return;task.dependsOn=[...el("workflowDependency").selectedOptions].map(option=>option.value).filter(value=>value&&value!==id);renderWorkflow();el("workflowMessage").textContent="Dependency links updated. Save to persist them.";});
el("saveWorkflow").addEventListener("click",saveCurrentWorkflow);
el("createWorkflowRun").addEventListener("click",async()=>{const id=await saveCurrentWorkflow();if(id)await createWorkflowDraft(id);});
el("refreshWorkflows").addEventListener("click",refreshWorkflows);renderWorkflow();refreshWorkflows();
el("codeSearchButton").addEventListener("click",runCodeSearch);el("codeSearchQuery").addEventListener("keydown",event=>{if(event.key==="Enter")runCodeSearch();});\nel("workspaceUp").addEventListener("click",()=>loadWorkspace(workspaceDirectory.includes("/")?workspaceDirectory.slice(0,workspaceDirectory.lastIndexOf("/")):""));
el("refreshDependencyIntel").addEventListener("click",loadDependencyIntelligence);loadDependencyIntelligence();el("refreshTimeline").addEventListener("click",loadIntelligenceTimeline);loadIntelligenceTimeline();el("refreshChangeRisk").addEventListener("click",loadChangeRisk);loadChangeRisk();el("refreshRisk").addEventListener("click",loadEngineeringRisk);el("refreshDependencyGraph").addEventListener("click",loadDependencyGraph);loadEngineeringRisk();el("dependencyFilter").addEventListener("input",()=>{if(dependencyGraphData)renderDependencyGraph(dependencyGraphData);});el("dependencyMode").addEventListener("change",()=>{if(dependencyGraphData)renderDependencyGraph(dependencyGraphData);});el("refreshMap").addEventListener("click",loadMap);loadDependencyGraph();loadWorkspace();el("refreshHealth").addEventListener("click",loadHealth);el("refreshRegression").addEventListener("click",loadRegression);el("refreshReviews").addEventListener("click",loadReviews);el("refreshActivity").addEventListener("click",()=>{loadActivity();loadRuns();});loadOverview();loadAgents();loadRuns();loadActivity();loadMap();loadQuality();loadVerifications();loadHealth();loadRegression();loadReviews();setInterval(()=>{loadActivity();loadRuns();loadVerifications();if(selectedRunId)inspectRun(selectedRunId);},5000);
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
      if (request.method === "POST" && (requestUrl.pathname === "/api/workflows" || requestUrl.pathname.endsWith("/run") && requestUrl.pathname.startsWith("/api/workflows/"))) {
        const origin = request.headers.origin;
        if (origin && new URL(origin).host !== request.headers.host) {
          response.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: "Cross-origin requests are not allowed." }));
          return;
        }
        if (!request.headers["content-type"]?.includes("application/json")) {
          response.writeHead(415, { "content-type": "application/json" }).end(JSON.stringify({ error: "Expected application/json." }));
          return;
        }
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { size += chunk.length; if (size > 16384) { response.writeHead(413, { "content-type": "application/json" }).end(JSON.stringify({ error: "Request body is too large." })); return; } chunks.push(Buffer.from(chunk)); }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        if (requestUrl.pathname === "/api/workflows") {
          const workflow = await saveWorkflow(projectPath, body);
          response.writeHead(201, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(workflow));
          return;
        }
        const runId = requestUrl.pathname.slice("/api/workflows/".length, -"/run".length);
        const workflow = await loadWorkflow(projectPath, decodeURIComponent(runId));
        const run = createRunFromWorkflow(workflow);
        await saveRun(projectPath, run);
        response.writeHead(201, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({ id: run.id, status: run.status, taskCount: run.tasks.length }));
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
      if (requestUrl.pathname === "/api/workflows") {
        const workflows = await listWorkflows(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(workflows));
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
      const traceRoute = requestUrl.pathname.match(/^\/api\/runs\/([^/]+)\/trace$/);
      if (traceRoute) {
        try {
          const trace = await loadExecutionTrace(projectPath, decodeURIComponent(traceRoute[1]!));
          response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(trace));
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            response.writeHead(404, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({ error: "No execution trace has been saved for this run." }));
            return;
          }
          throw error;
        }
        return;
      }
      if (requestUrl.pathname.startsWith("/api/runs/")) {
        const runId = decodeURIComponent(requestUrl.pathname.slice("/api/runs/".length));
        const run = await loadRun(projectPath, runId);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({
          id: run.id, goal: run.goal, status: run.status, createdAt: run.createdAt, updatedAt: run.updatedAt,
          tasks: run.tasks.map(record => ({
            id: record.task.id, title: record.task.title, agent: record.task.agent, status: record.status,
            dependsOn: record.task.dependsOn ?? [],
            result: record.result ? { provider: record.result.provider, model: record.result.model, content: record.result.content } : undefined,
            error: record.error,
            approval: record.approval,
          })),
          events: run.events.map(event => ({ at: event.at, taskId: event.taskId, type: event.type, message: event.message })),
        }));
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
      if (requestUrl.pathname === "/api/search") {
        const query = requestUrl.searchParams.get("q") ?? "";
        const limit = Number(requestUrl.searchParams.get("limit") ?? 80);
        const report = await searchWorkspace(projectPath, query, limit);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(report));
        return;
      }
      if (requestUrl.pathname === "/api/workspace") {
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
      if (requestUrl.pathname === "/api/dependency-intelligence") {
        const report = await analyzeDependencies(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(report));
        return;
      }
      if (requestUrl.pathname === "/api/intelligence-timeline") {
        const [comparison, snapshots] = await Promise.all([
          compareLatestIntelligence(projectPath), listIntelligenceSnapshots(projectPath)
        ]);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({ comparison, snapshots }));
        return;
      }
      if (requestUrl.pathname === "/api/change-intelligence") {
        const report = await analyzeChangeIntelligence(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(report));
        return;
      }
      if (requestUrl.pathname === "/api/engineering-risk") {
        const report = await analyzeEngineeringRisk(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(report));
        return;
      }
      if (requestUrl.pathname === "/api/dependency-graph") {
        const graph = await buildDependencyGraph(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(graph));
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
