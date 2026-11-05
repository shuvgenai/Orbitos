/* Starter org templates + seed builders (fresh onboarding vs. a fully launched demo office). */
window.OrgTemplates = [
  {id:'services', name:'Professional services', depts:['Sales','Operations','Finance']},
  {id:'agency',   name:'Agency',                depts:['Clients','Creative','Finance']},
  {id:'retail',   name:'Retail and e-commerce', depts:['Sales','Support','Operations']},
  {id:'blank',    name:'Start blank',           depts:[]}
];
window.Seeds = (function(){
  const uid = Store.uid;
  const base = () => ({v:3, org:{name:'BrightPath Advisors', domain:'brightpath.co', template:null, step:1, launched:false, connectLater:false, guardrails:CFG.BASE_GUARDS.slice(), job:null},
    departments:[], people:[], agents:[], requests:[], connections:{}, activity:[], audit:[], session:{userId:null}});
  function fresh(){
    const s = base(); const m = People.maria; s.people.push({id:m.id,name:m.name,email:m.email,title:m.title,deptId:null,access:'admin',authorities:[]});
    s.audit.push({at:Date.now(), who:'System', what:'Office created for '+s.org.name}); return s;
  }
  function demo(){
    const s = base(); const H = 3600000, now = Date.now();
    s.org.template='services'; s.org.step=5; s.org.launched=true;
    const D = {}; ['Sales','Operations','Finance','Support'].forEach(n => { const d = {id:uid('d_'), name:n}; D[n]=d.id; s.departments.push(d); });
    Object.values(People).forEach(p => s.people.push({id:p.id,name:p.name,email:p.email,title:p.title,deptId:D[p.dept],access:p.access,authorities:p.authorities.slice()}));
    const perf = {
      coordinator:[[3,4,4,5,4,5,4],100,3.1,0,1.9], scout:[[11,13,12,15,14,16,14],97,6.2,8,7.9], echo:[[7,8,9,8,10,9,9],93,11.4,31,5.6],
      ledger:[[5,5,6,6,5,7,6],99,9.8,4,2.9], compass:[[9,10,12,11,13,12,12],98,5.3,3,3.9], beacon:[[18,20,22,19,24,21,23],95,4.1,6,6.4],
      pulse:[[1,1,1,1,1,0,0],88,8.1,12,0.3], quill:[[4,5,3,6,5,4,5],90,18.6,44,4.1], relay:[[6,5,4,6,3,4,2],86,7.7,18,1.8]};
    const owners = {coordinator:'p_david', scout:'p_jordan', echo:'p_jordan', pulse:'p_jordan', beacon:'p_priya', quill:'p_priya', ledger:'p_marcus', compass:'p_marcus', relay:'p_marcus'};
    const stat = {coordinator:['running','Routing 3 new tasks to teammates'], scout:['running','Scoring a lead from Northwind Logistics'], echo:['waiting','Draft ready, waiting for David to approve'],
      ledger:['running','Checking 3 invoices older than 30 days'], compass:['idle','Waiting for the next task'], beacon:['running','Routing a billing question to Finance'],
      pulse:['paused','Paused by Jordan Lee'], quill:['waiting','LinkedIn post ready for Priya to approve'], relay:['idle','Waiting for the next alert']};
    const coord = Jobs.find(j=>j.type==='coordinator'); const ids = {};
    Jobs.forEach(j => { const p = perf[j.id]; ids[j.id] = uid('a_'); s.agents.push({id:ids[j.id], jobId:j.id, name:j.name, job:j.job, type:j.type, deptId:j.dept?D[j.dept]:D['Operations'], managerId:null,
      ownerId:owners[j.id], status:stat[j.id][0], doing:stat[j.id][1], prompt:j.prompt, version:1, guardrails:s.org.guardrails.slice(), tools:j.tools.slice(), budget:j.budget,
      runsToday:p[0][6], costToday:+(p[4]/7).toFixed(2), lastActive:now-(2+(j.id.length*3))*60000, provisioned:true,
      runtime:{paperclipId:'agt_'+Math.random().toString(36).slice(2,8), hermesProfile:'brightpath-'+j.name.toLowerCase(), adapter:'hermes_gateway'},
      perf:{daily:p[0],success:p[1],avgSec:p[2],edited:p[3],cost7:p[4]}, versions:[{v:1,prompt:j.prompt,at:now-H*144,by:'Maria Santos (Org Admin)'}]}); });
    s.agents.forEach(a => { if(a.type!=='coordinator') a.managerId = ids.coordinator; });
    s.agents.find(a=>a.jobId==='pulse').doing='Paused by Jordan Lee';
    ['gmail','googlecal','slack','hubspot','quickbooks','gdrive','notion'].forEach(k => s.connections[k]={on:true,mode:k==='slack'?'act':'draft',at:now-H*140,by:'Maria Santos'});
    s.requests.push({id:uid('rq'),by:'p_jordan',name:'Proposal Chaser',purpose:'Follow up on proposals that go quiet for 3 days.',prompt:'Check HubSpot for proposals sent more than 3 days ago with no reply and draft a friendly nudge.',tools:['gmail','hubspot'],reason:'We lose about two deals a month to silence.',status:'pending',adminNote:'',at:now-H*5},
      {id:uid('rq'),by:'p_priya',name:'Meeting Summarizer',purpose:'Summarize client calls and share notes.',prompt:'After each client call, write a summary with decisions and action items, then email it to every attendee and post it in Slack.',tools:['gdrive','slack','gmail'],reason:'Notes are inconsistent and follow-ups slip.',status:'pending',adminNote:'',at:now-H*2});
    s.activity = Tasks.feed(s.agents);
    s.audit.push({at:now-H*30,who:'Maria Santos',what:'Launched the office'});
    return s;
  }
  return {fresh, demo};
})();
