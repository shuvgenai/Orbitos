import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * PRD 15.3: the User and Org Admin apps must never contain Paperclip, Hermes, OpenClaw,
 * MCP, token, agent id or an adapter name. The fleet console is exempt.
 *
 * This checks the BUILT bundles, because that is the only place the question has a real
 * answer. Two earlier attempts at it were wrong in opposite directions:
 *
 *   - Isolating the runtime schema into schemas/fleet.ts looked sufficient and was not.
 *     MockApiClient minted the profile and adapter names at provision time, and the mock
 *     ships in all three bundles, so `hermes_gateway` and the key name `adapterKey` landed
 *     in a chunk the user and org-admin entries both load. Found by grepping dist.
 *   - A source-level scan over every reachable module flagged its own explanatory comments
 *     and `import type` lines, neither of which survives the build.
 *
 * So: grep the chunks each customer entry actually loads. Prompt 6 adds the same check to
 * CI; this keeps it in the normal test run from Prompt 1 onward.
 */

const DIST = join(process.cwd(), 'dist');
/** The build keeps the entries at their PRD 15.3 paths: dist/dashboards/<entry>/. */
const HTML = join(DIST, 'dashboards');
const ASSETS = join(DIST, 'assets');

/** PRD 15.3's customer-surface ban, as far as a bundle grep can see it. */
const BANNED = /paperclip|hermes|openclaw|adapter/i;

/**
 * The operator surface, added with Prompt 1.5's role guards.
 *
 * Case-SENSITIVE, because `OrbitCrew` is correct in a customer bundle and `Orbitcrew` is
 * not (Prompt 1.5 bans the lowercase c), and because `OrbitumAI` is correct -- the shell
 * says "by OrbitumAI" -- while `orbitumai.com` is an operator address.
 *
 * `super` is deliberately NOT here. It is a JavaScript keyword: `super()` appears 13 times
 * in the vendor chunk inside transpiled classes from TanStack Query and Radix. A test for
 * the bare word could never pass, and an unpassable test teaches the next person to delete
 * it. What is testable is every string that would actually identify the operator console,
 * and all of those are below.
 */
const OPERATOR_ONLY = [
  'ORBIT-OS',
  'Super Admin',
  // FD-30 renamed the operator paths. Both the landed path and the sign-in path are listed,
  // and so is the path they replaced, so a revert cannot reintroduce the leak quietly.
  '/superadmin',
  '/admin/login',
  '/fleet/',
  'All offices',
  'Operator sign-in',
  'orbitumai.com',
  'op_shuv',
  'Orbitcrew',
];

/** The chunks an entry's HTML pulls in, by name. */
function chunksFor(entry: string): string[] {
  const html = readFileSync(join(HTML, entry, 'index.html'), 'utf8');
  return [...html.matchAll(/[^"'/]+\.js/g)].map((m) => m[0]);
}

const assetFiles = (): string[] => readdirSync(ASSETS);

const titleOf = (entry: string): string | undefined =>
  readFileSync(join(HTML, entry, 'index.html'), 'utf8').match(/<title>([^<]*)<\/title>/)?.[1];

describe.runIf(existsSync(HTML))('the built customer bundles carry no upstream name', () => {
  it.each(['user', 'orgadmin', 'landing'])('%s loads no chunk that names one', (entry) => {
    const offenders: string[] = [];
    for (const chunk of chunksFor(entry)) {
      const path = join(ASSETS, chunk);
      if (!existsSync(path)) continue;
      const hit = readFileSync(path, 'utf8').match(BANNED);
      if (hit) offenders.push(`${chunk}: ${hit[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the fleet entry does name them, so the 15.3 exemption is really in use', () => {
    const named = chunksFor('superadmin')
      .map((c) => join(ASSETS, c))
      .filter((p) => existsSync(p))
      .filter((p) => BANNED.test(readFileSync(p, 'utf8')));
    // If this ever goes empty, either the fleet console stopped showing runtime detail or
    // the chunk split moved -- both worth knowing, because this test would then be vacuous.
    expect(named.length).toBeGreaterThan(0);
  });

  it('no chunk a customer entry loads is also a fleet-only chunk', () => {
    const customer = new Set([...chunksFor('user'), ...chunksFor('orgadmin'), ...chunksFor('landing')]);
    const dirty = assetFiles()
      .filter((f) => f.endsWith('.js'))
      .filter((f) => BANNED.test(readFileSync(join(ASSETS, f), 'utf8')));
    for (const f of dirty) expect(customer.has(f), `${f} is shared and names an upstream word`).toBe(false);
  });

  it.each(['user', 'orgadmin', 'landing'])(
    '%s loads no chunk naming the operator surface',
    (entry) => {
      // The landing page's own call to action is a mailto to OrbitumAI, so the contact
      // address is correct THERE and nowhere else. Everything else on the list still applies
      // to it: it is a public page and PRD 15.3's customer rule covers it.
      const words =
        entry === 'landing' ? OPERATOR_ONLY.filter((w) => w !== 'orbitumai.com') : OPERATOR_ONLY;
      const offenders: string[] = [];
      for (const chunk of chunksFor(entry)) {
        const path = join(ASSETS, chunk);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, 'utf8');
        for (const word of words) {
          if (text.includes(word)) offenders.push(`${chunk}: ${word}`);
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it('the landing page names the two customer sign-ins and no operator path', () => {
    const text = chunksFor('landing')
      .map((c) => join(ASSETS, c))
      .filter((p) => existsSync(p))
      .map((p) => readFileSync(p, 'utf8'))
      .join('');
    // FD-30: two sign-ins on the page, the User one and the Org Admin one.
    expect(text.includes('/login')).toBe(true);
    expect(text.includes('/org/login')).toBe(true);
    // The operator sign-in is not linked, named or commented anywhere on a public page.
    // Not as protection -- the allow list is that -- but operators know their URL.
    expect(text.includes('/superadmin')).toBe(false);
    expect(text.includes('/admin/login')).toBe(false);
    // And no self-signup: the content spec is explicit that there is none.
    expect(/sign\s*up/i.test(text)).toBe(false);
  });

  it('the landing page carries none of the app data, because it has no client', () => {
    const text = chunksFor('landing')
      .map((c) => join(ASSETS, c))
      .filter((p) => existsSync(p))
      .map((p) => readFileSync(p, 'utf8'))
      .join('');
    for (const word of ['BrightPath', 'Maria Santos', 'orbitcrew.v1', 'Operations Reporter']) {
      expect(text.includes(word), `landing should not carry ${word}`).toBe(false);
    }
  });

  it('the operator entry does carry them, so the exemption is really in use', () => {
    const text = chunksFor('superadmin')
      .map((c) => join(ASSETS, c))
      .filter((p) => existsSync(p))
      .map((p) => readFileSync(p, 'utf8'))
      .join('');
    for (const word of ['ORBIT-OS', 'Super Admin', '/superadmin/login']) {
      expect(text.includes(word), word).toBe(true);
    }
  });

  it('every title is right: OrbitCrew, OrbitCrew, ORBIT-OS (PRD 15.3)', () => {
    expect(titleOf('user')).toBe('OrbitCrew');
    expect(titleOf('orgadmin')).toBe('OrbitCrew');
    expect(titleOf('superadmin')).toBe('ORBIT-OS');
    // The content spec's own page title, with FD-5's casing. Errata L-7.
    expect(titleOf('landing')).toBe(
      'OrbitCrew — The first hire that never needs onboarding',
    );
  });
});
