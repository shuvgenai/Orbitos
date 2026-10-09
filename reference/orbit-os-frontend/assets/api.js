/* Mock API. Every function here maps to one real ORBIT endpoint (see README: API contract).
   Screens only call API.*, so replacing this file with fetch() calls is the whole backend swap. */
window.API = (function(){
  const S = () => Store.get(), U = Store.update, uid = Store.uid;
  const person = id => S().people.find(p => p.id === id);
  const agent = id => S().agents.find(a => a.id === id);
  const dept = id => S().departments.find(d => d.id === id);
  const toolName = k => (MCPS[k]||{}).name || k;
  const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e||'');
  const who = () => { const r = Router.parse().role; return r==='admin' ? 'Org Admin' : r==='super' ? 'Operator' : 'User'; };
  let jobActive = false;

  /* ---------- org structure  (POST /api/org/structure) ---------- */
  function applyTemplate(tid){ const t = OrgTemplates.find(x=>x.id===tid); if(!t) return;
    U(s => { s.org.template = tid; t.depts.forEach(n => { if(!s.departments.some(d=>d.name.toLowerCase()===n.toLowerCase())) s.departments.push({id:uid('d_'),name:n}); }); }); }
  const addDept = name => { name=(name||'').trim(); if(!name) return 'Enter a name.'; if(S().departments.some(d=>d.name.toLowerCase()===name.toLowerCase())) return 'That department already exists.';
    U(s => s.departments.push({id:uid('d_'),name})); return ''; };
  const renameDept = (id,name) => { name=(name||'').trim(); if(name) U(s => { dept2(s,id).name = name; }); };
  const dept2 = (s,id) => s.departments.find(d=>d.id===id);
  const deptUse = id => S().people.filter(p=>p.deptId===id).length + S().agents.filter(a=>a.deptId===id).length;
  const removeDept = id => { if(deptUse(id)) return 'Move its people and agents first.'; U(s => { s.departments = s.departments.filter(d=>d.id!==id); }); return ''; };
  const addPerson = p => U(s => s.people.push({id:uid('p_'), name:'', email:'', title:'', deptId:s.departments[0]?s.departments[0].id:null, access:'user', authorities:[], ...p}));
  const updatePerson = (id,patch) => U(s => { Object.assign(s.people.find(p=>p.id===id), patch); });
  const toggleAuthority = (id,a) => U(s => { const p = s.people.find(x=>x.id===id); p.authorities = p.authorities.includes(a) ? p.authorities.filter(x=>x!==a) : p.authorities.concat(a); });
  const removePerson = id => { if(S().agents.some(a=>a.ownerId===id)) return 'Reassign their agents first.'; U(s => { s.people = s.people.filter(p=>p.id!==id); }); return ''; };
  function validateOrg(){ const s = S(), e = [];
    if(!s.departments.length) e.push('Add at least one department.');
    if(!s.people.some(p=>p.authorities.includes('leader'))) e.push('Mark at least one person as a Leader (the board that approves big decisions).');
    if(!s.people.some(p=>p.access==='admin')) e.push('Keep at least one Org Admin.');
    const seen = {}; s.people.forEach(p => { if(!p.name.trim()) e.push('Every person needs a name.'); if(!emailOk(p.email)) e.push((p.name||'A person')+' needs a valid email.'); else if(seen[p.email.toLowerCase()]) e.push('Email used twice: '+p.email); seen[(p.email||'').toLowerCase()] = 1; if(!p.deptId) e.push((p.name||'A person')+' needs a department.'); });
    return [...new Set(e)]; }

  /* ---------- agents  (POST /api/agents -> create teammate in org chart + runtime profile) ---------- */
  const coordinator = () => S().agents.find(a=>a.type==='coordinator');
  function descendants(id){ const out = []; const walk = i => S().agents.filter(a=>a.managerId===i).forEach(a => { out.push(a.id); walk(a.id); }); walk(id); return out; }
  function provision(a, s, missing){ a.provisioned = true; a.runtime = a.runtime || {paperclipId:'agt_'+Math.random().toString(36).slice(2,8), hermesProfile:(s.org.name.split(' ')[0]).toLowerCase()+'-'+a.name.toLowerCase().replace(/\s+/g,'-'), adapter:'hermes_gateway'};
    const miss = a.tools.filter(t => !(s.connections[t] && s.connections[t].on));
    if(miss.length){ a.status='paused'; a.blockedBy=miss; a.doing='Waiting for '+miss.map(toolName).join(', ')+' to be connected'; } else { a.status='idle'; a.blockedBy=[]; a.doing='Ready. Wakes on the next task'; } }
  function createAgent(spec){ const s0 = S(); const errs = [];
    if(!(spec.name||'').trim()) errs.push('Give the agent a name.');
    else if(s0.agents.some(a=>a.name.toLowerCase()===spec.name.trim().toLowerCase() && a.id!==spec.id)) errs.push('Another agent already has that name.');
    if(!(spec.job||'').trim()) errs.push('Describe its job in one line.');
    if((spec.prompt||'').trim().length<20) errs.push('Write at least 20 characters of instructions.');
    if(spec.type==='coordinator' && s0.agents.some(a=>a.type==='coordinator' && a.id!==spec.id)) errs.push('Only one Coordinator is allowed.');
    if(spec.type!=='coordinator' && !spec.managerId) errs.push('Choose who it reports to.');
    if(spec.type!=='coordinator' && spec.managerId && spec.id && descendants(spec.id).includes(spec.managerId)) errs.push('That would create a loop in the org chart.');
    if(!(+spec.budget>0)) errs.push('Set a monthly budget above $0.');
    if(errs.length) return errs;
    U(s => { const body = {name:spec.name.trim(), job:spec.job.trim(), type:spec.type, deptId:spec.deptId||null, managerId:spec.type==='coordinator'?null:spec.managerId, prompt:spec.prompt.trim(), tools:spec.tools.slice(), budget:+spec.budget, jobId:spec.jobId||null};
      if(spec.id){ const a = s.agents.find(x=>x.id===spec.id); const pc = a.prompt.trim()!==body.prompt; Object.assign(a, body); if(pc){ a.version++; a.versions.push({v:a.version,prompt:body.prompt,at:Date.now(),by:'Org Admin'}); } if(s.org.launched) provision(a,s); }
      else { const a = {id:uid('a_'), ...body, ownerId:null, status:'draft', doing:'Not started', version:1, guardrails:s.org.guardrails.slice(), runsToday:0, costToday:0, lastActive:Date.now(), provisioned:false,
        perf:{daily:[0,0,0,0,0,0,0],success:100,avgSec:0,edited:0,cost7:0}, versions:[{v:1,prompt:body.prompt,at:Date.now(),by:'Org Admin'}]};
        if(s.org.launched){ provision(a,s); } s.agents.push(a); }
      Store.audit('Org Admin', (spec.id?'updated ':'added agent ')+body.name); });
    return []; }
  function removeAgent(id){ const a = agent(id); if(!a) return ''; if(S().agents.some(x=>x.managerId===id)) return 'Other agents report to '+a.name+'. Move them first.';
    if(a.type==='coordinator' && S().agents.length>1) return 'Remove the other agents before the Coordinator.';
    U(s => { s.agents = s.agents.filter(x=>x.id!==id); Store.audit('Org Admin','removed agent '+a.name); }); return ''; }
  function validateAgents(){ const s = S(), e = [];
    if(!s.agents.some(a=>a.type==='coordinator')) e.push('Add one Coordinator. It sits at the top and routes work.');
    if(!s.agents.some(a=>a.type==='specialist')) e.push('Add at least one specialist agent.');
    return e; }

  /* ---------- assignment  (PUT /api/agents/:id/owner) ---------- */
  const assign = (agentId, personId) => U(s => { const a = s.agents.find(x=>x.id===agentId); a.ownerId = personId || null; Store.audit('Org Admin', personId ? a.name+' assigned to '+s.people.find(p=>p.id===personId).name : a.name+' unassigned'); });
  function autoAssign(){ U(s => { s.agents.forEach(a => { if(a.ownerId) return; let p;
      if(a.type==='coordinator') p = s.people.find(x=>x.authorities.includes('leader')) || s.people.find(x=>x.access==='admin');
      else { const inDept = s.people.filter(x=>x.deptId===a.deptId); p = inDept.find(x=>x.authorities.includes('approver')) || inDept[0] || s.people.find(x=>x.access==='user') || s.people[0]; }
      if(p) a.ownerId = p.id; }); Store.audit('Org Admin','auto-assigned agents by department'); }); }
  const validateAssign = () => S().agents.filter(a=>!a.ownerId||!person(a.ownerId)).length ? [S().agents.filter(a=>!a.ownerId||!person(a.ownerId)).map(a=>a.name).join(', ')+' still need an owner.'] : [];
  const agentsOf = pid => S().agents.filter(a=>a.ownerId===pid);

  /* ---------- tools / MCP  (POST /api/connections) ---------- */
  function requiredTools(){ const m = {}; S().agents.forEach(a => a.tools.forEach(t => (m[t] = m[t]||[]).push(a.id))); return m; }
  const isOn = k => !!(S().connections[k] && S().connections[k].on);
  function connect(k, mode){ U(s => { s.connections[k] = {on:true, mode, at:Date.now(), by:'Org Admin'}; s.agents.forEach(a => { if(a.provisioned && a.status==='paused' && a.blockedBy && a.blockedBy.length && a.tools.every(t=>s.connections[t]&&s.connections[t].on) && /to be connected/.test(a.doing)){ a.status='idle'; a.blockedBy=[]; a.doing='Ready. Wakes on the next task'; } }); Store.audit('Org Admin','connected '+toolName(k)+' ('+mode+')'); }); }
  function disconnect(k){ U(s => { delete s.connections[k]; s.agents.forEach(a => { if(a.provisioned && a.tools.includes(k)){ a.status='paused'; a.blockedBy=[k]; a.doing='Waiting for '+toolName(k)+' to be connected'; } }); Store.audit('Org Admin','disconnected '+toolName(k)); }); }
  function validateConnections(){ if(S().org.connectLater) return []; const miss = Object.keys(requiredTools()).filter(k=>!isOn(k)); return miss.length ? ['Connect '+miss.map(toolName).join(', ')+', or choose to connect later.'] : []; }

  /* ---------- launch = hiring job, resumable (POST /api/org/launch, GET /api/org/launch/status) ---------- */
  const JOB = [['company','Set up your office'],['chart','Build the org chart'],['agents','Hire your agents'],['profiles','Give each agent its own workspace'],['budgets','Set budgets'],['tools','Apply tool permissions'],['invites','Invite your people']];
  function startLaunch(simFail){ U(s => { s.org.job = {steps:JOB.map(([k,label])=>({k,label,status:'pending'})), simFail:!!simFail, failedOnce:false, error:'', done:false}; }, 'job'); run(); }
  function run(){ jobActive = true; const j = S().org.job; const i = j.steps.findIndex(x=>x.status!=='done'); if(i<0){ finish(); return; }
    U(s => { s.org.job.steps[i].status='run'; }, 'job');
    setTimeout(() => { const jj = S().org.job; if(jj.simFail && !jj.failedOnce && jj.steps[i].k==='profiles'){ U(s => { s.org.job.steps[i].status='fail'; s.org.job.failedOnce=true; s.org.job.error='Could not create the workspace for one agent. Nothing was lost. Retry resumes from this step.'; }, 'job'); jobActive=false; return; }
      U(s => { s.org.job.steps[i].status='done'; }, 'job'); run(); }, 600); }
  const retryJob = () => { U(s => { s.org.job.steps.forEach(x => { if(x.status==='fail'||x.status==='run') x.status='pending'; }); s.org.job.error=''; }, 'job'); run(); };
  function finish(){ jobActive = false; U(s => { s.org.launched = true; s.org.job.done = true; s.agents.forEach(a => provision(a, s)); s.people.forEach(p => { if(p.access!=='admin') p.invited = true; }); s.activity = Tasks.feed(s.agents); Store.audit('Org Admin','launched the office with '+s.agents.length+' agents'); }, 'job'); }

  /* ---------- agent requests (user -> org admin)  (POST /api/requests, POST /api/requests/:id/decision) ---------- */
  function submitRequest(by, q){ const body = {name:q.name.trim(),purpose:q.purpose.trim(),prompt:q.prompt.trim(),reason:q.reason.trim(),tools:q.tools.slice(),status:'pending',adminNote:'',at:Date.now()};
    U(s => { const ex = q.revising && s.requests.find(r=>r.id===q.revising); if(ex) Object.assign(ex, body); else s.requests.push({id:uid('rq'), by, ...body}); Store.audit(person(by).name,'asked for a new agent: '+body.name); }); }
  const cancelRequest = id => U(s => { s.requests = s.requests.filter(r=>r.id!==id); });
  function decide(id, decision, o){ U(s => { const r = s.requests.find(x=>x.id===id); r.status = decision; r.adminNote = o.note || (decision==='approved' ? (JSON.stringify(o.guards)!==JSON.stringify(s.org.guardrails)?'Approved with guardrails added.':'Approved.') : '');
      if(decision==='approved'){ const owner = s.people.find(p=>p.id===r.by); const c = s.agents.find(a=>a.type==='coordinator'); const a = {id:uid('a_'), jobId:null, name:r.name, job:r.purpose, type:'specialist', deptId:owner?owner.deptId:null, managerId:c?c.id:null, ownerId:r.by,
        status:'idle', doing:'Ready. Wakes on the next task', prompt:o.prompt.trim(), version:1, guardrails:o.guards.slice(), tools:r.tools.slice(), budget:15, runsToday:0, costToday:0, lastActive:Date.now(), provisioned:false,
        perf:{daily:[0,0,0,0,0,0,0],success:100,avgSec:0,edited:0,cost7:0}, versions:[{v:1,prompt:o.prompt.trim(),at:Date.now(),by:'Org Admin'}]}; provision(a,s); s.agents.push(a); }
      Store.audit('Org Admin', (decision==='approved'?'approved ':decision==='changes'?'asked for changes on ':'declined ')+r.name); }); }

  /* ---------- running agents (PUT /api/agents/:id) ---------- */
  function savePrompt(id, text, byName, guards){ U(s => { const a = s.agents.find(x=>x.id===id); if(text.trim()!==a.prompt.trim()){ a.version++; a.prompt = text.trim(); a.versions.push({v:a.version,prompt:a.prompt,at:Date.now(),by:byName}); }
    if(guards) a.guardrails = guards.slice(); Store.audit(byName,'updated '+a.name+' (v'+a.version+')'); }); }
  const togglePause = (id, byName) => U(s => { const a = s.agents.find(x=>x.id===id); if(!a.provisioned) return; const was = a.status==='paused'; a.status = was?'idle':'paused'; a.doing = was?'Ready. Wakes on the next task':'Paused by '+byName; Store.audit(byName,(was?'resumed ':'paused ')+a.name); });

  /* ---------- derived ---------- */
  const runs7 = a => a.perf.daily.reduce((t,x)=>t+x,0);
  const running = list => list.filter(a=>a.status==='running').length;

  /* ---------- live simulation (replace with a websocket/SSE feed) ---------- */
  function tick(){ if(!S().org.launched) return; U(st => { st.agents.filter(a=>a.provisioned && a.status!=='paused').forEach(a => { if(Math.random()<.3){ const r = Math.random();
      if(r<.55){ a.status='running'; a.doing=Tasks.make(a); a.runsToday++; a.costToday=+(a.costToday+.02+Math.random()*.05).toFixed(2); } else if(r<.7 && a.type!=='coordinator'){ a.status='waiting'; a.doing='Draft ready, waiting for approval'; } else { a.status='idle'; a.doing='Waiting for the next task'; } a.lastActive=Date.now(); } }); }, 'tick'); }

  return {person,agent,dept,toolName,emailOk,applyTemplate,addDept,renameDept,deptUse,removeDept,addPerson,updatePerson,toggleAuthority,removePerson,validateOrg,
    coordinator,descendants,createAgent,removeAgent,validateAgents,assign,autoAssign,validateAssign,agentsOf,requiredTools,isOn,connect,disconnect,validateConnections,
    startLaunch,retryJob,isJobActive:()=>jobActive,submitRequest,cancelRequest,decide,savePrompt,togglePause,runs7,running,tick,JOB};
})();
