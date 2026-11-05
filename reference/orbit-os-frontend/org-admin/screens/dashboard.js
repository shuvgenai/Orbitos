/* Org Admin home: setup checklist until launch, then live office overview. */
(function(){
  const {esc, ic, pill, statusPill, kpi} = UI; const S = () => Store.get();
  Router.reg('admin','dashboard',{title:'Home', render(){
    const s = S();
    if(!s.org.launched){
      const checks = [['Org structure', s.departments.length>0 && !API.validateOrg().length],['Agents', !API.validateAgents().length && s.agents.length>0],['Assign agents', s.agents.length>0 && !API.validateAssign().length],['Connect tools', s.agents.length>0 && !API.validateConnections().length],['Launch', false]];
      const done = checks.filter(c => c[1]).length;
      return UI.pageH('Welcome, '+esc(Shell.me('admin').name.split(' ')[0]),'Your office is not live yet. Finish setup to hire your team.') +
        `<section class="card hero-card"><h2>Set up your office in 5 steps</h2><p class="muted" style="margin:4px 0 14px">About 10 minutes. Nothing runs until you launch.</p>
          <div class="row" style="margin-bottom:14px"><div class="bar grow"><i style="width:${done/5*100}%"></i></div><b class="num">${done} of 5</b></div>
          <ul class="job gl" style="gap:0;margin-bottom:14px">${checks.map(c => `<li><span class="s ${c[1]?'done':''}">${c[1]?ic('check',12):''}</span><span class="grow">${esc(c[0])}</span></li>`).join('')}</ul>
          <a class="btn primary" href="${Router.href('onboarding')}">${s.org.step>1||done?'Continue setup':'Start setup'} ${ic('right')}</a></section>`;
    }
    const all = s.agents, pend = s.requests.filter(r => r.status==='pending');
    const attn = all.filter(a => a.perf.success < 90 || (a.blockedBy && a.blockedBy.length));
    return UI.pageH('Home', `${API.running(all)} of ${all.length} agents are running across ${esc(s.org.name)}.`) +
      `<section class="kpis">${kpi('Requests to review', pend.length, '', pend.length>0)}${kpi('Running now', API.running(all), 'of '+all.length, pend.length===0)}${kpi('Waiting for approval', all.filter(a=>a.status==='waiting').length)}${kpi('Spent today', UI.money(all.reduce((t,a)=>t+a.costToday,0)))}</section>` +
      (attn.length ? `<div class="attn" role="note"><b>Needs attention:</b> ${attn.map(a => esc(a.name)+' ('+(a.blockedBy&&a.blockedBy.length?'needs '+a.blockedBy.map(API.toolName).join(', '):a.perf.success+'% success')+')').join(', ')}. <a href="${Router.href('performance')}" style="text-decoration:underline">See performance</a></div>` : '') +
      `<div class="grid2"><section class="card list flush"><div class="item" style="justify-content:space-between"><b>Requests</b><a class="btn sm" href="${Router.href('requests')}">Open</a></div>${pend.slice(0,3).map(r => { const by = API.person(r.by); return `<div class="item"><div class="grow"><b>${esc(r.name)}</b><small style="display:block">${esc(by?by.name:'Someone')} · ${UI.ago(r.at)}</small></div><button class="btn sm" data-act="rv-open" data-id="${r.id}">Review</button></div>`; }).join('') || '<div class="empty">No requests waiting.</div>'}</section>
        <section class="card list flush"><div class="item" style="justify-content:space-between"><b>Working right now</b><a class="btn sm" href="${Router.href('map')}">Agent map</a></div>${all.filter(a=>a.status==='running').slice(0,4).map(a => { const o = API.person(a.ownerId); return `<div class="item"><span class="mono sm" aria-hidden="true">${esc(UI.initials(a.name))}</span><div class="grow"><b>${esc(a.name)}</b><small style="display:block">${esc(a.doing)}${o?' · '+esc(o.name):''}</small></div></div>`; }).join('') || '<div class="empty">Nothing running at the moment.</div>'}</section></div>`;
  }});
})();
