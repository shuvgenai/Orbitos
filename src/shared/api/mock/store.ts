import type { StoreState } from '@/shared/schemas';
import type { FleetMeta, Invite } from '@/shared/schemas/invite';
import { STORE_KEY } from '@/shared/seeds/config';
import { demo, fresh } from '@/shared/seeds/office';

export type Source = 'user' | 'tick' | 'job' | 'remote';

/** The document version. 1 was a single office; 2 is many instances. See `migrate`. */
export const DOCUMENT_VERSION = 2;

/**
 * MANY INSTANCES, ONE DOCUMENT -- and that is a simulation, not a model (FD-31).
 *
 * In production every office is its own deployment with its own database (FD-1, PRD 14.1),
 * and the fleet console never queries across them: it reads what each office sends to the
 * fleet database by the nightly numbers rollup (S-38). This document holds several offices
 * only because one browser must stand in for several deployments.
 *
 * **A later session must not read this shape as permission to build cross-office queries.**
 * The seam is what protects that: every office-facing operation on `ApiClient` acts on the
 * CURRENT instance and takes no office identifier, so nothing the frontend learns here is
 * something production cannot do. Only the fleet and invitation operations span instances.
 * `src/shared/api/seam.test.ts` asserts it.
 *
 * The split inside the document mirrors the split in production:
 *   - `instances[id]`  the office's OWN database -- its people, teammates, audit
 *   - `fleetMeta[id]`  the FLEET database's row about it -- version, health, who it is for
 *   - `invites`        top level, because an invitation exists before its office is reachable
 */
export type Document = {
  v: number;
  /** Which instance the office-facing operations read. Null when nothing is bound. */
  boundOfficeId: string | null;
  instances: Record<string, StoreState>;
  fleetMeta: Record<string, FleetMeta>;
  invites: Invite[];
  /**
   * The OPERATOR's own session, which cannot live inside an office.
   *
   * A super admin has no `org_id` and therefore no row in any office (migration 0010,
   * `super_has_no_org`), so there is no office document their session could belong to. In
   * production they sign in to the fleet console's own auth; here that is this field. It is
   * also why blocking every office-facing write on the operator surface does not lock the
   * operator out of signing in -- which it did, for one commit, until a test caught it.
   */
  operatorSession: { userId: string | null };
};

/** What a v1 document looked like: one office at the top level, plus an unused `fleet` array. */
type LegacyDocument = StoreState & { fleet?: unknown[] };

type LegacyFleetRow = {
  id?: unknown;
  name?: unknown;
  domain?: unknown;
  version?: unknown;
  health?: unknown;
  admin?: unknown;
};

const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v ? v : fallback);

/**
 * The only module in the app allowed to touch persistence. CLAUDE.md: "No direct
 * localStorage outside MockApiClient. It owns the one key, the storage event listener and
 * the live ticker." eslint.config.js enforces that with no-restricted-globals.
 *
 * Cross-tab sync uses BroadcastChannel with the storage event as a fallback, because the
 * `storage` event does not fire in the tab that wrote and fires for the whole key
 * (docs/plan.md 5-R2). Both are origin-scoped, which is why the three dashboards must stay
 * on one domain while the mock is the backend -- plan 4-E2.
 */
export class MockStore {
  private doc: Document;
  private listeners = new Set<(s: Source) => void>();
  private channel: BroadcastChannel | null = null;

  constructor(private readonly instanceVersion = '0.0.0') {
    this.doc = this.load();
    this.listen();
  }

  private load(): Document {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        const migrated = this.migrate(parsed);
        if (migrated) return migrated;
      }
    } catch {
      // A corrupt or unreadable key is replaced by a fresh office rather than crashing the
      // app on boot. PROVENANCE: store.js swallowed the same two failures.
    }
    return this.seed();
  }

  /** A brand-new document: one office, bound, exactly as v1 started. */
  private seed(): Document {
    const id = 'ws_local';
    const state = fresh();
    return {
      v: DOCUMENT_VERSION,
      boundOfficeId: id,
      instances: { [id]: state },
      fleetMeta: { [id]: this.metaFor(state, Date.now()) },
      invites: [],
      operatorSession: { userId: null },
    };
  }

  private metaFor(state: StoreState, createdAt: number): FleetMeta {
    return {
      version: this.instanceVersion,
      health: 'ok',
      // Read ONCE, at creation, from the office this code just seeded. It is not a live read
      // of the office's people: `listOffices` must never reach into an instance for a
      // person's details (FD-31 constraint 6).
      adminEmail: state.people.find((p) => p.access === 'admin')?.email ?? '',
      createdAt,
    };
  }

  /**
   * v1 -> v2, in place and without throwing. **A stale document is migrated, never
   * discarded**: FD-31 constraint 5, because a developer's localStorage holds an office they
   * have been working in, and losing it to a shape change would be our bug rather than their
   * mistake.
   *
   * Returns `null` for anything unrecognisable, which `load` turns into a fresh document --
   * the same outcome v1 gave a corrupt key, and never an exception on boot.
   */
  private migrate(parsed: unknown): Document | null {
    if (!parsed || typeof parsed !== 'object') return null;
    const any = parsed as Partial<Document> & Partial<LegacyDocument>;

    // Already current. `instances` is the discriminator rather than `v`, because a document
    // written by a later version whose shape we still understand is readable.
    if (any.instances && typeof any.instances === 'object') {
      const instances = any.instances as Record<string, StoreState>;
      const ids = Object.keys(instances);
      if (!ids.length) return null;
      const fleetMeta = (any.fleetMeta ?? {}) as Record<string, FleetMeta>;
      const now = Date.now();
      for (const id of ids) {
        // A missing meta row is filled rather than treated as a broken document: it is
        // derivable, and refusing to load would cost the developer their offices.
        fleetMeta[id] ??= this.metaFor(instances[id]!, now);
      }
      const bound = typeof any.boundOfficeId === 'string' ? any.boundOfficeId : null;
      return {
        v: DOCUMENT_VERSION,
        // A bound id that no longer resolves falls back to the first instance rather than
        // leaving the customer entries pointing at nothing.
        boundOfficeId: bound && instances[bound] ? bound : (ids[0] ?? null),
        instances,
        fleetMeta,
        invites: Array.isArray(any.invites) ? (any.invites as Invite[]) : [],
        operatorSession: { userId: any.operatorSession?.userId ?? null },
      };
    }

    // v1: one office at the top level. `org` is what v1's own loader checked for.
    if (!any.org || typeof any.org !== 'object') return null;
    const legacy = parsed as LegacyDocument;
    const now = Date.now();
    const id = 'ws_local';
    const state: StoreState = { ...legacy };
    delete (state as LegacyDocument).fleet;

    const doc: Document = {
      v: DOCUMENT_VERSION,
      boundOfficeId: id,
      instances: { [id]: state },
      fleetMeta: { [id]: this.metaFor(state, now) },
      invites: [],
      operatorSession: { userId: null },
    };

    // v1's `fleet` array held operator rows with no office behind them. There was no UI that
    // could create one, so this is almost always empty -- but if a document does carry them,
    // each becomes a REAL instance rather than being dropped, which is the honest upgrade.
    for (const row of (legacy.fleet ?? []) as LegacyFleetRow[]) {
      if (!row || typeof row !== 'object') continue;
      const rowId = str(row.id, `ws_${Object.keys(doc.instances).length}`);
      if (doc.instances[rowId]) continue;
      const seeded = fresh();
      seeded.org.name = str(row.name, 'Office');
      seeded.org.domain = str(row.domain, '');
      // No people: a v1 fleet row never had an accepted Org Admin, so the office it becomes
      // is awaiting onboarding, which is exactly what the row said.
      seeded.people = [];
      doc.instances[rowId] = seeded;
      doc.fleetMeta[rowId] = {
        version: str(row.version, this.instanceVersion),
        health: row.health === 'warn' ? 'warn' : 'ok',
        adminEmail: str(row.admin, ''),
        createdAt: now,
      };
    }

    return doc;
  }

  private listen(): void {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(STORE_KEY);
      this.channel.addEventListener('message', () => {
        this.doc = this.load();
        this.emit('remote', false);
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== STORE_KEY) return;
        this.doc = this.load();
        this.emit('remote', false);
      });
    }
  }

  /* ----------------------------------------------------------------- the document */

  document(): Document {
    return this.doc;
  }

  /**
   * The bound instance -- what every office-facing operation reads.
   *
   * Null when nothing is bound, which is a real state rather than an error: an office that
   * has been provisioned and is awaiting its Org Admin has a document, and nobody is in it.
   */
  get(): StoreState | null {
    const id = this.doc.boundOfficeId;
    return id ? (this.doc.instances[id] ?? null) : null;
  }

  boundId(): string | null {
    return this.doc.boundOfficeId;
  }

  /** Mutate the bound instance. A no-op when nothing is bound, so a caller cannot write into thin air. */
  update(fn: (s: StoreState) => void, source: Source = 'user'): void {
    const state = this.get();
    if (state) fn(state);
    this.commit(source);
  }

  /**
   * Mutate ONE NAMED INSTANCE. Fleet and invitation operations only.
   *
   * This is the operation that makes S-23 possible: an operator action writes its audit row
   * into the affected office's own audit, where that office's owner reads it -- not into a
   * fleet-level log the customer cannot see.
   */
  updateInstance(id: string, fn: (s: StoreState) => void, source: Source = 'user'): boolean {
    const state = this.doc.instances[id];
    if (!state) return false;
    fn(state);
    this.commit(source);
    return true;
  }

  /** Mutate the document itself: add an instance, issue an invitation, change the binding. */
  updateDocument(fn: (d: Document) => void, source: Source = 'user'): void {
    fn(this.doc);
    this.commit(source);
  }

  private commit(source: Source): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.doc));
    } catch {
      // Quota or a private-mode refusal. The in-memory state is still correct; the screen
      // keeps working and the next tab simply does not see it.
    }
    this.emit(source, true);
  }

  private emit(source: Source, broadcast: boolean): void {
    if (broadcast) this.channel?.postMessage(Date.now());
    for (const l of this.listeners) l(source);
  }

  subscribe(listener: (s: Source) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dev tools' "Load demo office" / "Start fresh onboarding".
   *
   * Replaces THE BOUND INSTANCE ONLY. In v1 this replaced the whole document, which silently
   * deleted every office the operator had provisioned -- demonstrated before the fix, and now
   * asserted against in `instances.test.ts`. Other offices, their invitations and the fleet
   * metadata all survive.
   */
  reset(kind: 'demo' | 'fresh'): void {
    const id = this.doc.boundOfficeId;
    const state = kind === 'demo' ? demo() : fresh();
    this.updateDocument((d) => {
      const target = id ?? 'ws_local';
      d.instances[target] = state;
      d.fleetMeta[target] ??= this.metaFor(state, Date.now());
      d.boundOfficeId = target;
    });
  }

  /** PROVENANCE: store.js `audit` -- newest first, capped at 40. */
  audit(who: string, what: string): void {
    const state = this.get();
    if (state) this.auditIn(state, who, what);
  }

  /** The same rule, applied to a named instance. Used by the operator path for S-23. */
  auditIn(state: StoreState, who: string, what: string): void {
    state.audit.unshift({ at: Date.now(), who, what });
    state.audit = state.audit.slice(0, 40);
  }
}
