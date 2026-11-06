import type { Account, Portal } from '@/shared/auth/portal';

/** PRD 15.3 exempts the fleet console; ORBIT-OS is correct here and nowhere else. */
const APP_NAME_OPERATOR = 'ORBIT-OS';

/**
 * The operator entry. THE ONLY MODULE IN THE TREE THAT NAMES THE OPERATOR ACCESS VALUE.
 *
 * PRD 15.3 exempts the fleet console, so ORBIT-OS and operator wording are correct here and
 * nowhere else. Keeping this file out of the customer entries' import graph is what keeps
 * their bundles free of it -- asserted in src/shared/seeds/customer-surface.test.ts.
 */
export const PORTAL: Portal = {
  label: 'Super Admin',
  title: APP_NAME_OPERATOR,
  base: '/fleet/',
  loginPath: '/admin/login',
  allow: ['super'],
  heading: 'Operator sign-in',
  sub: 'Every customer office, at the operations level.',
};

/**
 * The operator has no office row -- a super admin carries no `org_id` (migration 0010,
 * `super_has_no_org`) -- so they cannot come from the people list and are supplied here.
 *
 * Prompt 1.5 item 2 seeds this account in Supabase with a password from an env var. That
 * item is not built (FD-26), so this is the development stand-in and holds no secret: the
 * password is checked in SessionProvider against VITE_DEV_PASSWORD.
 */
export const OPERATOR_ACCOUNTS: readonly Account[] = [
  { id: 'op_shuv', name: 'Shuv Chowdhury', email: 'shuv@orbitumai.com', access: 'super' },
];
