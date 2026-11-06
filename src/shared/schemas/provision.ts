import { z } from 'zod';

/**
 * What the operator types to create an office. PRD S-01.
 *
 * ITS OWN MODULE, and the reason is measured rather than stylistic. `MockApiClient` validates
 * this schema, the mock ships in all three bundles, and a Zod object keeps its key names at
 * runtime -- so when this lived in `schemas/fleet.ts` beside `agentRuntimeSchema`, importing
 * it pulled `adapterKey` into a shared chunk and `customer-surface.test.ts` failed with
 * `nav-*.js: adapter`. Nothing in this file names an upstream or operator word, and nothing
 * that does may be added to it.
 */
export const provisionInputSchema = z.object({
  name: z.string().min(2, 'Enter the business name.'),
  domain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Enter a domain like office.acme.com.'),
  email: z
    .string()
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter the Org Admin email.'),
  /**
   * The Org Admin's own name, so the invitation can address them and the person row created
   * on acceptance is not called after their email address.
   *
   * PROVENANCE: PROPOSED. PRD S-01 says "six facts in" and never lists the six; the
   * prototype's provision form collected three. The fourth is added because A-04 issues an
   * invitation to a person, and an invitation with no name is addressed to nobody.
   */
  adminName: z.string().min(2, 'Enter the Org Admin name.'),
});

export type ProvisionInput = z.infer<typeof provisionInputSchema>;
