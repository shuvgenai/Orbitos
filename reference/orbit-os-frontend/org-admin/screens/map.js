/* Agent map: every person with the agents working for them, live status and what each is doing. */
(function(){
  const {esc, initials, ic, statusPill} = UI; const S = () => Store.get(); let who = 'all';
  UI.act('map-user', (t,d) => { who = d.id; Shell.render(); });
  Router.reg('admin','map',{title:'Agent map', render(){
    const s = S(); if(!s.org.launched && !s.agents.length) return UI.pageH('Agent map','See which agents work for each person.') + UI.empty('Nothing to show yet','Create and assign agents in setup, then launch. They will appear here.', `<a class="btn primary" href="${Router.href('onboarding')}">Continue setup</a>`);
    const owners = s.people.filter(p => s.agents.some(a => a.ownerId === p.id));
    if(who !== 'all' && !owners.some(p => p.id === who)) who = 'all';
    const shown = who === 'all' ? owners : owners.filter(p => p.id === who);
    const pick = [['all','Everyone']].concat(owners.map(p => [p.id, p.name])).map(([k,l]) => `<button class="chip" data-act="map-user" data-id="${esc(k)}" aria-pressed="${who===k}">${esc(l)}</button>`).join('');
    const blocks = shown.map(p => { const ag = s.agents.filter(a => a.ownerId === p.id), n = ag.length, H = Math.max(64, n*76-12);
      const paths = ag.map((a,i) => `<path class="${a.status} s-${a.status}" d="M0 ${H/2} C 32 ${H/2}, 32 ${32+i*76}, 64 ${32+i*76}" stroke="currentColor"/>`).join('');
      return `<div class="mapu"><div class="card unode"><span class="av lg">${esc(initials(p.name))}</span><b>${esc(p.name)}</b><small>${API.running(ag)} of ${n} running</small></div>
        <svg class="mapsvg" width="64" height="${H}" viewBox="0 0 64 ${H}" aria-hidden="true">${paths}</svg>
        <div class="anodes">${ag.map(a => { const mg = API.agent(a.managerId); return `<button class="card anode s-${a.status}" data-act="agent-admin" data-id="${a.id}" aria-label="${esc(a.name)}, ${UI.ST[a.status][1]}. ${esc(a.doing)}"><span class="mono" aria-hidden="true">${esc(initials(a.name))}</span><span class="t"><b>${esc(a.name)} <span style="font-weight:400;color:var(--muted)">· ${UI.ST[a.status][1]}</span></b><small>${esc(a.doing)}${mg?' · reports to '+esc(mg.name):''}</small></span><small class="num">${UI.money(a.costToday)}</small></button>`; }).join('')}</div></div>`; }).join('');
    return UI.pageH('Agent map','Who each agent works for, and what it is doing right now.') + `<div class="pick" role="group" aria-label="Show agents for">${pick}</div>${blocks || UI.empty('No agents assigned','Assign agents to people from the Agents page.')}<p class="muted">Select an agent to edit its instructions and guardrails. Dashed lines mean idle, paused or not started.</p>`;
  }});
})();
