import { useState } from 'react';
import { z } from 'zod';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { useSession } from './SessionProvider';

/**
 * ONE generic failure message, for every cause.
 *
 * Prompt 1.5: "A portal that says 'this is an Org Admin account, use the other link' hands
 * an attacker a role oracle over an email list." So a wrong password, an unknown address and
 * a correct password at the wrong portal all produce this exact string. It is exported so a
 * test can assert it is byte-identical across all three entries rather than merely similar.
 */
export const SIGN_IN_FAILURE = "Those details don't match an account for this sign-in.";

const formSchema = z.object({
  email: z.string().min(1, 'Enter your email address.').regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

/**
 * The single Login screen, shared by all three entries. The only thing that differs between
 * them is the copy the Portal supplies -- there is one component, not three.
 *
 * Design tokens only, no literal colour. The primary button is 48px per PRD 15.2's Approve
 * rule, which is the heaviest commit on this screen.
 */
export function Login() {
  const { signIn, portal } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const parsed = formSchema.safeParse({ email, password });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      setFieldErrors({
        email: issues.find((i) => i.path[0] === 'email')?.message,
        password: issues.find((i) => i.path[0] === 'password')?.message,
      });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    const ok = await signIn(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-base font-semibold">{portal.title}</h1>
      <h2 className="mt-6 text-base font-semibold">{portal.heading}</h2>
      <p className="mt-1 text-base text-muted">{portal.sub}</p>

      <form onSubmit={submit} noValidate className="mt-6">
        {/* aria-live lives on the banner, so the failure is announced without moving focus. */}
        <div aria-live="polite" className="mb-4 empty:mb-0">
          {failed ? <Banner tone="error">{SIGN_IN_FAILURE}</Banner> : null}
        </div>

        <Field
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="username"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
        />

        <Button type="submit" variant="primary" approve disabled={busy} className="w-full">
          {busy ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-base text-muted">
        No password yet? Your Org Admin sends an invitation when the office goes live.
      </p>
    </main>
  );
}
