/* Requests inbox: review a user's agent request, edit its instructions, add guardrails, decide. Also edit any running agent's prompt + guardrails. */
(function(){
  const {esc, ic, pill} = UI; const S = () => Store.get();
  const RQ = {pending:['warn','Waiting for you'],approved:['ok','Approved'],changes:['brand','Changes requested'],rejected:['err','Declined']};
  let p = null; // panel draft {type:'review'|'agent', id, prompt, guards, note, err}

  OA.guardEditor = function(guards){
    return `<ul class="gl">${guards.map((g,i) => `<li><span>${esc(g)}</span><button class="btn sm ghost" data-act="g-del" data-id="${i}" aria-label="Remove guardrail: ${esc(g)}">Remove</button></li>`).join('') || '<li><span class="muted">No guardrails yet.</span></li>'}</ul>
      <div class="addrow"><input type="text" id="gnew" placeholder="Add a guardrail, e.g. Never email customers" data-enter="g-add" aria-label="New guardrail"><button class="btn" data-act="g-add">Add</button></div>
      <div class="chips" style="margin-top:8px">${CFG.SUGGEST_GUARDS.filter(x => !guards.includes(x)).map(x => `<button class="chip" data-act="g-sug" data-id="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>`;
  };
  function drawer(){
    const s = S(), isReq = p.type === 'review';
    const r = isReq ? s.requests.find(x => x.id === p.id) : null, a = !isReq ? s.agents.find(x => x.id === p.id) : null; if(!r && !a) return;
    const ro = isReq && r.status !== 'pending', by = r ? API.person(r.by) : null, owner = a ? API.person(a.ownerId) : null;
    UI.open(`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="pt">
      <div class="dh"><div class="grow"><h2 id="pt">${esc(isReq ? r.name : a.name)}</h2><small>${isReq ? 'Requested by '+esc(by?by.name:'someone')+', '+UI.ago(r.at) : esc(owner?owner.name:'Unassigned')+' · prompt v'+a.version}</small></div><button class="btn sm ghost" data-act="close" aria-label="Close">${ic('x')}</button></div>
      ${isReq ? `<div class="guard"><h4>What ${esc(by?by.name.split(' ')[0]:'they')} asked for</h4><p style="font-size:13px"><b>Job:</b> ${esc(r.purpose)}</p><p style="font-size:13px"><b>Why:</b> ${esc(r.reason)}</p><p style="font-size:13px"><b>Tools:</b> ${esc(r.tools.map(API.toolName).join(', ')||'none')}${r.tools.some(t=>!API.isOn(t))?` ${pill('Some not connected yet','warn')}`:''}</p></div>` : `<div class="doing"><small>Right now</small>${esc(a.doing)}</div>`}
      <div class="field"><label for="pp">Instructions${isReq&&!ro?' (edit before approving)':''}</label><textarea id="pp" ${ro?'readonly':''} data-in="rv-prompt">${esc(p.prompt)}</textarea></div>
      <div class="field"><span class="lbl">Guardrails</span><p class="help" style="margin:0 0 6px">Guardrails always win over instructions. The owner can read them but not change them.</p>${ro ? `<ul class="gl">${p.guards.map(g=>`<li><span>${esc(g)}</span></li>`).join('')}</ul>` : OA.guardEditor(p.guards)}</div>
      ${isReq && !ro ? `<div class="field"><label for="pn">Note to ${esc(by?by.name.split(' ')[0]:'them')}</label><input type="text" id="pn" value="${esc(p.note)}" data-in="rv-note" placeholder="Required if you request changes or decline">${p.err?`<p class="err-t" role="alert">${esc(p.err)}</p>`:''}</div>` : ''}
      ${ro ? `<div class="note ${r.status==='approved'?'ok':r.status==='rejected'?'err':''}">${esc(RQ[r.status][1])}${r.adminNote?': '+esc(r.adminNote):''}</div>` : ''}
      <div class="foot">${isReq && !ro ? `<button class="btn" data-act="rv-decide" data-d="rejected">Decline</button><button class="btn" data-act="rv-decide" data-d="changes">Request changes</button><button class="btn primary" data-act="rv-decide" data-d="approved">Approve and start</button>` : !isReq ? `<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="rv-save">Save changes</button>` : ''}</div></section>`);
  }
  OA.openPromptEditor = id => { const a = API.agent(id); p = {type:'agent', id, prompt:a.prompt, guards:a.guardrails.slice(), note:'', err:''}; drawer(); };
  UI.act('rv-open', (t,d) => { const r = API.agent && S().requests.find(x => x.id === d.id); p = {type:'review', id:d.id, prompt:r.prompt, guards:S().org.guardrails.slice(), note:r.adminNote || '', err:''}; drawer(); });
  UI.act('agent-admin', (t,d) => OA.openPromptEditor(d.id));
  UI.inp('rv-prompt', v => { p.prompt = v; }); UI.inp('rv-note', v => { p.note = v; });
  const addG = txt => { txt = (txt||'').trim(); if(!txt) return; if(p.guards.includes(txt)){ UI.toast('Already added'); return; } p.guards.push(txt); drawer(); const i = document.getElementById('gnew'); if(i) i.focus(); };
  UI.act('g-add', () => addG(document.getElementById('gnew').value)); UI.act('g-sug', (t,d) => addG(d.id));
  UI.act('g-del', (t,d) => { p.guards.splice(+d.id, 1); drawer(); });
  UI.act('rv-save', () => { if(p.prompt.trim().length < 20){ UI.toast('Instructions need at least 20 characters'); return; } const a = API.agent(p.id); UI.close(); API.savePrompt(p.id, p.prompt, 'Org Admin', p.guards); UI.toast(a.name + ' updated. Applies from the next run.'); });
  UI.act('rv-decide', (t,d) => { const dec = d.d;
    if((dec==='changes'||dec==='rejected') && !p.note.trim()){ p.err = dec==='changes' ? 'Say what to change so they can fix it.' : 'Add a short reason so they know why.'; drawer(); return; }
    if(dec==='approved' && p.prompt.trim().length < 20){ UI.toast('Instructions need at least 20 characters'); return; }
    const r = S().requests.find(x => x.id === p.id), person = API.person(r.by); const o = {prompt:p.prompt, guards:p.guards, note:p.note.trim()};
    UI.close(); API.decide(p.id, dec, o); UI.toast(dec==='approved' ? r.name+' is set up for '+(person?person.name.split(' ')[0]:'them') : 'Decision sent'); });

  Router.reg('admin','requests',{title:'Requests', render(){
    const s = S(), pend = s.requests.filter(r => r.status === 'pending').sort((a,b) => a.at - b.at), done = s.requests.filter(r => r.status !== 'pending').sort((a,b) => b.at - a.at);
    const row = r => { const by = API.person(r.by); return `<div class="item"><span class="av" aria-hidden="true">${esc(UI.initials(by?by.name:'?'))}</span><div class="grow"><div class="row wrap"><b>${esc(r.name)}</b>${pill(RQ[r.status][1], RQ[r.status][0])}</div><p class="muted">${esc(r.purpose)}</p><small>${esc(by?by.name:'Someone')} · ${UI.ago(r.at)} · Tools: ${esc(r.tools.map(API.toolName).join(', ')||'none')}</small></div>
      <button class="btn sm ${r.status==='pending'?'primary':''}" data-act="rv-open" data-id="${r.id}">${r.status==='pending'?'Review':'View'}</button></div>`; };
    return UI.pageH('Requests','Agent requests from your team. Review, adjust the instructions, add guardrails, then approve.') +
      `<section class="card list flush" aria-label="Pending requests">${pend.length ? pend.map(row).join('') : '<div class="empty"><h3>Nothing to review</h3><p>New requests from your team appear here.</p></div>'}</section>` +
      (done.length ? `<div class="sec-h"><h3>Decided</h3></div><section class="card list flush">${done.map(row).join('')}</section>` : '') +
      `<div class="sec-h"><h3>Recent changes</h3></div><section class="card list flush">${s.audit.slice(0,8).map(x => `<div class="item" style="padding:10px 16px"><div class="grow"><b>${esc(x.who)}</b> ${esc(x.what)} <small>· ${UI.ago(x.at)}</small></div></div>`).join('')}</section>`;
  }});
})();
