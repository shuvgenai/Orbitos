/* Single source of truth, persisted in localStorage. Replace with API calls later (see api.js). */
window.Store = (function(){
  let S = null; const subs = [];
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  function load(){
    try{ const r = localStorage.getItem(CFG.STORE_KEY); if(r) S = JSON.parse(r); }catch(e){}
    if(!S || !S.org) S = Seeds.fresh();
  }
  function save(){ try{ localStorage.setItem(CFG.STORE_KEY, JSON.stringify(S)); }catch(e){} }
  function emit(src){ subs.forEach(f => f(src)); }
  return {
    uid,
    init(){ load(); window.addEventListener('storage', e => { if(e.key === CFG.STORE_KEY){ load(); emit('remote'); } }); },
    get: () => S,
    update(fn, src){ fn(S); save(); emit(src || 'user'); },
    subscribe(f){ subs.push(f); },
    reset(kind){ S = kind === 'demo' ? Seeds.demo() : Seeds.fresh(); save(); emit('user'); },
    audit(who, what){ S.audit.unshift({at:Date.now(), who, what}); S.audit = S.audit.slice(0,40); }
  };
})();
