/* Tool (MCP) catalog. All traffic goes through ORBIT's policy gateway; ORBIT holds the tokens, never the agent. */
window.MCPS = {
  gmail:{name:'Gmail',mono:'G',tile:'#3B6FD8',tier:'ready',auth:'Google sign-in',desc:'Read new messages and prepare drafts from your own address.',
    can:['Read new messages','Create drafts','Apply labels'],ask:['Sending to more than one person'],never:['Deleting email']},
  googlecal:{name:'Google Calendar',mono:'GC',tile:'#2F7FB8',tier:'early',auth:'Google sign-in',desc:'See availability and propose or book meetings.',
    can:['Read availability','Propose meeting times'],ask:['Cancelling a meeting with a customer'],never:['Deleting calendars']},
  slack:{name:'Slack',mono:'S',tile:'#7C4DCC',tier:'ready',auth:'Slack sign-in',desc:'Post summaries and send approval requests where your team talks.',
    can:['Post messages','Send approvals as direct messages'],ask:['Posting in a public channel'],never:['Reading channels it was not added to']},
  hubspot:{name:'HubSpot',mono:'H',tile:'#D0612B',tier:'ready',auth:'HubSpot sign-in',desc:'Create and update contacts, deals and notes in your CRM.',
    can:['Create and update contacts','Update deal stages','Add notes'],ask:['Marking a deal as lost'],never:['Deleting records']},
  quickbooks:{name:'QuickBooks Online',mono:'QB',tile:'#1F8A5B',tier:'early',auth:'Intuit sign-in',desc:'Invoices, bills, payments and reports from your books.',
    can:['Read invoices, bills and customers','Draft payment reminders'],ask:['Creating or changing an invoice'],never:['Deleting records','Moving money']},
  stripe:{name:'Stripe',mono:'ST',tile:'#5454C9',tier:'early',auth:'Stripe sign-in',desc:'Payments, customers and subscriptions.',
    can:['Look up payments and customers','Check subscription status'],ask:['Issuing a refund'],never:['Sending payouts']},
  gdrive:{name:'Google Drive',mono:'GD',tile:'#56657A',tier:'early',auth:'Google sign-in',desc:'Find and read files; save generated reports.',
    can:['Search and read files','Save generated reports'],ask:['Sharing a file outside your company'],never:['Deleting files']},
  notion:{name:'Notion',mono:'N',tile:'#1A1A24',tier:'early',auth:'Notion sign-in',desc:'Read pages and add database entries.',
    can:['Search pages','Add database entries'],ask:['Editing a page someone else owns'],never:['Deleting pages']},
  intercom:{name:'Intercom',mono:'IC',tile:'#C2410C',tier:'soon',auth:'Intercom sign-in',desc:'Customer conversations and help articles.',can:['Read conversations'],ask:['Replying to a customer'],never:['Closing conversations in bulk']},
  salesforce:{name:'Salesforce',mono:'SF',tile:'#2F7FD0',tier:'soon',auth:'Salesforce sign-in',desc:'Leads, contacts and opportunities.',can:['Read and update leads'],ask:['Changing an opportunity amount'],never:['Deleting records']}
};
window.MCP_TIER = {ready:['Available','ok'],early:['Early access','brand'],soon:['Coming soon','']};
window.MCP_MODES = [['read','Read only'],['draft','Read and prepare drafts'],['act','Read and act, with approval']];
