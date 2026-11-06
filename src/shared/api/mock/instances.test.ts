import { beforeEach, describe, expect, it } from 'vitest';
import { STORE_KEY } from '@/shared/seeds/config';
import { demo } from '@/shared/seeds/office';
import { DOCUMENT_VERSION, MockStore } from './store';

/**
 * The persisted shape, and the upgrade onto it.
 *
 * FD-31 constraint 5: a stale document is MIGRATED, never discarded and never allowed to
 * throw on boot, because a developer's localStorage holds an office they have been working
 * in. Each case here is a document someone could actually have.
 */

const read = () => JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');

/** A v1 document: one office at the top level, exactly as the old store wrote it. */
const V1 = {
  v: 1,
  org: {
    name: 'BrightPath Advisors',
    domain: 'brightpath.co',
    template: null,
    step: 3,
    launched: true,
    connectLater: false,
    guardrails: ['Never send money'],
    job: null,
  },
  departments: [{ id: 'd_1', name: 'Finance' }],
  people: [
    {
      id: 'p_1',
      name: 'Maria Santos',
      email: 'maria@brightpath.co',
      title: 'Owner',
      deptId: null,
      access: 'admin',
      authorities: ['leader'],
    },
  ],
  agents: [],
  requests: [],
  connections: {},
  activity: [],
  audit: [{ at: 1, who: 'System', what: 'Office created for BrightPath Advisors' }],
  session: { userId: 'p_1' },
};

beforeEach(() => localStorage.clear());

describe('a v1 document is migrated, not lost', () => {
  it('keeps the office, its people, its departments and its audit', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(V1));
    const store = new MockStore('1.4.2');

    const state = store.get();
    expect(state?.org.name).toBe('BrightPath Advisors');
    expect(state?.org.launched).toBe(true);
    expect(state?.people[0]?.name).toBe('Maria Santos');
    expect(state?.departments[0]?.name).toBe('Finance');
    expect(state?.audit).toHaveLength(1);
    // Still signed in: a shape change must not sign the developer out of their own office.
    expect(state?.session.userId).toBe('p_1');
  });

  it('binds the migrated office, so the customer entries still read something', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(V1));
    const store = new MockStore();
    expect(store.boundId()).not.toBeNull();
    expect(store.document().instances[store.boundId()!]?.org.name).toBe('BrightPath Advisors');
  });

  it('gives the migrated office a fleet metadata row', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(V1));
    const store = new MockStore('1.4.2');
    const meta = store.document().fleetMeta[store.boundId()!];
    expect(meta?.version).toBe('1.4.2');
    // Read once at migration from the office that was there, not a live read of its people.
    expect(meta?.adminEmail).toBe('maria@brightpath.co');
  });

  it('turns a v1 fleet row into a real office rather than dropping it', () => {
    // v1 had no UI that could create one, so this is rare -- but a dropped office would be a
    // silent data loss, which is exactly what constraint 5 forbids.
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        ...V1,
        fleet: [
          {
            id: 'ws_legacy',
            name: 'Northwind Logistics',
            domain: 'office.northwind.example',
            status: 'awaiting',
            agents: 0,
            cost: 0,
            version: '1.4.1',
            health: 'warn',
            admin: 'ops@northwind.example',
          },
        ],
      }),
    );
    const doc = new MockStore('1.4.2').document();
    expect(Object.keys(doc.instances)).toContain('ws_legacy');
    expect(doc.instances['ws_legacy']?.org.name).toBe('Northwind Logistics');
    // No Org Admin, because the row never had an accepted one -- which is what "awaiting" meant.
    expect(doc.instances['ws_legacy']?.people).toEqual([]);
    expect(doc.fleetMeta['ws_legacy']?.health).toBe('warn');
    expect(doc.fleetMeta['ws_legacy']?.version).toBe('1.4.1');
    // The legacy array itself is gone from the office's own document.
    expect('fleet' in (doc.instances[doc.boundOfficeId!] as object)).toBe(false);
  });

  it('writes the new version number back', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(V1));
    const store = new MockStore();
    store.updateDocument(() => {});
    expect(read().v).toBe(DOCUMENT_VERSION);
  });
});

describe('a FULL v1 office survives the migration intact', () => {
  /**
   * The sparse fixture above is not the document a developer actually has. This one is a
   * launched demo office -- departments, people, six teammates with prompts and perf rows,
   * requests, connections, receipts, audit -- written in the v1 shape, which is what is
   * sitting in a real browser right now. If anything is going to be lost, it is lost here.
   */
  const asV1 = () => {
    const s = demo() as Record<string, unknown>;
    return { ...s, v: 1 };
  };

  it('keeps every collection, element for element', () => {
    const before = asV1();
    localStorage.setItem(STORE_KEY, JSON.stringify(before));
    const after = new MockStore('1.4.2').get()!;

    // Counts first, so a later deep-equal cannot pass on two empty things.
    expect(after.departments.length).toBe((before['departments'] as unknown[]).length);
    expect(after.people.length).toBe((before['people'] as unknown[]).length);
    expect(after.agents.length).toBe((before['agents'] as unknown[]).length);
    expect(after.requests.length).toBe((before['requests'] as unknown[]).length);
    expect(after.activity.length).toBe((before['activity'] as unknown[]).length);
    expect(after.audit.length).toBe((before['audit'] as unknown[]).length);
    expect(after.agents.length).toBeGreaterThan(1);
    expect(after.people.length).toBeGreaterThan(1);

    // Then the whole office, field for field. `fleet` is the only key the migration drops,
    // and a v1 demo document never had one.
    expect(after).toEqual({ ...before, v: 1 });
  });

  it('keeps the office launched, so the ticker and the fleet status still agree', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(asV1()));
    const store = new MockStore('1.4.2');
    expect(store.get()?.org.launched).toBe(true);
    expect(store.get()?.org.step).toBe(5);
  });

  it('keeps a teammate prompt, its version history and its guardrails', () => {
    // The things a developer would actually notice missing.
    const before = asV1();
    localStorage.setItem(STORE_KEY, JSON.stringify(before));
    const agent = new MockStore().get()!.agents.find((a) => a.versions.length > 0)!;
    expect(agent.prompt.length).toBeGreaterThan(0);
    expect(agent.guardrails.length).toBeGreaterThan(0);
    expect(agent.versions[0]?.prompt.length).toBeGreaterThan(0);
  });

  it('does not rewrite the stored document until something actually writes', () => {
    // This is what makes a backup-before-reload worth taking: the migration happens in
    // memory, so an untouched reload leaves the v1 bytes on disk and nothing is committed to
    // the new shape until the first write -- which, for a LAUNCHED office, is the ticker.
    const raw = JSON.stringify(asV1());
    localStorage.setItem(STORE_KEY, raw);
    new MockStore('1.4.2');
    expect(localStorage.getItem(STORE_KEY)).toBe(raw);
    expect(read().v).toBe(1);
  });
});

describe('a document that cannot be read never throws on boot', () => {
  it.each([
    ['unparseable', '{not json'],
    ['null', 'null'],
    ['an empty object', '{}'],
    ['a string', '"hello"'],
    ['instances with nothing in them', '{"v":2,"instances":{},"fleetMeta":{},"invites":[]}'],
  ])('replaces %s with a fresh office', (_label, raw) => {
    localStorage.setItem(STORE_KEY, raw);
    let store: MockStore | undefined;
    expect(() => {
      store = new MockStore();
    }).not.toThrow();
    expect(store!.get()?.org.name).toBeTruthy();
  });

  it('survives a v2 document whose bound id no longer resolves', () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        v: 2,
        boundOfficeId: 'ws_gone',
        instances: { ws_here: { ...V1 } },
        fleetMeta: {},
        invites: [],
      }),
    );
    const store = new MockStore();
    // Falls back to an office that exists rather than leaving the entries pointing at nothing.
    expect(store.boundId()).toBe('ws_here');
    expect(store.get()?.org.name).toBe('BrightPath Advisors');
  });

  it('fills a missing fleet metadata row instead of refusing the document', () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        v: 2,
        boundOfficeId: 'ws_here',
        instances: { ws_here: { ...V1 } },
        fleetMeta: {},
        invites: [],
      }),
    );
    expect(new MockStore('9.9.9').document().fleetMeta['ws_here']?.version).toBe('9.9.9');
  });
});

describe('Dev tools resets ONE office, not the document', () => {
  it('leaves every other office, its metadata and its invitations alone', () => {
    // The v1 bug this replaces: `reset` assigned a whole new document, so "Load demo office"
    // silently deleted every office the operator had provisioned. Demonstrated before the fix.
    const store = new MockStore('1.4.2');
    const mine = store.boundId()!;
    store.updateDocument((d) => {
      d.instances['ws_acme'] = { ...(d.instances[mine] as object) } as never;
      d.fleetMeta['ws_acme'] = {
        version: '1.4.2',
        health: 'ok',
        adminEmail: 'ada@acme.com',
        createdAt: 1,
      };
      d.invites.push({
        token: 'tok',
        officeId: 'ws_acme',
        email: 'ada@acme.com',
        name: 'Ada Okonkwo',
        issuedBy: 'Operator',
        issuedAt: 1,
        expiresAt: 2,
        usedAt: null,
      });
    });

    store.reset('demo');

    const doc = store.document();
    expect(Object.keys(doc.instances)).toContain('ws_acme');
    expect(doc.fleetMeta['ws_acme']?.adminEmail).toBe('ada@acme.com');
    expect(doc.invites).toHaveLength(1);
    // And it did replace the bound one, which is what it is for.
    expect(doc.instances[mine]?.org.launched).toBe(true);
  });
});

describe('persistence', () => {
  it('a second store over the same key sees the first one write (reload, or a second tab)', () => {
    const a = new MockStore();
    a.updateDocument((d) => {
      d.fleetMeta['ws_marker'] = {
        version: 'x',
        health: 'ok',
        adminEmail: 'm@example.com',
        createdAt: 1,
      };
    });
    expect(new MockStore().document().fleetMeta['ws_marker']?.adminEmail).toBe('m@example.com');
  });
});
