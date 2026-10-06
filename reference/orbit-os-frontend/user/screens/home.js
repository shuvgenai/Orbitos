/* User home: how many agents are running, live status, edit instructions, pause/resume. */
(function(){
  const {esc, ic, pill, statusPill, kpi, money} = UI; const S = () => Store.get(); let ud = null;
  const mine = m => S().agents.filter(a => a.ownerId === m.id);
  function card(a){
    return `<article class="card agent" aria-label="${esc(a.name)}"><div class="row"><span class="mono" aria-hidden="true">${esc(UI.initials(a.name))}</span><div class="grow"><h3 style="font-size:15px">${esc(a.name)}</h3><small>${esc(a.job)}</small></div>${statusPill(a.status)}</div>
      <div class="doing"><small>Right now</small>${esc(a.doing)}</div>
      <div class="meta"><span>${a.runsToday} runs today</span><span>${money(a.costToday)} today</span><span>Active ${UI.ago(a.lastActive)}</span></div>
      <div class="meta"><span>${a.guardrails.length} guardrails set by your admin</span><span>Instructions v${a.version}</span></div>
      <div class="actions"><button class="btn sm primary" data-act="u-edit" data-id="${a.id}">${ic('edit',14)} Edit instructions</button>${a.provisioned?`<button class="btn sm" data-act="u-toggle" data-id="${a.id}">${a.status==='paused'?ic('play',14)+' Resume':ic('pause',14)+' Pause'}</button>`:''}</div></article>`;
  }
  function drawer(){
    const a = API.agent(ud.id); if(!a) return; const dirty = ud.draft.trim() !== a.prompt.trim(), bad = ud.draft.trim().length < 20;
    UI.open(`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="udt"><div class="dh"><h2 id="udt" class="grow">Edit ${esc(a.name)}'s instructions</h2><button class="btn sm ghost" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field"><label for="ud">What ${esc(a.name)} should do</label><textarea id="ud" data-in="u-draft">${esc(ud.draft)}</textarea><p class="help"><span id="ucnt">${ud.draft.length}</span> characters. Changes apply from the next run.</p><p class="err-t" id="uerr">${bad?'Write at least 20 characters so the agent knows its job.':''}</p></div>
      <div class="guard"><h4>Guardrails from your Org Admin (you can't change these)</h4><ul class="todo">${a.guardrails.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>
      <div><h4 style="font-size:13px;margin-bottom:4px">Version history</h4>${a.versions.slice().reverse().map(v=>`<div class="ver">${pill('v'+v.v, v.v===a.version?'ok':'')}<span class="grow"><small>${esc(v.by)}, ${UI.ago(v.at)}</small></span>${v.v===a.version?'<small>Current</small>':`<button class="btn sm" data-act="u-restore" data-v="${v.v}">Use this version</button>`}</div>`).join('')}</div>
      <div class="foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" id="usave" data-act="u-save" ${(!dirty||bad)?'disabled':''}>Save changes</button></div></section>`);
  }
  UI.act('u-edit', (t,d) => { ud = {id:d.id, draft:API.agent(d.id).prompt}; drawer(); });
  UI.inp('u-draft', v => { ud.draft = v; const a = API.agent(ud.id), bad = v.trim().length < 20; document.getElementById('ucnt').textContent = v.length; document.getElementById('uerr').textContent = bad ? 'Write at least 20 characters so the agent knows its job.' : ''; document.getElementById('usave').disabled = bad || v.trim() === a.prompt.trim(); });
  UI.act('u-restore', (t,d) => { const a = API.agent(ud.id); ud.draft = a.versions.find(v => v.v === +d.v).prompt; drawer(); UI.toast('Version loaded. Press Save changes to use it.'); });
  UI.act('u-save', () => { const a = API.agent(ud.id), me = Shell.me('user'); if(ud.draft.trim().length < 20) return; UI.close(); API.savePrompt(ud.id, ud.draft, me.name); UI.toast(a.name + ' updated. New instructions start with the next run.'); });
  UI.act('u-toggle', (t,d) => { const a = API.agent(d.id), was = a.status === 'paused'; API.togglePause(d.id, Shell.me('user').name); UI.toast(a.name + (was ? ' resumed' : ' paused')); });

  Router.reg('user','home',{title:'My agents', render(_, m){
    const s = S(), a = mine(m);
    const head = UI.pageH('My agents', a.length ? `${API.running(a)} of ${a.length} agents are working for you right now.` : 'Agents your Org Admin assigns to you appear here.', `<a class="btn primary" href="${Router.href('new')}">${ic('plus')} Request an agent</a>`);
    if(!s.org.launched) return head + UI.empty('Your office is being set up','Your Org Admin is still hiring the team. You will see your agents here as soon as it goes live.');
    if(!a.length) return head + UI.empty('No agents assigned yet','Ask your Org Admin to assign one, or request a new agent.', `<a class="btn primary" href="${Router.href('new')}">Request an agent</a>`);
    return head + `<section class="kpis" aria-label="Summary">${kpi('Running now', API.running(a), 'of '+a.length, true)}${kpi('Waiting for approval', a.filter(x=>x.status==='waiting').length)}${kpi('Runs today', a.reduce((t,x)=>t+x.runsToday,0))}${kpi('Spent today', money(a.reduce((t,x)=>t+x.costToday,0)))}</section><div class="grid">${a.map(card).join('')}</div>`;
  }});
})();
