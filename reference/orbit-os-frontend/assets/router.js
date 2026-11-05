/* Hash router. Per-role index: #/home/arg. All-in-one preview: #/admin/home/arg. */
window.Router = (function(){
  const defs = {}; let cur = null;
  const ROLES = ['user','admin','super'];
  function parse(){
    const parts = location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
    if(!CFG.ROLE && ROLES.includes(parts[0])) cur = parts.shift();
    return {role: CFG.ROLE || cur || 'admin', name: parts[0] || null, arg: parts[1] || null};
  }
  return {
    reg(role, name, def){ (defs[role] = defs[role] || {})[name] = def; },
    defs: r => defs[r] || {},
    parse,
    href(name, arg, role){ const r = role || parse().role; return '#' + (CFG.ROLE ? '' : '/' + r) + '/' + name + (arg ? '/' + arg : ''); },
    go(name, arg, role){ location.hash = this.href(name, arg, role); }
  };
})();
