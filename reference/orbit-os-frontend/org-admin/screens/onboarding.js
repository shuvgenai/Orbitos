/* Org Admin onboarding wizard: 1 Org structure -> 2 Agents -> 3 Assign -> 4 Connections -> 5 Launch (hiring job, resumable). */
(function(){
  const {esc, ic, pill} = UI; const S = () => Store.get();
  const STEPS = [
    ['Org structure','Who is on the board and in each team', () => API.validateOrg(), () => OA.structureView()],
    ['Agents','Hire your AI teammates', () => API.validateAgents(), () => OA.agentsView()],
    ['Assign','Give every agent an owner', () => API.validateAssign(), () => OA.assignView()],
    ['Connections','Connect the tools they need', () => API.validateConnections(), () => OA.connectionsView()],
    ['Launch','Hire the team and go live', () => [], launchView]
  ];
  const errsUpTo = n => { for(let i = 0; i < n; i++){ const e = STEPS[i][2](); if(e.length) return {step:i+1, errs:e}; } return null; };
  const setStep = n => Store.update(s => { s.org.step = n; });
  const hasAgents = () => S().agents.length > 0;

  function launchView(){
    const s = S(), job = s.org.job, miss = Object.keys(API.requiredTools()).filter(k => !API.isOn(k));
    const paused = s.agents.filter(a => a.tools.some(t => miss.includes(t))).length;
    const stat = (n,l) => `<div class="card kpi"><small>${l}</small><b class="num">${n}</b></div>`;
    let body = '';
    if(!job){
      body = `<div class="kpis" style="margin-bottom:14px">${stat(s.departments.length,'Departments')}${stat(s.people.length,'People')}${stat(s.agents.length,'Agents')}${stat(Object.keys(s.connections).length,'Tools connected')}</div>
        ${paused ? `<div class="note" style="margin-bottom:12px">${paused} agent${paused>1?'s':''} will start paused until you connect their tools.</div>` : ''}
        <div class="note info" style="margin-bottom:14px">Launching creates your office, builds the org chart, hires each agent with its own workspace and budget, applies tool permissions and invites your people. No agent runs until this finishes.</div>
        ${CFG.DEV ? `<label class="row" style="margin-bottom:12px"><input type="checkbox" id="simfail" style="width:auto"> Dev: simulate a failure at "workspace" to test retry</label>` : ''}
        <button class="btn primary" data-act="launch">${ic('rocket')} Hire the team</button>`;
    } else {
      const done = job.steps.filter(x => x.status === 'done').length, pct = Math.round(done / job.steps.length * 100);
      const failed = job.steps.some(x => x.status === 'fail'), stalled = !failed && !job.done && !API.isJobActive();
      body = `<div class="row" style="margin-bottom:10px"><div class="bar grow" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><b class="num">${pct}%</b></div>
        <ul class="job gl" style="gap:0">${job.steps.map(x => `<li><span class="s ${x.status==='done'?'done':x.status==='run'?'run':x.status==='fail'?'fail':''}">${x.status==='done'?ic('check',12):x.status==='fail'?ic('x',12):''}</span><span class="grow" style="${x.status==='pending'?'color:var(--muted)':''}">${esc(x.label)}</span></li>`).join('')}</ul>
        ${job.error ? `<div class="note err" role="alert" style="margin-top:12px">${esc(job.error)}</div>` : ''}
        ${failed || stalled ? `<div style="margin-top:12px"><button class="btn primary" data-act="retry">${failed?'Retry from this step':'Resume'}</button></div>` : ''}
        ${s.org.launched ? `<div class="note ok" style="margin-top:12px"><b>Your office is live.</b> ${paused?paused+' agent'+(paused>1?'s are':' is')+' paused until their tools are connected. ':''}Invitations were sent to your team.</div>
          <div style="margin-top:12px"><a class="btn primary" href="${Router.href('dashboard')}">Go to your dashboard</a></div>` : ''}`;
    }
    return `<section class="card pad"><h3 style="margin-bottom:10px">${s.org.launched?'Done':'Ready to launch?'}</h3>${body}</section>`;
  }
  UI.act('launch', () => { const sf = document.getElementById('simfail'); API.startLaunch(sf && sf.checked); });
  UI.act('retry', () => API.retryJob());
  UI.act('wiz-go', (t,d) => { const b = errsUpTo(+d.n - 1); if(b){ UI.toast('Finish step '+b.step+' first'); return; } setStep(+d.n); });
  UI.act('wiz-next', () => { const n = S().org.step; const e = STEPS[n-1][2](); if(e.length) return; setStep(n + 1); });
  UI.act('wiz-back', () => setStep(Math.max(1, S().org.step - 1)));

  Router.reg('admin','onboarding',{title:'Set up your office', render(){
    const s = S(), cur = Math.min(5, Math.max(1, s.org.step));
    if(s.org.launched && !(s.org.job && !s.org.job.seen)){ /* fall through to show final state once */ }
    const block = errsUpTo(cur - 1); if(block && block.step < cur){ setTimeout(() => setStep(block.step), 0); }
    const errs = STEPS[cur-1][2]();
    const stepper = `<nav class="stepper" aria-label="Setup steps">${STEPS.map((x,i) => { const n = i + 1, ok = n < cur && !STEPS[i][2]().length; const lock = !!errsUpTo(n - 1);
      return `<button class="step ${n===cur?'on':''} ${ok?'done':''}" data-act="wiz-go" data-n="${n}" ${lock&&n!==cur?'disabled':''} ${n===cur?'aria-current="step"':''}><span class="n">${ok?ic('check',13):n}</span><span><b>${x[0]}</b><small>${x[1].length>26?x[1].slice(0,24)+'…':x[1]}</small></span></button>`; }).join('')}</nav>`;
    const foot = cur === 5 ? `<div class="wfoot"><button class="btn" data-act="wiz-back" ${s.org.job&&!s.org.launched?'disabled':''}>${ic('left')} Back</button><span></span></div>`
      : `<div class="wfoot"><button class="btn" data-act="wiz-back" ${cur===1?'disabled':''}>${ic('left')} Back</button>
        <div>${errs.length ? `<div class="note" style="text-align:left;margin-bottom:8px" role="status"><b>To continue:</b><ul class="todo">${errs.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}<div style="text-align:right"><button class="btn primary" data-act="wiz-next" ${errs.length?'disabled':''}>Continue ${ic('right')}</button></div></div></div>`;
    const intro = ['Set up who is in your business. Leaders form the board that approves big decisions.','Hire one Coordinator, then specialists. The chart is a strict tree: every agent has exactly one manager.','Give every agent one owner so someone is responsible for it.','These are the tools your agents need. Connect each one so they can start working.','Review and launch. This creates everything in one go.'][cur-1];
    return UI.pageH(`Step ${cur} of 5: ${STEPS[cur-1][0]}`, intro) + stepper + STEPS[cur-1][3]() + foot;
  }});
})();
