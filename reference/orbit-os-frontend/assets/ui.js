/* Tiny UI toolkit: escaping, icons, pills, layer (drawer/modal), delegated events. */
window.UI = (function(){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => '$' + Number(n || 0).toFixed(2);
  const initials = n => String(n||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const ago = ts => { const m = Math.max(1, Math.round((Date.now()-ts)/60000)); return m<60 ? m+' min ago' : m<1440 ? Math.round(m/60)+' h ago' : Math.round(m/1440)+' d ago'; };
  const P = {check:'M20 6 9 17l-5-5',plus:'M12 5v14M5 12h14',x:'M18 6 6 18M6 6l12 12',right:'m9 18 6-6-6-6',left:'m15 18-6-6 6-6',lock:'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
    users:'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    bot:'M12 8V4H8M4 8h16v12H4zM2 14h2M20 14h2M9 13v2M15 13v2',plug:'M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z',
    alert:'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',home:'m3 11 9-8 9 8M5 10v10h14V10',
    inbox:'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z',map:'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
    chart:'M3 3v18h18M7 15l4-4 3 3 5-6',org:'M10 3h4v5h-4zM3 16h4v5H3zM17 16h4v5h-4zM12 8v4M5 16v-4h14v4',list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    trash:'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',send:'m22 2-7 20-4-9-9-4zM22 2 11 13',server:'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
    rocket:'M5 15c-1 1-2 4-2 6 2 0 5-1 6-2M14 4c4-2 7-1 7-1s1 3-1 7l-8 8-5-5z',edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    pause:'M6 4h4v16H6zM14 4h4v16h-4z',play:'M6 4l14 8-14 8z',sparkle:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'};
  const ic = (n, s=16) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]||P.sparkle}"/></svg>`;
  const ST = {draft:['','Not started'],running:['ok','Running'],waiting:['warn','Waiting for approval'],idle:['','Idle'],paused:['err','Paused'],blocked:['err','Blocked']};
  const pill = (t, c='') => `<span class="pill ${c}">${t}</span>`;
  const statusPill = st => { const [c,l] = ST[st] || ST.idle; return `<span class="pill ${c}"><span class="dot"></span>${l}</span>`; };
  const kpi = (label, value, of='', hero=false) => `<div class="card kpi ${hero?'hero':''}"><small>${label}</small><b class="num">${value}${of?` <span class="of">${of}</span>`:''}</b></div>`;
  const pageH = (title, sub='', right='') => `<div class="page-h"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>${right}</div>`;
  const empty = (title, sub, cta='') => `<div class="card empty"><h3>${title}</h3><p>${sub}</p>${cta?`<div style="margin-top:12px">${cta}</div>`:''}</div>`;
  const sel = (opts, val, attrs='') => `<select ${attrs}>${opts.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(val??'')?'selected':''}>${esc(l)}</option>`).join('')}</select>`;

  let tt; function toast(m){ let t = document.getElementById('toast'); if(!t){ t = document.createElement('div'); t.id='toast'; t.setAttribute('role','status'); t.setAttribute('aria-live','polite'); document.body.appendChild(t); }
    t.className='toast'; t.textContent=m; clearTimeout(tt); tt=setTimeout(()=>{t.className='';t.textContent='';},3000); }

  const layer = () => document.getElementById('layer');
  function open(html, o={}){ const L = layer(); L.innerHTML = `<div class="scrim ${o.center?'center':''}" data-scrim="1">${html}</div>`; L.dataset.open='1';
    const f = L.querySelector('[autofocus],textarea:not([readonly]),input:not([type=checkbox])'); if(f) f.focus(); }
  function close(){ const L = layer(); if(L){ L.innerHTML=''; delete L.dataset.open; } UI.onClose && UI.onClose(); UI.onClose = null; }
  const isOpen = () => !!(layer() && layer().dataset.open);
  function confirm(msg, yes, label='Confirm'){ UI.act('_yes', ()=>{ close(); yes(); });
    open(`<section class="modal" role="alertdialog" aria-modal="true"><h2 style="font-size:17px">${esc(msg)}</h2><div class="foot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="_yes">${esc(label)}</button></div></section>`, {center:true}); }

  const acts = {}, ins = {}, chs = {};
  const UI = {esc,money,initials,ago,ic,pill,statusPill,kpi,pageH,empty,sel,toast,open,close,isOpen,confirm,ST,
    act:(n,f)=>{acts[n]=f;}, inp:(n,f)=>{ins[n]=f;}, chg:(n,f)=>{chs[n]=f;}, onClose:null};
  UI.act('close', () => close());
  document.addEventListener('click', e => {
    const sc = e.target.closest('[data-scrim]'); if(sc && e.target === sc){ close(); return; }
    const t = e.target.closest('[data-act]'); if(t && acts[t.dataset.act]) acts[t.dataset.act](t, t.dataset, e);
  });
  document.addEventListener('input', e => { const t = e.target.closest('[data-in]'); if(t && ins[t.dataset.in]) ins[t.dataset.in](t.value, t, t.dataset); });
  document.addEventListener('change', e => { const t = e.target.closest('[data-ch]'); if(t && chs[t.dataset.ch]) chs[t.dataset.ch](t.type==='checkbox'?t.checked:t.value, t, t.dataset); });
  document.addEventListener('keydown', e => {
    if(e.key==='Escape' && isOpen()){ close(); return; }
    if(e.key==='Enter' && e.target.dataset && e.target.dataset.enter){ e.preventDefault(); const f = acts[e.target.dataset.enter]; if(f) f(e.target, e.target.dataset, e); }
    if((e.key==='Enter'||e.key===' ') && e.target.matches && e.target.matches('tr[data-act]')){ e.preventDefault(); e.target.click(); }
  });
  return UI;
})();
