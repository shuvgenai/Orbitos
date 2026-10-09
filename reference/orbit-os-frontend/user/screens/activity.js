/* User: receipts for what my agents did. */
(function(){
  const {esc, ic, pill} = UI; const S = () => Store.get(); const open = {};
  UI.act('u-exp', (t,d) => { open[d.id] = !open[d.id]; Shell.render(); });
  Router.reg('user','activity',{title:'Activity', render(_, m){
    const s = S(), ids = s.agents.filter(a => a.ownerId === m.id).map(a => a.id), items = s.activity.filter(r => ids.includes(r.agentId));
    if(!items.length) return UI.pageH('Activity','Everything your agents did, with the reason.') + UI.empty('Nothing yet','When your agents do work, each action appears here with why it happened.');
    return UI.pageH('Activity','Everything your agents did, with the reason.') + `<section class="card list flush">${items.map(r => { const a = API.agent(r.agentId), o = !!open[r.id];
      return `<div class="item" style="flex-direction:column;gap:6px"><button class="row" style="width:100%;background:none;border:0;padding:0;text-align:left" data-act="u-exp" data-id="${r.id}" aria-expanded="${o}"><span class="mono sm" aria-hidden="true">${esc(UI.initials(a?a.name:'?'))}</span><span class="grow"><b>${esc(r.title)}</b><small style="display:block">${esc(a?a.name:'')} · ${UI.ago(r.t)}</small></span>${pill(r.status==='waiting'?'Waiting':'Done', r.status==='waiting'?'warn':'ok')}<small class="num">${UI.money(r.cost)}</small></button>
        ${o?`<div class="doing" style="width:100%"><small>Why</small>${esc(r.why)}<small style="margin-top:4px">Took ${r.dur}s</small></div>`:''}</div>`; }).join('')}</section>`;
  }});
})();
