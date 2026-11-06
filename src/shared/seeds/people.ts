import type { Authority, OfficeAccess } from '@/shared/schemas';

/**
 * The five demo people.
 *
 * PROVENANCE: reference/orbit-os-frontend/assets/data/people.js, in full and verbatim —
 * ids, names, emails, titles, departments, access and authorities.
 *
 * FD-21 settles which file this is. The Build Prompts name `assets/data/org.js`, which holds
 * NO person records at all: it iterates `window.People` from people.js, and the only literal
 * names in it are an audit author and the copy "Paused by Jordan Lee". That is recorded as a
 * defect against the Build Prompts (DEF-3, errata E-7) and is fixed in the canonical copy on
 * claude.ai, not in the repo copy.
 */
export type SeedPerson = {
  id: string;
  name: string;
  email: string;
  title: string;
  deptName: string;
  access: OfficeAccess;
  authorities: Authority[];
};

export const DEMO_PEOPLE: SeedPerson[] = [
  {
    id: 'p_maria',
    name: 'Maria Santos',
    email: 'maria@brightpath.co',
    title: 'Office manager',
    deptName: 'Operations',
    access: 'admin',
    authorities: [],
  },
  {
    id: 'p_david',
    name: 'David Park',
    email: 'david@brightpath.co',
    title: 'CEO',
    deptName: 'Sales',
    access: 'user',
    authorities: ['leader', 'approver'],
  },
  {
    id: 'p_jordan',
    name: 'Jordan Lee',
    email: 'jordan@brightpath.co',
    title: 'Business development',
    deptName: 'Sales',
    access: 'user',
    authorities: ['approver'],
  },
  {
    id: 'p_priya',
    name: 'Priya Nair',
    email: 'priya@brightpath.co',
    title: 'Customer success',
    deptName: 'Support',
    access: 'user',
    authorities: [],
  },
  {
    id: 'p_marcus',
    name: 'Marcus Reed',
    email: 'marcus@brightpath.co',
    title: 'Finance lead',
    deptName: 'Finance',
    access: 'user',
    authorities: ['budget'],
  },
];

/** A fresh office starts with the Org Admin only. PROVENANCE: org.js `Seeds.fresh`. */
export const FRESH_ADMIN = DEMO_PEOPLE[0]!;
