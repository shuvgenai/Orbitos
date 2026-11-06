import { useEffect, useState } from 'react';
import { useApi } from '@/shared/api/hooks';
import type { InvitePreview } from '@/shared/schemas/invite';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { ScreenState } from '@/shared/ui/ScreenState';
import { navigate } from '@/shared/layout/router';

/**
 * PRD A-04, redeemed: the invited Org Admin chooses a password and lands in their office.
 *
 * **RENDERED OUTSIDE `RequireAccess`, and that is the whole point.** The invitee is signed
 * out by definition — they have no account yet — so a guard in front of this screen would
 * show them a sign-in form for an office they cannot yet sign in to.
 *
 * **NOTHING HERE IS ENFORCEMENT.** The password is checked for shape and discarded: there is
 * no credential store in this stack. Prompt 1.5 items 1 to 3 — Supabase, the schema and the
 * RLS path — replace all of it (FD-26, FD-32). docs/auth.md says the same in the same words,
 * and the screen says it to the reader below rather than only in this comment.
 */
export function AcceptInvite({ token }: { token: string }) {
  const api = useApi();
  const [invite, setInvite] = useState<InvitePreview | null | undefined>(undefined);
  const [refusal, setRefusal] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void api.getInvite(token).then((r) => {
      if (!live) return;
      if (r.ok) setInvite(r.value);
      else {
        setInvite(null);
        setRefusal(r.problems);
      }
    });
    return () => {
      live = false;
    };
  }, [api, token]);

  if (invite === undefined) return <Centred>{<ScreenState kind="loading" rows={2} />}</Centred>;

  // "This invitation has already been used." / "This invitation has expired." / not valid.
  // One sentence, no status code, and no hint whether the token ever existed.
  if (invite === null) {
    return (
      <Centred>
        <Banner tone="error">
          <p className="font-medium">{refusal[0] ?? 'This invitation link is not valid.'}</p>
          <p>Ask whoever set your office up to send you a new invitation.</p>
        </Banner>
      </Centred>
    );
  }

  const submit = () => {
    setBusy(true);
    void api.acceptInvite(token, password).then((r) => {
      setBusy(false);
      if (!r.ok) {
        setProblems(r.problems);
        return;
      }
      // Signed in and bound to their own office. The hash changes; the entry re-evaluates
      // its guard and lands them on onboarding, which is where an unlaunched office opens.
      setPassword('');
      navigate('onboarding');
    });
  };

  return (
    <Centred>
      <h1 className="text-2xl font-semibold">Set up your OrbitCrew office</h1>
      <p className="mt-2 text-base">
        Hello {invite.name}. You have been named the Org Admin for{' '}
        <span className="font-medium">{invite.officeName}</span>. Choose a password to begin.
      </p>

      {problems.length ? (
        <div className="mt-6">
          <Banner tone="error">
            <ul className="list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Banner>
        </div>
      ) : null}

      <div className="mt-6">
        <Field
          label="Choose a password"
          required
          type="password"
          autoComplete="new-password"
          help="At least 8 characters."
          value={password}
          onChange={setPassword}
        />
        <Button variant="primary" approve onClick={submit} disabled={busy}>
          {busy ? 'Setting up...' : 'Set password and continue'}
        </Button>
      </div>

      <p className="mt-6 text-base text-muted">
        This is a development build. Your password is checked for length and then discarded —
        no sign-in is protected by it yet. See docs/auth.md.
      </p>
    </Centred>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      {children}
    </main>
  );
}
