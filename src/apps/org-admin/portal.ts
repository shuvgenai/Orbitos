import type { Portal } from '@/shared/auth/portal';
import { APP_NAME_CUSTOMER } from '@/shared/seeds/config';

/**
 * The Org Admin entry. Prompt 1.5's table: accepts admin only.
 *
 * It does NOT accept user -- "the org entry does not accept `user`" -- which is the one
 * asymmetry in the matrix: an Org Admin reaches the User app, but not the reverse.
 */
export const PORTAL: Portal = {
  label: 'Org Admin',
  title: APP_NAME_CUSTOMER,
  base: '/orgadmin',
  loginPath: '/org/login',
  allow: ['admin'],
  heading: 'Sign in',
  sub: 'Set up your office, review requests and watch your team.',
};
