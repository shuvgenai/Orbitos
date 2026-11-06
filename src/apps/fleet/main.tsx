import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiProvider } from '@/shared/api/provider';
import { SessionProvider } from '@/shared/auth/SessionProvider';
import { ToastProvider } from '@/shared/ui/Toast';
import '@/styles/index.css';
import { App } from './App';
import { OPERATOR_ACCOUNTS, PORTAL } from './portal';
import { INSTANCE_VERSION, PROVISION_STEPS, SAMPLE_OFFICES } from './registry';

/**
 * The operator fixtures the mock needs to answer listOffices and provisionOffice.
 *
 * Passed in rather than imported by the mock, because the mock is in all three bundles and
 * these name other customers. PRD 15.3 exempts this entry; the other two must not carry
 * them, and FD-1 is instance-per-org.
 */
const FLEET_OPTIONS = {
  sampleOffices: SAMPLE_OFFICES,
  instanceVersion: INSTANCE_VERSION,
  provisionSteps: PROVISION_STEPS,
  /**
   * Every office-facing read on this entry returns zero rows. It is the mock's stand-in for
   * Prompt 1.5 rule 3 -- "Super Admin gets no policy on `agents`, `requests` or any content
   * table" -- and the one line that makes the boundary real rather than a convention nobody
   * checks. `boundary.test.ts` fails if it is removed.
   */
  fleetSide: true,
} as const;

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <ApiProvider options={FLEET_OPTIONS}>
      <SessionProvider portal={PORTAL} accounts={OPERATOR_ACCOUNTS}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </ApiProvider>
  </StrictMode>,
);
