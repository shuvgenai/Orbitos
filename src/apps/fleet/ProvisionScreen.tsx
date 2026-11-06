import { useState } from 'react';
import { useApi, useWrite } from '@/shared/api/hooks';
import { useSession } from '@/shared/auth/SessionProvider';
import { provisionInputSchema, type ProvisionInput } from '@/shared/schemas/provision';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Stepper } from '@/shared/ui/Stepper';
import { navigate } from '@/shared/layout/router';
import { InviteLink } from './InviteLink';
import { PROVISION_STEPS } from './registry';

/**
 * S-01: set up a new office.
 *
 * **NOT S-02.** The setup tracker -- "each new customer's step and where it is stuck" --
 * needs state that outlives this form and a list of customers mid-setup. What is below is a
 * progress display for one run, and calling it S-02 would overclaim.
 *
 * Field list and button labels are the Build Prompts' own (L109, L276): business name,
 * domain, Org Admin email, Zod-validated, then a four-step progress and a success state with
 * "View offices" and "Provision another". `adminName` is the one addition -- see FD-32.
 */
type Done = { officeId: string; token: string; url: string; name: string; email: string };

const EMPTY: ProvisionInput = { name: '', domain: '', email: '', adminName: '' };

export function ProvisionScreen() {
  const api = useApi();
  const { profile } = useSession();
  const [form, setForm] = useState<ProvisionInput>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Done | null>(null);

  const create = useWrite(async (input: ProvisionInput) => {
    // The operator's name travels as DATA. The mock ships in all three bundles, so a client
    // that knew the operator's title would put it in the customer ones.
    const result = await api.provisionOffice(input, profile?.name ?? 'Operator');
    if (result.ok) {
      setDone({ ...result.value, name: input.name.trim(), email: input.email.trim() });
    }
    return result;
  });

  if (done) return <Created done={done} onAnother={() => { setDone(null); setForm(EMPTY); setStep(0); }} />;

  const submit = () => {
    const parsed = provisionInputSchema.safeParse(form);
    if (!parsed.success) {
      // Zod is the one source of these sentences; the mock re-checks the same schema, so a
      // screen cannot be more permissive than the client it talks to.
      setProblems(parsed.error.issues.map((i) => i.message));
      return;
    }
    setProblems([]);
    setStep(0);
    const steps = window.setInterval(
      () => setStep((n) => Math.min(n + 1, PROVISION_STEPS.length)),
      650,
    );
    void create.mutateAsync(parsed.data).then((r) => {
      window.clearInterval(steps);
      if (!r.ok) setProblems(r.problems);
    });
  };

  const busy = create.isPending;

  return (
    <>
      {problems.length ? (
        <Banner tone="error">
          <p className="font-medium">This office was not created</p>
          <ul className="list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <div className="max-w-xl">
        <Field
          label="Business name"
          required
          value={form.name}
          onChange={(name) => setForm({ ...form, name })}
          placeholder="Acme Ltd"
        />
        <Field
          label="Office domain"
          required
          help="The address this customer's office is served at."
          value={form.domain}
          onChange={(domain) => setForm({ ...form, domain })}
          placeholder="office.acme.com"
        />
        <Field
          label="Org Admin name"
          required
          value={form.adminName}
          onChange={(adminName) => setForm({ ...form, adminName })}
          placeholder="Ada Okonkwo"
        />
        <Field
          label="Org Admin email"
          required
          type="email"
          help="Their invitation is issued to this address. It works once and expires in 7 days."
          value={form.email}
          onChange={(email) => setForm({ ...form, email })}
          placeholder="ada@acme.com"
        />
        <Button variant="primary" approve onClick={submit} disabled={busy}>
          {busy ? 'Creating the office...' : 'Create office and invite the Org Admin'}
        </Button>
      </div>

      {busy ? (
        <div className="mt-8">
          <Stepper
            steps={PROVISION_STEPS.map(([, title], i) => ({
              n: i + 1,
              title,
              blurb: '',
              done: i < step,
              locked: i > step,
            }))}
            current={step + 1}
            // Read-only while the run is in progress: the steps report where it is, they are
            // not navigation.
            onGo={() => {}}
          />
          <p className="mt-2 text-base text-muted">
            The office and its invitation are recorded first, so nothing is lost if this page
            is closed while the steps run.
          </p>
        </div>
      ) : null}
    </>
  );
}

function Created({ done, onAnother }: { done: Done; onAnother: () => void }) {
  return (
    <>
      <Banner tone="success">
        <p className="font-medium">{done.name} is created and awaiting onboarding</p>
        <p>
          It is in the fleet table now. {done.email} has an invitation that works once and
          expires in 7 days.
        </p>
      </Banner>
      <InviteLink url={done.url} email={done.email} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => navigate('fleet')}>
          View offices
        </Button>
        <Button onClick={onAnother}>Provision another</Button>
      </div>
    </>
  );
}
