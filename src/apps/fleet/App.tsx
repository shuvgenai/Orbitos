import { useFleetOffices } from '@/shared/api/hooks';
import { AppShell } from '@/shared/layout/AppShell';
import { Placeholder } from '@/shared/layout/Placeholder';
import { useRoute } from '@/shared/layout/router';
import { StatList } from '@/shared/ui/StatList';
import { Table } from '@/shared/ui/Table';
import { Pill } from '@/shared/ui/Pill';
import { money } from '@/shared/lib/format';
import { FLEET_STATUS_LABELS, type FleetOffice } from '@/shared/schemas/fleet';
import { navigate } from '@/shared/layout/router';

/**
 * The operator surface. PRD 15.3 exempts it: ORBIT-OS, runtime ids and adapter names are
 * correct here and nowhere else.
 *
 * PRD 15.8 is worth repeating for whoever fills these in: "Every Fill-now Super Admin screen
 * is mock-backed until SP-6 lands ... A finished-looking fleet console is not working
 * software, and nobody should read it as one."
 */
const SCREENS: Record<string, { title: string; body: string }> = {
  fleet: {
    title: 'Offices',
    body: 'Every customer office with its health, version, teammate count and seven-day spend. Prompt 5 builds it.',
  },
  office: {
    title: 'Office',
    body: 'One office, with a runtime id, profile and adapter per teammate. This is the only screen that shows those. Prompt 5 builds it.',
  },
  provision: {
    title: 'New office',
    body: 'Business name, domain and Org Admin email, then four steps to a private instance. Prompt 5 builds it.',
  },
};

export function App() {
  const route = useRoute('fleet');
  const { data: offices = [] } = useFleetOffices();
  const screen = SCREENS[route.name] ?? SCREENS['fleet']!;
  const live = offices.filter((o) => o.status === 'live').length;

  return (
    <AppShell accessRole="super" route={route.name} screenTitle={screen.title}>
      {route.name === 'fleet' ? (
        <>
          <StatList
            label="Fleet summary"
            stats={[
              { label: 'Offices', value: offices.length },
              { label: 'Live', value: live },
              { label: 'Agents', value: offices.reduce((t, o) => t + o.agents, 0) },
              { label: 'Spend (7 days)', value: money(offices.reduce((t, o) => t + o.cost, 0)) },
            ]}
          />
          <Table<FleetOffice>
            caption="Every customer office"
            rows={offices}
            onRowActivate={(o) => navigate('office', o.id)}
            rowLabel={(o) => `${o.name}, ${FLEET_STATUS_LABELS[o.status]}`}
            rowKey={(o) => o.id}
            columns={[
              {
                key: 'name',
                header: 'Office',
                render: (o) => (
                  <>
                    <span className="font-medium">{o.name}</span>
                    <span className="block text-muted">{o.domain}</span>
                  </>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (o) => <Pill tone={o.status === 'live' ? 'ok' : 'warn'}>{FLEET_STATUS_LABELS[o.status]}</Pill>,
              },
              { key: 'agents', header: 'Agents', align: 'right', render: (o) => o.agents },
              {
                key: 'cost',
                header: 'Spend (7 days)',
                align: 'right',
                render: (o) => money(o.cost),
              },
              { key: 'version', header: 'Version', render: (o) => o.version },
              {
                key: 'health',
                header: 'Health',
                render: (o) => (
                  <Pill tone={o.health === 'ok' ? 'ok' : 'err'}>
                    {o.health === 'ok' ? 'Healthy' : 'Check'}
                  </Pill>
                ),
              },
            ]}
          />
          <p className="mt-6 text-base text-muted">
            These numbers come from the mock. They are not operational data until the nightly
            rollup and the backup and incident records exist (PRD 15.8).
          </p>
        </>
      ) : (
        <Placeholder title={screen.title} body={screen.body} />
      )}
    </AppShell>
  );
}
