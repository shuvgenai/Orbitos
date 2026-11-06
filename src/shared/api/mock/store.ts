import type { StoreState } from '@/shared/schemas';
import { STORE_KEY } from '@/shared/seeds/config';
import { demo, fresh } from '@/shared/seeds/office';

export type Source = 'user' | 'tick' | 'job' | 'remote';

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
  private state: StoreState;
  private listeners = new Set<(s: Source) => void>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.state = this.load();
    this.listen();
  }

  private load(): StoreState {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        if (parsed?.org) return parsed;
      }
    } catch {
      // A corrupt or unreadable key is replaced by a fresh office rather than crashing the
      // app on boot. PROVENANCE: store.js swallowed the same two failures.
    }
    return fresh();
  }

  private listen(): void {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(STORE_KEY);
      this.channel.addEventListener('message', () => {
        this.state = this.load();
        this.emit('remote', false);
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== STORE_KEY) return;
        this.state = this.load();
        this.emit('remote', false);
      });
    }
  }

  get(): StoreState {
    return this.state;
  }

  update(fn: (s: StoreState) => void, source: Source = 'user'): void {
    fn(this.state);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
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

  reset(kind: 'demo' | 'fresh'): void {
    this.state = kind === 'demo' ? demo() : fresh();
    this.update(() => {}, 'user');
  }

  /** PROVENANCE: store.js `audit` — newest first, capped at 40. */
  audit(who: string, what: string): void {
    this.state.audit.unshift({ at: Date.now(), who, what });
    this.state.audit = this.state.audit.slice(0, 40);
  }
}
