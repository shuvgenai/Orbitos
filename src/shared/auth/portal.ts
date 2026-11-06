/**
 * What one sign-in entry knows about itself.
 *
 * Deliberately NOT an enumeration of the three roles. Every field is supplied by the entry
 * that owns it, from its own module under src/apps/<entry>/portal.ts, so the operator
 * console's strings exist only in the fleet bundle.
 *
 * That is the answer to "how does the fleet entry get `super` without `super` appearing in
 * the customer bundles": `allow` is data, not a type. The shared auth code compares strings
 * and never names them. Measured before and after -- see docs/auth.md.
 */
export type Portal = {
  /** 'User' | 'Org Admin' | 'Super Admin'. Shown in the shell; never used as a check. */
  label: string;
  /** PRD 15.3: OrbitCrew on the customer entries, ORBIT-OS on the fleet console. */
  title: string;
  /** Where this entry is served. */
  base: string;
  /** Prompt 1.5's sign-in path for this entry. Sign-out returns here. */
  loginPath: string;
  /**
   * The access values this entry admits. A signed-in profile whose access is not in this
   * list sees a refusal, never a redirect: a redirect turns a URL into a role probe.
   */
  allow: readonly string[];
  /** Login screen copy. */
  heading: string;
  sub: string;
};

/**
 * An account this entry can authenticate that is not a person in the office.
 *
 * The operator has no office row -- a super admin carries no `org_id` (migration 0010,
 * `super_has_no_org`) -- so they cannot come from the people list. The fleet entry supplies
 * its own; the customer entries supply none, which is why no operator address appears in
 * their bundles.
 */
export type Account = {
  id: string;
  name: string;
  email: string;
  access: string;
};
