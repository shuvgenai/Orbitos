import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Login } from './Login';
import { useSession } from './SessionProvider';

/**
 * The guard in front of every screen in an entry.
 *
 * Three outcomes, and the middle one is the point of the whole prompt:
 *   - identity not resolved yet  -> nothing, briefly
 *   - signed out                 -> THIS entry's login, for any protected route
 *   - signed in, access not in portal.allow -> a refusal with a sign-out button
 *
 * REFUSE, never redirect. Prompt 1.5: "a silent redirect teaches people the other portals
 * exist and turns a URL into a role probe." So the refusal names no other entry, offers no
 * link to one, and reads the same whichever wrong portal you reached.
 */
export function RequireAccess({ children }: { children: React.ReactNode }) {
  const { profile, portal } = useSession();

  if (profile === undefined) {
    return (
      <output aria-live="polite" className="block px-4 py-10 text-base text-muted">
        Checking your sign-in...
      </output>
    );
  }

  if (profile === null) return <Login />;

  if (!portal.allow.includes(profile.access)) return <Refusal />;

  return <>{children}</>;
}

/** PRD 15.4's "not yours" state, applied to a whole entry rather than one record. */
function Refusal() {
  const { signOut, profile } = useSession();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Banner tone="error">
        <p className="font-medium">You don&apos;t have access to this sign-in</p>
        <p>
          {profile?.email} is signed in, but this sign-in is not for that account. Nothing of
          it is shown here. Ask your Org Admin if you think that is wrong.
        </p>
      </Banner>
      <div className="mt-6">
        <Button variant="primary" approve onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
