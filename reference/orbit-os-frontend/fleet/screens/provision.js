/* Super Admin: provision a new customer office (instance, org shell, tool gateway, admin invite). */
(function(){
  const {esc, ic} = UI; let f = {name:'', domain:'', email:'', errs:{}}, run = null;
  UI.inp('pv-name', v => { f.name = v; }); UI.inp('pv-domain', v => { f.domain = v; }); UI.inp('pv-email', v => { f.email = v; });
  UI.act('pv-go', () => { const e = {}; if(f.name.trim().length < 2) e.name = 'Enter the business name.'; if(!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(f.domain.trim())) e.domain = 'Enter a domain like office.acme.com.'; if(!API.emailOk(f.email)) e.email = 'Enter the Org Admin email.';
    f.errs = e; if(Object.keys(e).length){ Shell.render(); return; }
    run = {i:0, name:f.name.trim(), domain:f.domain.trim(), email:f.email.trim()}; Shell.render(); step(); });
  function step(){ if(!run) return; if(run.i >= Fleet.steps.length){
      Store.update(s => { (s.fleet = s.fleet || []).push({id:Store.uid('ws_'), name:run.name, domain:run.domain, status:'awaiting', agents:0, cost:0, version:'1.4.2', health:'ok', admin:run.email}); });
      run.done = true; Shell.render(); return; }
    Shell.render(); setTimeout(() => { run.i++; step(); }, 650); }
  UI.act('pv-reset', () => { run = null; f = {name:'', domain:'', email:'', errs:{}}; Shell.render(); });
  Router.reg('super','provision',{title:'New office', render(){
    if(run){ const pct = Math.round(Math.min(run.i, Fleet.steps.length) / Fleet.steps.length * 100);
      return UI.pageH('Setting up '+esc(run.name), run.done ? 'The office is ready. The Org Admin received an invitation.' : 'Creating a private instance. This takes a moment.') +
        `<section class="card pad"><div class="row" style="margin-bottom:10px"><div class="bar grow"><i style="width:${pct}%"></i></div><b class="num">${pct}%</b></div><ul class="job gl" style="gap:0">${Fleet.steps.map(([k,l],i) => `<li><span class="s ${i<run.i?'done':i===run.i&&!run.done?'run':''}">${i<run.i?ic('check',12):''}</span><span class="grow">${esc(l)}</span></li>`).join('')}</ul>
        ${run.done ? `<div class="row" style="margin-top:14px"><a class="btn primary" href="${Router.href('fleet')}">View offices</a><button class="btn" data-act="pv-reset">Provision another</button></div>` : ''}</section>`; }
    const e = f.errs, er = k => e[k] ? `<p class="err-t" role="alert">${e[k]}</p>` : '';
    return UI.pageH('New office','Each customer gets their own private instance, database and domain.') +
      `<section class="card pad" style="max-width:560px"><div class="field"><label for="pn">Business name</label><input type="text" id="pn" value="${esc(f.name)}" data-in="pv-name" placeholder="Acme Advisors">${er('name')}</div>
      <div class="field"><label for="pd">Office domain</label><input type="text" id="pd" value="${esc(f.domain)}" data-in="pv-domain" placeholder="office.acme.com">${er('domain')}</div>
      <div class="field"><label for="pe">Org Admin email</label><input type="email" id="pe" value="${esc(f.email)}" data-in="pv-email" placeholder="owner@acme.com">${er('email')}<p class="help">They receive an invitation and complete onboarding: org structure, agents, assignments and tools.</p></div>
      <button class="btn primary" data-act="pv-go">${ic('rocket')} Provision office</button></section>`;
  }});
})();
