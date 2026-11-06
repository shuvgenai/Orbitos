import { useApi, useFleetOffices, useWrite } from '@/shared/api/hooks';
import { InviteDevPanel } from './InviteDevPanel';
import { SAMPLE_OFFICES } from './registry';

/**
 * The fixture rows, which have no office document behind them and so cannot be bound to.
 * Identified from the fixture list this entry already owns rather than by guessing at id
 * prefixes -- see FD-33 on why fixture rows cannot be acted on at all.
 */
const FIXTURE_IDS = new Set(SAMPLE_OFFICES.map((o) => o.id));

/**
 * The operator entry's own Dev tools. DEV ONLY -- `AppShell` mounts Dev tools behind
 * `import.meta.env.DEV`.
 *
 * It lives in the fleet entry rather than in the shared `DevTools`, which ships in all three
 * bundles and must stay free of any one entry's strings.
 */
export function FleetDevTools() {
  return (
    <>
      <OfficeBinding />
      <InviteDevPanel />
    </>
  );
}

/**
 * Which office the CUSTOMER entries read -- `bindOffice`, given a control.
 *
 * Without it the second office provisioned is a one-way door: accepting an invitation binds
 * the invitee's office, and sign-in only resolves people in the bound office, so the
 * previous office's Org Admin can no longer sign in at `/login` and the only way back is
 * clearing storage.
 *
 * **It is not a production operation and `SupabaseApiClient` will refuse it.** In production
 * "which office am I in" is settled by which deployment's URL you opened (FD-1,
 * instance-per-org); there is nothing to select. It is listed as an explicit exemption in
 * `src/shared/api/seam.test.ts` rather than left to look like an ordinary operation.
 */
function OfficeBinding() {
  const api = useApi();
  const { data: offices = [] } = useFleetOffices();
  const bind = useWrite((id: string) => api.bindOffice(id));

  // The client refuses a fixture row; it is left out rather than offered and then rejected.
  const bindable = offices.filter((o) => !FIXTURE_IDS.has(o.id));

  return (
    // flex-wrap and min-w-0: without them the trailing hint pushed the row past a 375px
    // viewport by 4px, which e2e/provision.spec.ts caught and jsdom could not.
    <label className="flex w-full flex-wrap items-center gap-2 text-base">
      Customer entries read
      <select
        aria-label="Customer entries read"
        onChange={(e) => {
          if (e.target.value) bind.mutate(e.target.value);
        }}
        className="min-h-touch rounded-button border border-line bg-paper px-3 text-base"
      >
        <option value="">Choose an office...</option>
        {bindable.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <span className="min-w-0 text-muted">
        Switches which office /user and /orgadmin open. Dev only.
      </span>
    </label>
  );
}
