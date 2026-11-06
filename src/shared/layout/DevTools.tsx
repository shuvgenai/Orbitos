import { useState } from 'react';
import { useApi, useSession } from '@/shared/api/hooks';
import { useToast } from '@/shared/ui/Toast';
import { Button } from '@/shared/ui/Button';
import type { AccessRole, Person } from '@/shared/schemas';
import { otherEntries } from './entries';
import { navigate } from './router';

/**
 * Development only; `import.meta.env.DEV` gates the mount in AppShell, so it is not in a
 * production bundle at all.
 */
export function DevTools({ accessRole, people }: { accessRole: AccessRole; people: Person[] }) {
  const api = useApi();
  const { data: session } = useSession();
  const { notify } = useToast();
  const [simulate, setSimulate] = useState(true);
  const users = people.filter((p) => p.access === 'user');

  return (
    <details className="border-t border-line bg-paper px-4 py-3 lg:px-8">
      <summary className="min-h-touch cursor-pointer text-base text-muted">
        Dev tools (hidden in production)
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {accessRole === 'user' ? (
          <label className="flex items-center gap-2 text-base">
            Sign in as
            <select
              aria-label="Sign in as"
              value={session?.userId ?? ''}
              onChange={(e) => {
                void api.signInAs(e.target.value || null);
              }}
              className="min-h-touch rounded-button border border-line bg-paper px-3 text-base"
            >
              {users.length ? (
                users.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              ) : (
                <option value="">No users yet</option>
              )}
            </select>
          </label>
        ) : null}

        <Button
          onClick={() => {
            void api.loadDemo().then(() => notify('Demo office loaded'));
          }}
        >
          Load demo office
        </Button>

        <Button
          onClick={() => {
            void api.resetFresh().then(() => {
              notify('Fresh onboarding');
              navigate(accessRole === 'user' ? 'home' : accessRole === 'super' ? 'fleet' : 'onboarding');
            });
          }}
        >
          Start fresh onboarding
        </Button>

        <label className="flex min-h-touch items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={simulate}
            onChange={(e) => {
              setSimulate(e.target.checked);
              void api.setSimulation(e.target.checked);
            }}
          />
          Simulate live activity
        </label>

        {otherEntries(accessRole).map((e) => (
          <a
            key={e.role}
            href={e.base}
            className="flex min-h-touch items-center rounded-button border border-line px-4 text-base hover:bg-canvas"
          >
            Open {e.label}
          </a>
        ))}
      </div>
    </details>
  );
}
