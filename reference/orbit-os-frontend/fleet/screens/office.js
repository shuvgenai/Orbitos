/* Super Admin: one office. Shows how each customer-facing object maps to the runtime (operator-only view). */
(function(){
  const {esc, pill, statusPill} = UI; const S = () => Store.get();
  Router.reg('super','office',{title:id => { const r = (window.FleetRows?FleetRows():[]).find(x=>x.id===id); return r ? r.name : 'Office'; }, render(id){
    const rows = FleetRows(), r = rows.find(x => x.id === id); if(!r) return UI.empty('Office not found','It may have been removed.', `<a class="btn" href="${Router.href('fleet')}">Back to offices</a>`);
    const back = `<a class="btn sm ghost" href="${Router.href('fleet')}">Back to offices</a>`;
    if(id !== 'ws_current') return UI.pageH(esc(r.name), esc(r.domain), back) + `<div class="card pad"><div class="note info">Detail for this office comes from its own instance. This prototype shows full runtime detail for the office you are building in the Org Admin dashboard.</div><p style="margin-top:10px">Admin: ${esc(r.admin)} · ${r.agents} agents · version ${esc(r.version)}</p></div>`;
    const s = S(), ag = s.agents;
    return UI.pageH(esc(r.name), esc(r.domain), back) +
      `<section class="kpis">${UI.kpi('Agents', ag.length,'',true)}${UI.kpi('Provisioned', ag.filter(a=>a.provisioned).length)}${UI.kpi('Tools connected', Object.keys(s.connections).length)}${UI.kpi('Org chart', ag.some(a=>a.type==='coordinator')?'Valid':'Incomplete')}</section>
      ${s.org.launched ? '' : `<div class="note" style="margin-bottom:14px">The Org Admin is still onboarding. Runtime profiles are created when they launch.</div>`}
      <section class="card flush scroll"><table class="tbl"><thead><tr><th>Agent</th><th>Type</th><th>Reports to</th><th>Runtime id</th><th>Profile</th><th>Adapter</th><th>Budget</th><th>Status</th></tr></thead><tbody>
      ${ag.map(a => { const m = API.agent(a.managerId); return `<tr><td><b>${esc(a.name)}</b></td><td>${a.type}</td><td>${esc(m?m.name:'The board')}</td><td>${a.runtime?`<code>${esc(a.runtime.paperclipId)}</code>`:'<span class="muted">not created</span>'}</td><td>${a.runtime?`<code>${esc(a.runtime.hermesProfile)}</code>`:''}</td><td>${a.runtime?esc(a.runtime.adapter):''}</td><td class="num">$${a.budget}/mo</td><td>${statusPill(a.status)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">No agents yet.</td></tr>'}</tbody></table></section>
      <p class="muted" style="margin-top:10px">Each agent is one manager-reporting teammate in the office's control plane, with its own isolated runtime profile reached through the gateway adapter. Budgets map to the control plane's auto-pause limits.</p>`;
  }});
})();
