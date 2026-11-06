import { useFleetOffices } from '@/shared/api/hooks';
import { money } from '@/shared/lib/format';
import { navigate } from '@/shared/layout/router';
import { FLEET_STATUS_LABELS, type FleetOffice } from '@/shared/schemas/fleet';
import { Pill } from '@/shared/ui/Pill';
import { StatList } from '@/shared/ui/StatList';
import { Table } from '@/shared/ui/Table';
import { ScreenState } from '@/shared/ui/ScreenState';

/**
 * S-10, the fleet table. Extracted from App.tsx when the provision screen landed, so both
 * stay inside CLAUDE.md's 150-line rule.
 *
 * Every number here is a COUNT rolled up from an office, which is all the operator is
 * entitled to (PRD 7.1, Prompt 1.5 rule 3). Nothing on this screen reads an office's
 * teammates, people, requests or receipts; `boundary.test.ts` asserts it cannot.
 */
export function FleetTable() {
  const { data: offices, isPending, isError } = useFleetOffices();

  if (isPending) return <ScreenState kind="loading" rows={4} />;
  if (isError || !offices) {
    return (
      <ScreenState
        kind="error"
        title="The fleet list could not be read"
        body="The office records are stored in this browser and could not be opened. Reload the page to try again."
      />
    );
  }

  const live = offices.filter((o) => o.status === 'live').length;

  return (
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
            render: (o) => (
              <Pill tone={o.status === 'live' ? 'ok' : 'warn'}>
                {FLEET_STATUS_LABELS[o.status]}
              </Pill>
            ),
          },
          { key: 'agents', header: 'Agents', align: 'right', render: (o) => o.agents },
          { key: 'cost', header: 'Spend (7 days)', align: 'right', render: (o) => money(o.cost) },
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
  );
}
