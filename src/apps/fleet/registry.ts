import type { FleetOffice } from '@/shared/schemas/fleet';

/**
 * The operator registry. FLEET ENTRY ONLY.
 *
 * PROVENANCE: reference/orbit-os-frontend/assets/data/fleet.js -- three sample offices and
 * the four provisioning steps, verbatim.
 *
 * Moved here out of src/shared/seeds because MockApiClient imported it to answer
 * listOffices, and the mock ships in all three bundles. That put OrbitumAI's own domain and
 * two other customers' names -- Northwind Logistics and Harbor & Co -- into every customer
 * bundle. PRD 15.3 does not name those strings, but FD-1 is instance-per-org: one
 * customer's bundle carrying another customer's name is wrong whether or not a rule lists
 * it. Measured in dist, both before and after.
 *
 * The mock now takes these as an option, which only this entry passes.
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
