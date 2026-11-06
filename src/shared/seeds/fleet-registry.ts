import type { FleetOffice } from '@/shared/schemas/fleet';

/**
 * The operator registry. PROVENANCE: reference/orbit-os-frontend/assets/data/fleet.js --
 * three sample offices and the four provisioning steps, verbatim.
 *
 * Split from fleet-runtime.ts on purpose: MockApiClient needs this to answer listOffices,
 * and the mock ships in all three bundles, so anything in here reaches the customer apps.
 * Nothing in this file contains an upstream name. See fleet-runtime.ts for the half that
 * does and must not.
 */
export const SAMPLE_OFFICES: FleetOffice[] = [
  {
    id: 'ws_orbitum',
    name: 'OrbitumAI (customer zero)',
    domain: 'office.orbitumai.com',
    status: 'live',
    agents: 6,
    cost: 41.2,
    version: '1.4.2',
    health: 'ok',
    admin: 'shuv@orbitumai.com',
  },
  {
    id: 'ws_northwind',
    name: 'Northwind Logistics',
    domain: 'office.northwind.example',
    status: 'awaiting',
    agents: 0,
    cost: 0,
    version: '1.4.2',
    health: 'ok',
    admin: 'ops@northwind.example',
  },
  {
    id: 'ws_harbor',
    name: 'Harbor & Co',
    domain: 'office.harborco.example',
    status: 'live',
    agents: 4,
    cost: 23.7,
    version: '1.4.1',
    health: 'warn',
    admin: 'lena@harborco.example',
  },
];

/** PROVENANCE: fleet.js `Fleet.steps` -- four steps, verbatim. */
export const PROVISION_STEPS: ReadonlyArray<readonly [string, string]> = [
  ['stack', 'Start a private instance (own database and domain)'],
  ['company', 'Create the office and its org chart shell'],
  ['gateway', 'Connect the tool gateway'],
  ['admin', 'Invite the Org Admin'],
] as const;

export const INSTANCE_VERSION = '1.4.2';

/**
 * An opaque reference minted when a teammate is provisioned.
 *
 * It deliberately carries no upstream name, because this runs in the Org Admin app at
 * launch. The operator-visible profile and adapter names are composed from it in
 * fleet-runtime.ts, which only the fleet entry imports.
 */
export const mintRuntimeRef = (): string => `agt_${Math.random().toString(36).slice(2, 8)}`;
