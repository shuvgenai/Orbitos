/* Performance per agent: runs, trend, success, speed, human edits, cost. */
(function(){
  const {esc, pill, statusPill} = UI; const S = () => Store.get(); let sort = {k:'runs', dir:-1};
  UI.act('perf-sort', (t,d) => { sort = {k:d.id, dir: sort.k===d.id ? -sort.dir : (d.id==='name'||d.id==='owner'?1:-1)}; Shell.render(); });
  const spark = d => { const mx = Math.max(...d,1), w=70, h=22; return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${d.map((v,i)=>(i*(w/(d.length-1))).toFixed(1)+','+(h-2-(v/mx)*(h-4)).toFixed(1)).join(' ')}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`; };
  Router.reg('admin','performance',{title:'Performance', render(){
    const s = S(), A = s.agents; if(!A.some(a => a.provisioned)) return UI.pageH('Performance','How each agent is doing.') + UI.empty('No data yet','Performance appears after your office goes live.', `<a class="btn primary" href="${Router.href('onboarding')}">Continue setup</a>`);
    const own = a => (API.person(a.ownerId)||{name:'Unassigned'}).name, r7 = API.runs7;
    const val = {name:a=>a.name, owner:own, runs:r7, success:a=>a.perf.success, time:a=>a.perf.avgSec, edited:a=>a.perf.edited, cost:a=>a.perf.cost7, cpr:a=>a.perf.cost7/Math.max(1,r7(a))}[sort.k];
    const rows = A.slice().sort((x,y) => { const a = val(x), b = val(y); return (typeof a==='string' ? a.localeCompare(b) : a-b) * sort.dir; });
    const th = (k,l) => `<th scope="col" aria-sort="${sort.k===k?(sort.dir>0?'ascending':'descending'):'none'}"><button data-act="perf-sort" data-id="${k}">${l}${sort.k===k?(sort.dir>0?' ▲':' ▼'):''}</button></th>`;
    const bad = A.filter(a => a.provisioned && (a.perf.success < 90 || a.perf.edited >= 40)), tot = A.reduce((t,a)=>t+r7(a),0), cost = A.reduce((t,a)=>t+a.perf.cost7,0);
    return UI.pageH('Performance','How each agent did over the last 7 days.') +
      (bad.length ? `<div class="attn" role="note"><b>Needs attention:</b> ${bad.map(a => esc(a.name)+' ('+(a.perf.success<90?a.perf.success+'% success':a.perf.edited+'% of drafts edited')+')').join(', ')}.</div>` : '') +
      `<section class="card flush scroll"><table class="tbl"><thead><tr>${th('name','Agent')}${th('owner','Owner')}<th scope="col">Status</th>${th('runs','Runs')}<th scope="col">Trend</th>${th('success','Success')}${th('time','Avg time')}${th('edited','Edited by people')}${th('cost','Cost')}${th('cpr','Per run')}</tr></thead><tbody>
      ${rows.map(a => `<tr class="row-b" tabindex="0" data-act="agent-admin" data-id="${a.id}"><td><b>${esc(a.name)}</b></td><td>${esc(own(a))}</td><td>${statusPill(a.status)}</td><td class="num">${r7(a)}</td><td>${spark(a.perf.daily)}</td><td class="num ${a.perf.success<90?'warn-t':a.perf.success>=97?'ok-t':''}">${a.perf.success}%</td><td class="num">${a.perf.avgSec.toFixed(1)}s</td><td class="num ${a.perf.edited>=40?'warn-t':''}">${a.perf.edited}%</td><td class="num">${UI.money(a.perf.cost7)}</td><td class="num">${UI.money(a.perf.cost7/Math.max(1,r7(a)))}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="3"><b>All agents</b></td><td class="num"><b>${tot}</b></td><td colspan="4"></td><td class="num"><b>${UI.money(cost)}</b></td><td class="num"><b>${UI.money(cost/Math.max(1,tot))}</b></td></tr></tfoot></table></section>
      <p class="muted" style="margin-top:10px">Success means the run finished without an error or a rejected result. "Edited by people" is the share of drafts a person changed before approving; a high number usually means the instructions need work.</p>`;
  }});
})();
