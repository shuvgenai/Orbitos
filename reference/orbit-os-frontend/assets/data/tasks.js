/* Mock activity (receipts) and what-an-agent-is-doing generators. */
window.Tasks = {
  make(agent){ const j = Jobs.find(x => x.id === agent.jobId); const s = (j && j.sample) || ['Working on a task']; return s[Math.floor(Math.random()*s.length)]; },
  feed(agents){
    const out = []; const now = Date.now();
    agents.forEach((a,i) => { const j = Jobs.find(x => x.id === a.jobId); const s = (j && j.sample) || [];
      s.slice(0,2).forEach((title,k) => out.push({id:'r_'+a.id+k, t:now-(i*37+k*95+8)*60000, agentId:a.id, title, status:k===0&&a.type==='specialist'&&i%3===1?'waiting':'done',
        why:'Matched the instructions for '+a.name+' and passed every guardrail.', cost:+(0.03+((i*7+k*3)%9)/100).toFixed(2), dur:+(1.4+((i*5+k)%30)/10).toFixed(1)})); });
    return out.sort((x,y)=>y.t-x.t);
  }
};
