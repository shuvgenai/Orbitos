/* Operator registry of customer offices (numbers only; no customer content). The live office is merged in by the fleet screens. */
window.Fleet = {
  others(){ return [
    {id:'ws_orbitum', name:'OrbitumAI (customer zero)', domain:'office.orbitumai.com', status:'live', agents:6, cost:41.2, version:'1.4.2', health:'ok', admin:'shuv@orbitumai.com'},
    {id:'ws_northwind', name:'Northwind Logistics', domain:'office.northwind.example', status:'awaiting', agents:0, cost:0, version:'1.4.2', health:'ok', admin:'ops@northwind.example'},
    {id:'ws_harbor', name:'Harbor & Co', domain:'office.harborco.example', status:'live', agents:4, cost:23.7, version:'1.4.1', health:'warn', admin:'lena@harborco.example'}
  ]; },
  steps:[['stack','Start a private instance (own database and domain)'],['company','Create the office and its org chart shell'],['gateway','Connect the tool gateway'],['admin','Invite the Org Admin']]
};
