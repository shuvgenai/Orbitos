export type NavItem = {
  name: string;
  label: string;
  /** A badge count, or undefined for none. */
  count?: number;
  /** A plain group heading rather than a link. */
  heading?: true;
};

/**
 * The shape only. Each entry builds its OWN nav, in src/apps/<entry>/nav.ts.
 *
 * This used to be one `navFor(role)` with a branch per role, which meant every entry's nav
 * copy -- including the operator console's -- shipped in all three bundles. Measured: the
 * shared chunk carried `ORBIT-OS`, `Operator`, `/admin/login` and the operator access value
 * into both customer entries. Splitting it is what removed them. See docs/auth.md.
 */
export const navItem = (name: string, label: string, count?: number): NavItem =>
  count === undefined || count === 0 ? { name, label } : { name, label, count };

export const navHeading = (label: string): NavItem => ({
  name: `heading-${label}`,
  label,
  heading: true,
});
