import { RequireAccess } from '@/shared/auth/RequireAccess';
import { AppShell } from '@/shared/layout/AppShell';
import { Placeholder } from '@/shared/layout/Placeholder';
import { useRoute } from '@/shared/layout/router';
import { FleetTable } from './FleetTable';
import { FleetDevTools } from './FleetDevTools';
import { ProvisionScreen } from './ProvisionScreen';
import { fleetNav } from './nav';

/**
 * The operator surface. PRD 15.3 exempts it: ORBIT-OS, runtime ids and adapter names are
 * correct here and nowhere else.
 *
 * PRD 15.8 is worth repeating for whoever fills the rest in: "Every Fill-now Super Admin
 * screen is mock-backed until SP-6 lands ... A finished-looking fleet console is not working
 * software, and nobody should read it as one."
 */
const SCREENS: Record<string, { title: string; body: string }> = {
  fleet: {
    title: 'Offices',
    body: 'Every customer office with its health, version, teammate count and seven-day spend.',
  },
  office: {
    title: 'Office',
    body: "One office's status, pause, overrides with a reason, settings and its operator audit. PRD 15.7 screen 2 (S-08, S-36, S-37, S-23) builds it.",
  },
  provision: {
    title: 'New office',
    body: 'Business name, domain and Org Admin, then four steps to a private instance.',
  },
};

export function App() {
  return (
    <RequireAccess>
      <Screens />
    </RequireAccess>
  );
}

function Screens() {
  const route = useRoute('fleet');
  const screen = SCREENS[route.name] ?? SCREENS['fleet']!;
  const filled = route.name === 'fleet' || route.name === 'provision';

  return (
    <AppShell
      route={route.name}
      screenTitle={screen.title}
      nav={fleetNav()}
      scopeName="All offices"
      scopeSub="Operator console"
      devExtra={<FleetDevTools />}
      // The operator has no office to sign into or reseed, and the client refuses both
      // seeds here anyway (FD-31 constraint 6).
      devOfficeTools={false}
    >
      {route.name === 'fleet' ? <FleetTable /> : null}
      {route.name === 'provision' ? <ProvisionScreen /> : null}
      {filled ? null : <Placeholder title={screen.title} body={screen.body} />}
    </AppShell>
  );
}
