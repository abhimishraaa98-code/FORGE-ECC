import { createServer, type Server } from "node:http";
import { inspectProject } from "./project-inspector.js";
import { mapArchitecture } from "./architecture-map.js";
import { listRuns } from "./run-store.js";
import { loadAgentRegistry } from "./agent-registry.js";

const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#090b10"><title>FORGE — Engineering Workbench</title>
<style>
:root{color-scheme:dark;--bg:#090b10;--panel:#11151e;--panel2:#151b27;--line:#252d3b;--muted:#8e9aab;--text:#edf2f8;--accent:#a3e635;--cyan:#67e8f9}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 75% -15%,#1c2935 0,transparent 38%),var(--bg);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}
.shell{max-width:1440px;margin:auto;padding:28px 34px}.top{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:22px}.brand{display:flex;gap:13px;align-items:center}.mark{width:42px;height:42px;border:1px solid #52652e;background:#18220f;color:var(--accent);display:grid;place-items:center;border-radius:12px;font-weight:900;font-size:19px;letter-spacing:-2px}.brand strong{font-size:17px;letter-spacing:2px}.brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:.4px}.status{color:var(--accent);font-size:12px;border:1px solid #3d5127;padding:6px 10px;border-radius:30px}.hero{padding:36px 0 25px}.eyebrow{color:var(--accent);font-size:11px;letter-spacing:2px;font-weight:700}.hero h1{font-size:clamp(27px,4vw,42px);line-height:1.1;letter-spacing:-1.5px;margin:8px 0}.hero p{color:var(--muted);margin:0;max-width:680px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:linear-gradient(145deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:15px;padding:18px;min-width:0}.metric-label{color:var(--muted);font-size:12px}.metric{font-size:30px;font-weight:700;letter-spacing:-1px;margin-top:5px}.metric-sub{color:#718094;font-size:11px;margin-top:2px}.section{margin-top:24px}.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.section h2{font-size:15px;margin:0;letter-spacing:.2px}.muted{color:var(--muted)}.columns{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.list{display:grid;gap:10px}.rowitem{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #202734}.rowitem:last-child{border:0}.rowitem b{font-weight:600}.pill{font-size:10px;border:1px solid var(--line);border-radius:20px;padding:3px 8px;color:#c3cedb;white-space:nowrap}.barline{height:6px;background:#252d3b;border-radius:10px;margin-top:7px;overflow:hidden}.barline span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--cyan));border-radius:10px}.run{padding:13px 0;border-bottom:1px solid #202734}.run:last-child{border:0}.run-title{display:flex;justify-content:space-between;gap:12px}.run-goal{font-weight:600;overflow-wrap:anywhere}.run-meta{color:var(--muted);font-size:11px;margin-top:4px}.empty{padding:25px 10px;text-align:center;color:var(--muted)}.actions{display:flex;gap:8px}.btn{background:#1a222e;color:var(--text);border:1px solid #354154;border-radius:9px;padding:8px 12px;font:inherit;font-size:12px;cursor:pointer}.btn:hover{border-color:var(--accent)}.architecture{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px}.node{background:#151c28;border:1px solid #2b3748;border-radius:9px;padding:10px;font-size:11px;overflow-wrap:anywhere}.node small{display:block;color:var(--muted);margin-top:4px}.footer{margin:28px 0 5px;padding-top:15px;border-top:1px solid var(--line);color:#718094;font-size:11px;display:flex;justify-content:space-between;gap:10px}.error{color:#fca5a5}.loading{color:var(--muted);padding:15px 0}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.columns{grid-template-columns:1fr}}@media(max-width:560px){.shell{padding:18px 15px}.top{align-items:flex-start}.status{font-size:10px}.grid{gap:9px}.card{padding:14px}.metric{font-size:25px}.hero{padding:28px 0 20px}.footer{flex-direction:column}}
</style></head>
<body><main class="shell">
<header class="top"><div class="brand"><div class="mark">F.</div><div><strong>FORGE</strong><small>THE AI ENGINEERING WORKBENCH</small></div></div><div class="status">● LOCAL WORKSPACE</div></header>
<section class="hero"><div class="eyebrow">ENGINEERING CONTROL CENTER / 01</div><h1>Build with context.<br>Ship with confidence.</h1><p>A live overview of your codebase, architecture signals and AI-assisted engineering runs.</p></section>
<section class="grid" id="metrics"><div class="card"><div class="metric-label">Source files</div><div class="metric">—</div><div class="metric-sub">Scanning workspace</div></div><div class="card"><div class="metric-label">Directories</div><div class="metric">—</div><div class="metric-sub">Project structure</div></div><div class="card"><div class="metric-label">Dependencies</div><div class="metric">—</div><div class="metric-sub">Production + development</div></div><div class="card"><div class="metric-label">Saved runs</div><div class="metric">—</div><div class="metric-sub">Local execution history</div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Language composition</h2><span class="pill">PROJECT INTELLIGENCE</span></div><div id="languages" class="list"><div class="loading">Loading language data…</div></div></div><div class="card"><div class="section-head"><h2>Detected stack</h2><span class="pill">ENVIRONMENT</span></div><div id="stack" class="list"><div class="loading">Detecting frameworks…</div></div></div></section>
<section class="section columns"><div class="card"><div class="section-head"><h2>Specialist agents</h2><span class="pill">AGENT REGISTRY</span></div><div id="agents"><div class="loading">Loading agent roles…</div></div></div><div class="card"><div class="section-head"><h2>Recent runs</h2><span class="pill">LOCAL HISTORY</span></div><div id="runs"><div class="loading">Loading saved runs…</div></div></div><div class="card"><div class="section-head"><h2>Project signals</h2><span class="pill">INSIGHTS</span></div><div id="signals" class="list"><div class="loading">Collecting project signals…</div></div></div></section>
<section class="section card"><div class="section-head"><h2>Architecture snapshot</h2><div class="actions"><span class="pill">STATIC IMPORT MAP</span><button class="btn" id="refreshMap">Refresh map</button></div></div><div id="architecture" class="architecture"><div class="loading">Architecture map will appear here.</div></div></section>
<footer class="footer"><span>FORGE v0.6.0 · EARLY ACCESS</span><span>Read-only dashboard · Data stays on this machine</span></footer>
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
async function loadRuns(){try{const data=await api("/api/runs");el("runs").innerHTML=data.length?data.slice(0,7).map(run=>'<div class="run"><div class="run-title"><span class="run-goal">'+esc(run.goal)+'</span><span class="pill">'+esc(run.status)+'</span></div><div class="run-meta">'+esc(run.id)+' · '+esc(new Date(run.createdAt).toLocaleString())+' · '+run.tasks.length+' tasks</div></div>').join(""):'<div class="empty">No saved runs yet. Create one with <code>forge plan --goal "..."</code>.</div>';}catch(error){el("runs").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
async function loadMap(){el("architecture").innerHTML='<div class="loading">Mapping source relationships…</div>';try{const data=await api("/api/architecture");el("architecture").innerHTML=data.nodes.length?data.nodes.slice(0,36).map(node=>'<div class="node">'+esc(node.file)+'<small>'+esc(node.role)+' · '+node.imports.length+' imports · '+node.lines+' lines</small></div>').join(""):'<div class="empty">No supported source files found.</div>';}catch(error){el("architecture").innerHTML='<div class="error">'+esc(error.message)+'</div>';}}
el("refreshMap").addEventListener("click",loadMap);loadOverview();loadAgents();loadRuns();loadMap();
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
      if (request.method !== "GET") {
        response.writeHead(405, { "content-type": "application/json" }).end(JSON.stringify({ error: "Method not allowed." }));
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
      if (requestUrl.pathname === "/api/runs") {
        const runs = await listRuns(projectPath);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(runs.map(run => ({
          id: run.id, goal: run.goal, status: run.status, createdAt: run.createdAt,
          tasks: run.tasks.map(task => ({ id: task.task.id, status: task.status })),
        }))));
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
