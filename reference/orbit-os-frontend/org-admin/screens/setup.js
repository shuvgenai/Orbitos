/* Org Admin setup building blocks, used by the onboarding wizard AND the standalone pages.
   1 Org structure  ·  2 Agents  ·  3 Assign  ·  4 Connections  */
window.OA = window.OA || {};
(function(){
  const {esc, ic, initials, pill, statusPill, sel} = UI;
  const S = () => Store.get();
  const upd = (fn) => Store.update(fn);

  /* ===================== 1. ORG STRUCTURE ===================== */
  const AUTH = [['leader','Leader'],['approver','Approver'],['budget','Budget holder']];
  function orgTree(){
    const s = S(); const leaders = s.people.filter(p => p.authorities.includes('leader'));
    const deptNodes = s.departments.map(d => {
      const ppl = s.people.filter(p => p.deptId === d.id), ag = s.agents.filter(a => a.deptId === d.id);
      return `<li><div class="tnode"><span class="mono sm" aria-hidden="true">${esc(initials(d.name))}</span><span><b>${esc(d.name)}</b><small>${ppl.length} ${ppl.length===1?'person':'people'}${ag.length?`, ${ag.length} agent${ag.length>1?'s':''}`:''}</small></span></div>
        ${ppl.length?`<ul>${ppl.map(p => `<li><div class="tnode"><span class="av">${esc(initials(p.name||'?'))}</span><span><b>${esc(p.name||'New person')}</b><small>${esc(p.title||'No title')} · ${p.access==='admin'?'Org Admin':'User'}</small></span></div></li>`).join('')}</ul>`:''}</li>`; }).join('');
    return `<ul class="tree"><li><div class="tnode board"><span class="mono sm" aria-hidden="true">${ic('shield',14)}</span><span><b>The board</b><small>${leaders.length?esc(leaders.map(p=>p.name||'New person').join(', ')):'No Leader yet'}</small></span></div>
      <ul>${deptNodes || '<li><div class="tnode dim"><span><b>No departments yet</b><small>Add one or pick a template</small></span></div></li>'}</ul></li></ul>`;
  }
  OA.structureView = function(){
    const s = S(), me = Shell.me('admin');
    const deptRows = s.departments.map(d => `<div class="row" style="margin-bottom:8px"><input type="text" value="${esc(d.name)}" data-ch="dept-rename" data-id="${d.id}" aria-label="Department name"><button class="btn sm ghost danger" data-act="dept-del" data-id="${d.id}" aria-label="Remove ${esc(d.name)}">${ic('trash')}</button></div>`).join('');
    const rows = s.people.map(p => `<tr><td><input type="text" value="${esc(p.name)}" data-ch="p-name" data-id="${p.id}" placeholder="Full name" aria-label="Name"></td>
      <td><input type="email" value="${esc(p.email)}" data-ch="p-email" data-id="${p.id}" placeholder="name@company.com" aria-label="Email"></td>
      <td><input type="text" value="${esc(p.title)}" data-ch="p-title" data-id="${p.id}" placeholder="Title" aria-label="Title"></td>
      <td>${sel([['','Choose']].concat(s.departments.map(d=>[d.id,d.name])), p.deptId, `data-ch="p-dept" data-id="${p.id}" aria-label="Department"`)}</td>
      <td>${sel([['user','User'],['admin','Org Admin']], p.access, `data-ch="p-access" data-id="${p.id}" aria-label="Access"`)}</td>
      <td><div class="chips">${AUTH.map(([k,l]) => `<button type="button" class="chip" data-act="p-auth" data-id="${p.id}" data-a="${k}" aria-pressed="${p.authorities.includes(k)}">${l}</button>`).join('')}</div></td>
      <td>${p.id===me.id?'':`<button class="btn sm ghost danger" data-act="p-del" data-id="${p.id}" aria-label="Remove ${esc(p.name||'person')}">${ic('trash')}</button>`}</td></tr>`).join('');
    return `<div class="grid2">
      <section class="card pad"><h3 style="margin-bottom:10px">Your business</h3>
        <div class="field"><label for="orgname">Business name</label><input type="text" id="orgname" value="${esc(s.org.name)}" data-ch="org-name"></div>
        <div class="field"><span class="lbl">Start from a template</span><div class="chips" role="group" aria-label="Templates">${OrgTemplates.map(t=>`<button type="button" class="chip" data-act="tpl" data-id="${t.id}" aria-pressed="${s.org.template===t.id}">${esc(t.name)}</button>`).join('')}</div>
        <p class="help">Templates add starter departments. You can rename or remove any of them.</p></div></section>
      <section class="card pad"><h3 style="margin-bottom:10px">Departments</h3>${deptRows || '<p class="muted" style="margin-bottom:8px">No departments yet.</p>'}
        <div class="addrow"><input type="text" id="dnew" placeholder="New department, e.g. Sales" data-enter="dept-add" aria-label="New department"><button class="btn" data-act="dept-add">${ic('plus')} Add</button></div></section></div>
    <div class="sec-h"><h3>People</h3><button class="btn sm" data-act="p-add">${ic('plus')} Add person</button></div>
    <section class="card flush scroll"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Title</th><th>Department</th><th>Access</th><th>Authority</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>
    <p class="help" style="margin-top:8px"><b>Access</b> decides what someone can set up (User or Org Admin). <b>Authority</b> decides what they can approve. A Leader is part of the board. Invitations go out when you launch.</p>
    <div class="sec-h"><h3>Your org chart</h3></div><section class="card pad">${orgTree()}</section>`;
  };
  UI.chg('org-name', v => upd(s => { s.org.name = v.trim() || s.org.name; }));
  UI.act('tpl', (t,d) => API.applyTemplate(d.id));
  UI.act('dept-add', () => { const i = document.getElementById('dnew'); const e = API.addDept(i.value); if(e) UI.toast(e); });
  UI.chg('dept-rename', (v,t,d) => API.renameDept(d.id, v));
  UI.act('dept-del', (t,d) => { const e = API.removeDept(d.id); if(e) UI.toast(e); });
  UI.act('p-add', () => API.addPerson({}));
  ['name','email','title'].forEach(k => UI.chg('p-'+k, (v,t,d) => API.updatePerson(d.id, {[k]: v.trim()})));
  UI.chg('p-dept', (v,t,d) => API.updatePerson(d.id, {deptId: v || null}));
  UI.chg('p-access', (v,t,d) => API.updatePerson(d.id, {access: v}));
  UI.act('p-auth', (t,d) => API.toggleAuthority(d.id, d.a));
  UI.act('p-del', (t,d) => { const e = API.removePerson(d.id); if(e) UI.toast(e); });

  /* ===================== 2. AGENTS ===================== */
  let ag = null; // draft in the drawer
  function agentNodes(parentId){
    const kids = S().agents.filter(a => a.managerId === parentId);
    return kids.length ? `<ul>${kids.map(a => `<li><button class="tnode" data-act="agent-edit" data-id="${a.id}"><span class="mono sm" aria-hidden="true">${esc(initials(a.name))}</span><span><b>${esc(a.name)}</b><small>${esc(a.job)}</small></span></button>${agentNodes(a.id)}</li>`).join('')}</ul>` : '';
  }
  OA.agentsView = function(){
    const s = S(), c = API.coordinator(); const used = new Set(s.agents.map(a => a.jobId));
    const lib = Jobs.filter(j => !used.has(j.id) && (j.type!=='coordinator' || !c));
    const tree = `<ul class="tree"><li><div class="tnode board"><span class="mono sm" aria-hidden="true">${ic('shield',14)}</span><span><b>The board</b><small>Leaders approve big decisions</small></span></div>
      ${c ? `<ul><li><button class="tnode" data-act="agent-edit" data-id="${c.id}"><span class="mono sm" aria-hidden="true">${esc(initials(c.name))}</span><span><b>${esc(c.name)} ${pill('Coordinator','brand')}</b><small>${esc(c.job)}</small></span></button>${agentNodes(c.id)}</li></ul>` : `<ul><li><div class="tnode dim"><span><b>No Coordinator yet</b><small>Add ${esc(Jobs[0].name)} below to start</small></span></div></li></ul>`}</li></ul>`;
    return `<div class="note info" style="margin-bottom:14px"><b>Front Desk is built in.</b> It watches the inbox and is the only part that sends messages, and only text a person approved. It is not an AI agent, so you do not add it here.</div>
      <section class="card pad">${tree}</section>
      <div class="sec-h"><h3>Hire from a template</h3><button class="btn sm" data-act="agent-new">${ic('plus')} Create a custom agent</button></div>
      ${lib.length ? `<div class="grid">${lib.map(j => `<button class="card agent" style="text-align:left" data-act="agent-tpl" data-id="${j.id}" aria-label="Hire ${esc(j.name)}"><div class="row"><span class="mono" aria-hidden="true">${esc(initials(j.name))}</span><div class="grow"><b>${esc(j.name)}</b> ${j.type==='coordinator'?pill('Coordinator','brand'):''}<small style="display:block">${esc(j.job)}</small></div></div><div class="meta"><span>Tools: ${esc(j.tools.map(API.toolName).join(', '))}</span><span>$${j.budget}/month</span></div></button>`).join('')}</div>` : '<p class="muted">Every template is already on your team. Create a custom agent for anything else.</p>'}`;
  };
  function draftFrom(a, jt){
    const s = S(), c = API.coordinator();
    if(a) return {id:a.id, type:a.type, name:a.name, job:a.job, deptId:a.deptId, managerId:a.managerId, prompt:a.prompt, tools:a.tools.slice(), budget:a.budget, jobId:a.jobId, errs:[]};
    if(jt){ const d = s.departments.find(x => x.name === jt.dept) || s.departments[0]; return {id:null, type:jt.type, name:jt.name, job:jt.job, deptId:d?d.id:null, managerId:jt.type==='coordinator'?null:(c?c.id:null), prompt:jt.prompt, tools:jt.tools.slice(), budget:jt.budget, jobId:jt.id, errs:[]}; }
    return {id:null, type:c?'specialist':'coordinator', name:'', job:'', deptId:s.departments[0]?s.departments[0].id:null, managerId:c?c.id:null, prompt:'', tools:[], budget:15, jobId:null, errs:[]};
  }
  function agentDrawer(){
    const s = S(), a = ag, editing = !!a.id, c = API.coordinator();
    const blocked = editing ? API.descendants(a.id).concat(a.id) : [];
    const mgrOpts = s.agents.filter(x => !blocked.includes(x.id)).map(x => [x.id, x.name + (x.type==='coordinator'?' (Coordinator)':'')]);
    const typeLocked = editing || !!c;
    UI.open(`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="adt">
      <div class="dh"><h2 id="adt" class="grow">${editing?'Edit '+esc(a.name):'New agent'}</h2><button class="btn sm ghost" data-act="close" aria-label="Close">${ic('x')}</button></div>
      ${a.errs.length ? `<div class="note err" role="alert"><ul class="todo">${a.errs.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      <div class="row wrap"><div class="field grow"><label for="agn">Name</label><input type="text" id="agn" value="${esc(a.name)}" data-in="ag-name"></div>
        <div class="field grow"><label for="agt">Role</label>${typeLocked ? `<input type="text" id="agt" value="${a.type==='coordinator'?'Coordinator':'Specialist'}" readonly>` : sel([['coordinator','Coordinator (top of the chart)'],['specialist','Specialist']], a.type, 'id="agt" data-ch="ag-type"')}</div></div>
      <div class="field"><label for="agj">Job in one line</label><input type="text" id="agj" value="${esc(a.job)}" data-in="ag-job" placeholder="Qualifies new inbound leads"></div>
      <div class="row wrap"><div class="field grow"><label for="agd">Department</label>${sel([['','None']].concat(s.departments.map(d=>[d.id,d.name])), a.deptId, 'id="agd" data-ch="ag-dept"')}</div>
        <div class="field grow"><label for="agm">Reports to</label>${a.type==='coordinator' ? `<input type="text" id="agm" value="The board (Leaders)" readonly>` : sel(mgrOpts.length?mgrOpts:[['','Add a Coordinator first']], a.managerId, 'id="agm" data-ch="ag-mgr"')}</div></div>
      <div class="field"><label for="agp">Instructions</label><textarea id="agp" data-in="ag-prompt" style="min-height:130px">${esc(a.prompt)}</textarea><p class="help">Write it like a brief for a new assistant. Guardrails you add later always win over these instructions.</p></div>
      <div class="field"><span class="lbl">Tools it needs</span><div class="chips" role="group" aria-label="Tools">${Object.entries(MCPS).map(([k,m]) => `<button type="button" class="chip" data-act="ag-tool" data-id="${k}" aria-pressed="${a.tools.includes(k)}" ${m.tier==='soon'?'disabled title="Coming soon"':''}>${esc(m.name)}</button>`).join('')}</div></div>
      <div class="field"><label for="agb">Monthly budget (USD)</label><input type="number" id="agb" min="1" step="1" value="${esc(a.budget)}" data-in="ag-budget" style="max-width:140px"><p class="help">The agent pauses automatically when it reaches this.</p></div>
      ${s.org.launched?'<div class="note info">Changes apply from the next run.</div>':''}
      <div class="foot">${editing?`<button class="btn danger" data-act="agent-del">Remove agent</button><span class="sp"></span>`:''}<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="agent-save">${editing?'Save changes':'Add to team'}</button></div></section>`);
  }
  UI.act('agent-new', () => { ag = draftFrom(); agentDrawer(); });
  UI.act('agent-tpl', (t,d) => { ag = draftFrom(null, Jobs.find(j => j.id === d.id)); agentDrawer(); });
  UI.act('agent-edit', (t,d) => { ag = draftFrom(API.agent(d.id)); agentDrawer(); });
  UI.inp('ag-name', v => { ag.name = v; }); UI.inp('ag-job', v => { ag.job = v; }); UI.inp('ag-prompt', v => { ag.prompt = v; }); UI.inp('ag-budget', v => { ag.budget = v; });
  UI.chg('ag-dept', v => { ag.deptId = v || null; }); UI.chg('ag-mgr', v => { ag.managerId = v || null; });
  UI.chg('ag-type', v => { ag.type = v; ag.managerId = v==='coordinator' ? null : (API.coordinator()||{}).id || null; agentDrawer(); });
  UI.act('ag-tool', (t,d) => { const i = ag.tools.indexOf(d.id); i<0 ? ag.tools.push(d.id) : ag.tools.splice(i,1); t.setAttribute('aria-pressed', i<0); });
  UI.act('agent-save', () => { const errs = API.createAgent(ag); if(errs.length){ ag.errs = errs; agentDrawer(); return; } UI.close(); UI.toast(ag.name.trim() + (ag.id?' updated':' added to your team')); });
  UI.act('agent-del', () => { const e = API.removeAgent(ag.id); if(e){ ag.errs = [e]; agentDrawer(); return; } UI.close(); UI.toast('Agent removed'); });

  /* ===================== 3. ASSIGN ===================== */
  OA.assignView = function(){
    const s = S(); const owners = [['','Unassigned']].concat(s.people.map(p => [p.id, p.name || 'New person']));
    if(!s.agents.length) return UI.empty('No agents yet','Create your agents in the previous step, then assign each one to a person.');
    const rows = s.agents.map(a => { const d = API.dept(a.deptId); return `<tr><td><div class="row"><span class="mono sm" aria-hidden="true">${esc(initials(a.name))}</span><div><b>${esc(a.name)}</b> ${a.type==='coordinator'?pill('Coordinator','brand'):''}<small style="display:block">${esc(a.job)}</small></div></div></td>
      <td>${esc(d?d.name:'None')}</td><td>${sel(owners, a.ownerId, `data-ch="assign" data-id="${a.id}" aria-label="Owner of ${esc(a.name)}"`)}</td></tr>`; }).join('');
    const per = s.people.map(p => { const n = API.agentsOf(p.id).length; return `<span class="chip">${esc(p.name||'New person')} <b class="num">${n}</b></span>`; }).join('');
    return `<div class="row wrap" style="margin-bottom:12px"><div class="grow muted">Each agent has one owner. Owners see what it is doing, edit its instructions within your guardrails, and pause it. Approving messages is separate and follows Authority.</div><button class="btn" data-act="auto-assign">${ic('sparkle')} Auto-assign by department</button></div>
      <section class="card flush scroll"><table class="tbl"><thead><tr><th>Agent</th><th>Department</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table></section>
      <div class="sec-h"><h3>Agents per person</h3></div><div class="chips">${per}</div>`;
  };
  UI.chg('assign', (v,t,d) => API.assign(d.id, v));
  UI.act('auto-assign', () => { API.autoAssign(); UI.toast('Assigned by department'); });

  /* ===================== 4. CONNECTIONS (MCP) ===================== */
  let cm = {id:null, mode:'draft', busy:false};
  function connCard(k, usedBy){
    const m = MCPS[k], on = API.isOn(k), c = S().connections[k], [tl,tc] = MCP_TIER[m.tier];
    return `<div class="card conn"><span class="mono tile" style="--tile:${m.tile}" aria-hidden="true">${esc(m.mono)}</span><div class="body"><div class="row wrap"><b>${esc(m.name)}</b>${pill(tl,tc)}${on?pill('Connected','ok'):(usedBy?pill('Required','warn'):'')}</div>
      <p class="muted">${esc(m.desc)}</p>${usedBy?`<div class="who"><small>Needed by</small>${usedBy.map(id=>`<span class="chip">${esc((API.agent(id)||{}).name)}</span>`).join('')}</div>`:''}
      ${on?`<small>Access: ${esc((MCP_MODES.find(x=>x[0]===c.mode)||[])[1]||c.mode)}</small>`:''}</div>
      ${m.tier==='soon' ? '' : on ? `<button class="btn sm ghost" data-act="conn-off" data-id="${k}">Disconnect</button>` : `<button class="btn sm primary" data-act="conn-open" data-id="${k}">Connect</button>`}</div>`;
  }
  OA.connectionsView = function(){
    const s = S(), req = API.requiredTools(); const reqKeys = Object.keys(req), others = Object.keys(MCPS).filter(k => !req[k]);
    const miss = reqKeys.filter(k => !API.isOn(k));
    return `<div class="note info" style="margin-bottom:14px">${ic('lock',14)} Tools connect through ORBIT's policy gateway. ORBIT keeps the sign-in tokens, so agents never see your passwords, and every action is checked against what you allowed.</div>
      <div class="sec-h" style="margin-top:0"><h3>Required by your agents</h3>${reqKeys.length?pill(`${reqKeys.length-miss.length} of ${reqKeys.length} connected`, miss.length?'warn':'ok'):''}</div>
      ${reqKeys.length ? `<div class="stack">${reqKeys.map(k => connCard(k, req[k])).join('')}</div>` : UI.empty('No tools needed yet','Tools your agents need will appear here once you add agents.')}
      ${miss.length ? `<label class="row" style="margin-top:12px;align-items:flex-start"><input type="checkbox" data-ch="connect-later" ${s.org.connectLater?'checked':''} style="margin-top:3px;width:auto"><span>Connect later. Agents that need a missing tool start <b>paused</b> and resume when you connect it.</span></label>` : ''}
      <div class="sec-h"><h3>Other tools you can add</h3></div><div class="stack">${others.map(k => connCard(k, null)).join('')}</div>`;
  };
  UI.chg('connect-later', v => upd(s => { s.org.connectLater = !!v; }));
  UI.act('conn-open', (t,d) => { cm = {id:d.id, mode:'draft', busy:false}; connModal(); });
  function connModal(){
    const m = MCPS[cm.id], list = (a,c) => `<ul class="todo" style="${c||''}">${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
    UI.open(`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="cmt"><div class="dh"><span class="mono tile" style="--tile:${m.tile}" aria-hidden="true">${esc(m.mono)}</span><h2 id="cmt" class="grow">Connect ${esc(m.name)}</h2><button class="btn sm ghost" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field"><label for="cmm">How much can agents do?</label>${sel(MCP_MODES, cm.mode, 'id="cmm" data-ch="conn-mode"')}</div>
      <div class="guard"><h4>Agents can</h4>${list(m.can)}<h4 style="margin-top:8px">Always ask a person first</h4>${list(m.ask)}<h4 style="margin-top:8px">Never</h4>${list(m.never)}</div>
      <div class="foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="conn-go" ${cm.busy?'disabled':''}>${cm.busy?'Connecting…':'Continue with '+esc(m.auth.replace(' sign-in',''))}</button></div></section>`, {center:true});
  }
  UI.chg('conn-mode', v => { cm.mode = v; });
  UI.act('conn-go', () => { cm.busy = true; connModal(); const id = cm.id, mode = cm.mode; setTimeout(() => { UI.close(); API.connect(id, mode); UI.toast(MCPS[id].name + ' connected'); }, 700); });
  UI.act('conn-off', (t,d) => UI.confirm('Disconnect '+MCPS[d.id].name+'? Agents that need it will pause.', () => API.disconnect(d.id), 'Disconnect'));

  /* ---- standalone pages (after launch) ---- */
  Router.reg('admin','structure',{title:'Org structure', render:() => UI.pageH('Org structure','The people, departments and board your agents report into.') + OA.structureView()});
  Router.reg('admin','connections',{title:'Connections', render:() => UI.pageH('Connections','The tools your agents can use. Connect, change access, or disconnect.') + OA.connectionsView()});
  let tab = 'agents';
  UI.act('ag-tab', (t,d) => { tab = d.id; Shell.render(); });
  Router.reg('admin','agents',{title:'Agents', render:() => UI.pageH('Agents','Your AI teammates, who owns each one, and what it is allowed to do.', `<button class="btn primary" data-act="agent-new">${ic('plus')} New agent</button>`) +
    `<div class="tabs" role="tablist"><button role="tab" aria-selected="${tab==='agents'}" data-act="ag-tab" data-id="agents">Team</button><button role="tab" aria-selected="${tab==='assign'}" data-act="ag-tab" data-id="assign">Assignments</button></div>` + (tab==='assign' ? OA.assignView() : OA.agentsView())});
  OA.openPromptEditor = null; // set by requests.js
})();
