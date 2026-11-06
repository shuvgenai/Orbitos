import { useState } from 'react';
import { useApi, usePeople } from '@/shared/api/hooks';
import { useSession } from '@/shared/auth/SessionProvider';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';

/** A cross-entry link. Supplied by the entry, so no entry knows another's paths. */
export type DevLink = { label: string; href: string };

const NO_LINKS: readonly DevLink[] = Object.freeze([]);

/**
 * Development only; `import.meta.env.DEV` gates the mount, so it is not in a production
 * bundle.
 *
 * "Sign in as" is the shared spec's own development identity switch. It writes the session
 * through MockApiClient, which SessionProvider is subscribed to, so the whole entry
 * re-evaluates its guard -- including refusing the new identity if that entry does not
 * admit it. That is the fastest way to see the matrix work by hand.
 */
export function DevTools({
  links = NO_LINKS,
  extra,
  officeTools = true,
}: {
  links?: readonly DevLink[];
  /** The entry's own panel. A slot, so no entry's strings reach the other two bundles. */
  extra?: React.ReactNode;
  /**
   * Whether this entry may use the office-scoped controls -- "Sign in as", and the two seed
   * buttons.
   *
   * The operator entry may not, and these are hidden rather than left to fail: the client
   * refuses both seeds there (replacing a customer's office is not the operator's business),
   * and "Sign in as" would be empty anyway because the operator reads zero people. A button
   * that always refuses is worse than no button.
   */
  officeTools?: boolean;
}) {
  const api = useApi();
  const { profile, portal } = useSession();
  const { data: people = [] } = usePeople();
  const { notify } = useToast();
  const [simulate, setSimulate] = useState(true);

  return (
    <details className="border-t border-line bg-paper px-4 py-3 lg:px-8">
      <summary className="min-h-touch cursor-pointer text-base text-muted">
        Dev tools (hidden in production)
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {officeTools ? (
        <label className="flex items-center gap-2 text-base">
          Sign in as
          <select
            aria-label="Sign in as"
            value={profile?.id ?? ''}
            onChange={(e) => {
              void api.signInAs(e.target.value || null);
            }}
            className="min-h-touch rounded-button border border-line bg-paper px-3 text-base"
          >
            <option value="">Signed out</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.access})
              </option>
            ))}
          </select>
        </label>
        ) : null}

        {officeTools ? (
          <>
            <Button
              onClick={() => {
                void api.loadDemo().then(() => notify('Demo office loaded'));
              }}
            >
              Load demo office
            </Button>

            <Button
              onClick={() => {
                void api.resetFresh().then(() => notify('Fresh onboarding'));
              }}
            >
              Start fresh onboarding
            </Button>
          </>
        ) : null}

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

        <span className="text-base text-muted">
          This sign-in admits: {portal.allow.join(', ')}
        </span>

        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="flex min-h-touch items-center rounded-button border border-line px-4 text-base hover:bg-canvas"
          >
            {l.label}
          </a>
        ))}

        {extra}
      </div>
    </details>
  );
}
