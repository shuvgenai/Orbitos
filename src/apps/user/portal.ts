import type { Portal } from '@/shared/auth/portal';
import { APP_NAME_CUSTOMER } from '@/shared/seeds/config';

/**
 * The User entry. Prompt 1.5's table: accepts user and admin, refuses the operator.
 *
 * It accepts admin because PRD 7.1 says an Org Admin reaches everything a User reaches.
 * The operator value is simply absent from `allow`, which is how this bundle stays free of
 * it -- there is no need to name what you are excluding.
 */
export const PORTAL: Portal = {
  label: 'User',
  title: APP_NAME_CUSTOMER,
  base: '/user',
  loginPath: '/login',
  allow: ['user', 'admin'],
  heading: 'Sign in',
  sub: 'Your agents, what they are doing, and what they cost.',
};
