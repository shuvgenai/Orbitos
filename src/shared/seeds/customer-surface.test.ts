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

/** The chunks an entry's HTML pulls in, by name. */
function chunksFor(entry: string): string[] {
  const html = readFileSync(join(HTML, entry, 'index.html'), 'utf8');
  return [...html.matchAll(/[^"'/]+\.js/g)].map((m) => m[0]);
}

const assetFiles = (): string[] => readdirSync(ASSETS);

const titleOf = (entry: string): string | undefined =>
  readFileSync(join(HTML, entry, 'index.html'), 'utf8').match(/<title>([^<]*)<\/title>/)?.[1];

describe.runIf(existsSync(HTML))('the built customer bundles carry no upstream name', () => {
  it.each(['user', 'org-admin'])('%s loads no chunk that names one', (entry) => {
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
    const named = chunksFor('fleet')
      .map((c) => join(ASSETS, c))
      .filter((p) => existsSync(p))
      .filter((p) => BANNED.test(readFileSync(p, 'utf8')));
    // If this ever goes empty, either the fleet console stopped showing runtime detail or
    // the chunk split moved -- both worth knowing, because this test would then be vacuous.
    expect(named.length).toBeGreaterThan(0);
  });

  it('no chunk a customer entry loads is also a fleet-only chunk', () => {
    const customer = new Set([...chunksFor('user'), ...chunksFor('org-admin')]);
    const dirty = assetFiles()
      .filter((f) => f.endsWith('.js'))
      .filter((f) => BANNED.test(readFileSync(join(ASSETS, f), 'utf8')));
    for (const f of dirty) expect(customer.has(f), `${f} is shared and names an upstream word`).toBe(false);
  });

  it('every title is right: OrbitCrew, OrbitCrew, ORBIT-OS (PRD 15.3)', () => {
    expect(titleOf('user')).toBe('OrbitCrew');
    expect(titleOf('org-admin')).toBe('OrbitCrew');
    expect(titleOf('fleet')).toBe('ORBIT-OS');
  });
});
