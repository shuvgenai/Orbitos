/* User: request a new agent (goes to the Org Admin) and track the answer. */
(function(){
  const {esc, ic, pill} = UI; const S = () => Store.get();
  const blank = () => ({name:'', purpose:'', prompt:'', reason:'', tools:[], errs:{}, revising:null}); let q = blank();
  const RQ = {pending:['warn','Waiting for Org Admin'],approved:['ok','Approved'],changes:['brand','Changes requested'],rejected:['err','Not approved']};
  UI.inp('rq-name', v => { q.name = v; }); UI.inp('rq-purpose', v => { q.purpose = v; }); UI.inp('rq-prompt', v => { q.prompt = v; }); UI.inp('rq-reason', v => { q.reason = v; });
  UI.act('u-tool', (t,d) => { const i = q.tools.indexOf(d.id); i<0 ? q.tools.push(d.id) : q.tools.splice(i,1); t.setAttribute('aria-pressed', i<0); });
  UI.act('u-submit', () => { const e = {};
    if(q.name.trim().length < 2) e.name = 'Give the agent a name.'; if(!q.purpose.trim()) e.purpose = 'Describe its job in one line.';
    if(q.prompt.trim().length < 20) e.prompt = 'Write at least 20 characters of instructions.'; if(!q.reason.trim()) e.reason = 'Tell your admin why this helps.';
    q.errs = e; if(Object.keys(e).length){ Shell.render(); return; }
    API.submitRequest(Shell.me('user').id, q); q = blank(); UI.toast('Sent to your Org Admin. You will see the answer here.'); });
  UI.act('u-cancel', (t,d) => { API.cancelRequest(d.id); UI.toast('Request cancelled'); });
  UI.act('u-revise', (t,d) => { const r = S().requests.find(x => x.id === d.id); q = {name:r.name, purpose:r.purpose, prompt:r.prompt, reason:r.reason, tools:r.tools.slice(), errs:{}, revising:r.id}; Shell.render(); window.scrollTo(0,0); });
  const err = k => q.errs[k] ? `<p class="err-t" role="alert">${q.errs[k]}</p>` : '';
  Router.reg('user','new',{title:'Request an agent', render(_, m){
    const s = S(), mineReq = s.requests.filter(r => r.by === m.id).sort((a,b) => b.at - a.at);
    const form = !s.org.launched ? UI.empty('Requests open once your office is live','Your Org Admin is still setting things up.') : `<section class="card pad"><div class="note info" style="margin-bottom:14px">Your Org Admin reviews every request. They may add guardrails or edit the instructions before it starts.</div>
      <div class="field"><label for="rn">Agent name</label><input type="text" id="rn" value="${esc(q.name)}" data-in="rq-name" placeholder="Proposal Chaser">${err('name')}</div>
      <div class="field"><label for="rp">Its job, in one line</label><input type="text" id="rp" value="${esc(q.purpose)}" data-in="rq-purpose" placeholder="Follow up on proposals that go quiet">${err('purpose')}</div>
      <div class="field"><label for="ri">Instructions</label><textarea id="ri" data-in="rq-prompt" style="min-height:110px" placeholder="When a proposal has had no reply for 3 days, draft a friendly nudge...">${esc(q.prompt)}</textarea>${err('prompt')}<p class="help">Describe it like you would to a new assistant.</p></div>
      <div class="field"><span class="lbl">Tools it needs</span><div class="chips" role="group" aria-label="Tools">${Object.entries(MCPS).map(([k,t]) => `<button type="button" class="chip" data-act="u-tool" data-id="${k}" aria-pressed="${q.tools.includes(k)}" ${t.tier==='soon'?'disabled title="Coming soon"':''}>${esc(t.name)}</button>`).join('')}</div></div>
      <div class="field"><label for="rr">Why do you need it?</label><input type="text" id="rr" value="${esc(q.reason)}" data-in="rq-reason" placeholder="We lose deals when follow-ups are late">${err('reason')}</div>
      <button class="btn primary" data-act="u-submit">${ic('send')} ${q.revising?'Resend to Org Admin':'Send to Org Admin'}</button></section>`;
    const list = mineReq.length ? `<section class="card list flush">${mineReq.map(r => { const [c,l] = RQ[r.status];
      return `<div class="item"><div class="grow"><div class="row wrap"><b>${esc(r.name)}</b>${pill(l,c)}</div><p class="muted">${esc(r.purpose)}</p><small>Asked ${UI.ago(r.at)} · Tools: ${esc(r.tools.map(API.toolName).join(', ')||'none')}</small>
        ${r.adminNote?`<div class="note ${r.status==='approved'?'ok':r.status==='rejected'?'err':''}" style="margin-top:6px"><b>Org Admin:</b> ${esc(r.adminNote)}</div>`:''}</div>
        ${r.status==='pending'?`<button class="btn sm ghost" data-act="u-cancel" data-id="${r.id}">Cancel</button>`:''}${r.status==='changes'?`<button class="btn sm" data-act="u-revise" data-id="${r.id}">Revise and resend</button>`:''}</div>`; }).join('')}</section>` : '<div class="card empty">No requests yet.</div>';
    return UI.pageH('Request an agent','Need help with a task? Describe it and your Org Admin will set it up.') + form + `<div class="sec-h"><h3>My requests</h3></div>` + list;
  }});
})();
