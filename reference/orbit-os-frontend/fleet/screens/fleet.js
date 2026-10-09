/* Super Admin: every customer office, with health and cost. */
(function(){
  const {esc, ic, pill} = UI; const S = () => Store.get();
  window.FleetRows = () => { const s = S(), live = s.org.launched;
    const cur = {id:'ws_current', name:s.org.name, domain:s.org.domain, status:live?'live':'onboarding', agents:s.agents.length, cost:+s.agents.reduce((t,a)=>t+a.perf.cost7,0).toFixed(2), version:'1.4.2', health:'ok', admin:(s.people.find(p=>p.access==='admin')||{}).email||''};
    return [cur].concat(s.fleet || [], Fleet.others()); };
  const ST = {live:['ok','Live'], onboarding:['brand','Org Admin onboarding'], awaiting:['warn','Awaiting onboarding']};
  Router.reg('super','fleet',{title:'Offices', render(){
    const rows = FleetRows(), live = rows.filter(r=>r.status==='live').length;
    return UI.pageH('Offices','Every customer office OrbitumAI runs. Each one has its own private instance.', `<a class="btn primary" href="${Router.href('provision')}">${ic('plus')} New office</a>`) +
      `<section class="kpis">${UI.kpi('Offices', rows.length,'',true)}${UI.kpi('Live', live)}${UI.kpi('Agents', rows.reduce((t,r)=>t+r.agents,0))}${UI.kpi('Spend (7 days)', UI.money(rows.reduce((t,r)=>t+r.cost,0)))}</section>
      <section class="card flush scroll"><table class="tbl"><thead><tr><th>Office</th><th>Status</th><th>Agents</th><th>Spend (7 days)</th><th>Version</th><th>Health</th></tr></thead><tbody>${rows.map(r => `<tr class="row-b" tabindex="0" data-act="office-open" data-id="${r.id}"><td><b>${esc(r.name)}</b><small style="display:block">${esc(r.domain)}</small></td><td>${pill(ST[r.status][1],ST[r.status][0])}</td><td class="num">${r.agents}</td><td class="num">${UI.money(r.cost)}</td><td>${esc(r.version)}</td><td>${pill(r.health==='ok'?'Healthy':'Check',r.health==='ok'?'ok':'warn')}</td></tr>`).join('')}</tbody></table></section>`;
  }});
  UI.act('office-open', (t,d) => Router.go('office', d.id));
})();
