/* App-wide constants. Each role's index.html sets window.ORBIT_ROLE before this loads. */
window.CFG = {
  APP: 'ORBIT-OS',
  STORE_KEY: 'orbitos.v3',
  ROLE: window.ORBIT_ROLE || null,          // 'user' | 'admin' | 'super' (null in the all-in-one preview)
  PREVIEW: !!window.ORBIT_PREVIEW,
  DEV: !!window.ORBIT_PREVIEW || /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) || /[?&]dev=1/.test(location.search),
  ROLES: {
    user:  {label:'User',        dir:'../user/'},
    admin: {label:'Org Admin',   dir:'../org-admin/'},
    super: {label:'Super Admin', dir:'../fleet/'}
  },
  BASE_GUARDS: [
    'Never send a message to a customer without human approval.',
    'Never share pricing, discounts or contract terms.',
    'Stop and ask if a request involves spending money.'
  ],
  SUGGEST_GUARDS: [
    'Drafts only. Cannot send.',
    'Never contact customers directly.',
    'Spend no more than $5 per run.',
    'Escalate anything over $5,000 to the owner.',
    'Only use the tools listed for this agent.'
  ]
};
