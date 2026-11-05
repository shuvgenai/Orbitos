/* App shell: sidebar, top bar, routing, dev tools, live ticker. One shell for all three roles. */
window.Shell = (function(){
  const {esc, ic, initials} = UI;
  const S = () => Store.get();
  const pending = () => S().requests.filter(r => r.status === 'pending').length;
  function navFor(role){
    const s = S();
    if(role === 'user') return [['home','home','My agents'],['new','plus','Request an agent',()=>S().requests.filter(r=>r.by===me('user').id&&r.status==='changes').length],['activity','list','Activity']];
    if(role === 'super') return [['fleet','server','Offices'],['provision','plus','New office']];
    return [['dashboard','home','Home'], ...(s.org.launched ? [] : [['onboarding','rocket','Set up your office']]),
      ['requests','inbox','Requests',pending],['map','map','Agent map'],['performance','chart','Performance'],['-','Office'],['structure','org','Org structure'],['agents','bot','Agents'],['connections','plug','Connections']];
  }
  function me(role){
    const s = S();
    if(role === 'super') return {id:'op', name:'Shuv Chowdhury', title:'Operator'};
    if(role === 'admin') return s.people.find(p => p.access === 'admin') || {id:'', name:'Org Admin'};
    return s.people.find(p => p.id === s.session.userId) || s.people.find(p => p.access === 'user') || {id:'', name:'Guest'};
  }
  const defaultRoute = role => role === 'admin' && !S().org.launched ? 'onboarding' : navFor(role)[0][0];
  const typing = () => { const a = document.activeElement; return !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && document.getElementById('app').contains(a)); };
  let lastKey = '', simOn = true;

  function render(){
    const r = Router.parse(), role = r.role, nav = navFor(role), name = r.name || defaultRoute(role), def = Router.defs(role)[name], m = me(role), s = S();
    const key = role + name + (r.arg||''); const y = key === lastKey ? window.scrollY : 0; lastKey = key;
    const title = def ? (typeof def.title === 'function' ? def.title(r.arg) : def.title) : 'Not found';
    const links = nav.map(n => n[0]==='-' ? `<small class="nav-label">${esc(n[1])}</small>` :
      `<a class="nav ${n[0]===name?'active':''}" href="${Router.href(n[0],null,role)}" ${n[0]===name?'aria-current="page"':''}>${ic(n[1])}<span>${esc(n[2])}</span>${n[3]&&n[3]()?`<span class="count">${n[3]()}</span>`:''}</a>`).join('');
    const switcher = CFG.PREVIEW ? `<div class="roles" role="group" aria-label="Preview as">${['user','admin','super'].map(k=>`<a href="#/${k}/${k==='admin'&&!s.org.launched?'onboarding':navFor(k)[0][0]}" aria-current="${k===role}">${CFG.ROLES[k].label}</a>`).join('')}</div>` : `<span class="pill brand">${CFG.ROLES[role].label}</span>`;
    const scope = role==='super' ? `<b>All offices</b><small>Operator console</small>` : `<b>${esc(s.org.name)}</b><small>${esc(s.org.domain)}</small>`;
    document.getElementById('app').innerHTML = `<div class="app role-${role}">
      <aside class="side" aria-label="${CFG.ROLES[role].label} navigation"><div class="brand"><div class="logo" aria-hidden="true">O</div><div><b>${CFG.APP}</b><small>by OrbitumAI</small></div></div>
        <div class="scope"><span class="av">${esc(initials(role==='super'?'All Offices':s.org.name))}</span><div>${scope}</div></div>${links}
        <div class="me"><span class="av">${esc(initials(m.name))}</span><div><b>${esc(m.name)}</b><small>${CFG.ROLES[role].label}</small></div></div></aside>
      <div class="mainwrap"><header class="top"><h1>${esc(title)}</h1><div class="sp"></div>${switcher}</header>
        <main class="main" id="main">${def ? def.render(r.arg, m) : UI.empty('Page not found','That page does not exist for your role.',`<a class="btn" href="${Router.href(defaultRoute(role),null,role)}">Go home</a>`)}</main>${CFG.DEV ? devBar(role) : ''}</div></div>`;
    document.title = title + ' · ' + CFG.APP; window.scrollTo(0, y);
    if(def && def.mount) def.mount(r.arg, m);
  }
  function devBar(role){
    const s = S(); const users = s.people.filter(p => p.access === 'user');
    return `<details class="dev"><summary>Dev tools (hidden in production)</summary><div class="row wrap">
      ${role==='user' ? `<label class="row" style="gap:6px">Sign in as ${UI.sel(users.length?users.map(p=>[p.id,p.name]):[['','No users yet']], me('user').id, 'data-ch="dev-as" style="width:auto;min-width:160px" aria-label="Sign in as"')}</label>` : ''}
      <button class="btn sm" data-act="dev-demo">Load demo office</button><button class="btn sm" data-act="dev-fresh">Start fresh onboarding</button>
      <label class="row" style="gap:6px"><input type="checkbox" data-ch="dev-sim" ${simOn?'checked':''}> Simulate live activity</label>
      ${CFG.PREVIEW ? '' : Object.keys(CFG.ROLES).filter(k=>k!==role).map(k=>`<a class="btn sm ghost" href="${CFG.ROLES[k].dir}">Open ${CFG.ROLES[k].label}</a>`).join('')}</div></details>`;
  }
  UI.act('dev-demo', () => { Store.reset('demo'); UI.toast('Demo office loaded'); if(!CFG.ROLE||CFG.ROLE==='admin') Router.go('dashboard'); });
  UI.act('dev-fresh', () => UI.confirm('Erase everything and restart onboarding?', () => { Store.reset('fresh'); Router.go(CFG.ROLE==='user'?'home':'onboarding', null, CFG.ROLE?undefined:'admin'); UI.toast('Fresh onboarding'); }, 'Start over'));
  UI.chg('dev-as', v => Store.update(s => { s.session.userId = v; }));
  UI.chg('dev-sim', v => { simOn = !!v; });

  function boot(){
    Store.init();
    Store.subscribe(src => { if(src === 'tick' && (UI.isOpen() || typing())) return; render(); });
    window.addEventListener('hashchange', () => { UI.close(); render(); });
    if(!location.hash || location.hash === '#') { const r = Router.parse(); location.hash = Router.href(defaultRoute(r.role), null, r.role); } else render();
    setInterval(() => { if(simOn && !document.hidden) API.tick(); }, 7000);
  }
  return {boot, render, me, navFor};
})();
