import { useAgents, useOffice, useRequests } from '@/shared/api/hooks';
import { AppShell } from '@/shared/layout/AppShell';
import { Placeholder } from '@/shared/layout/Placeholder';
import { useRoute } from '@/shared/layout/router';
import { StatList } from '@/shared/ui/StatList';
import { money } from '@/shared/lib/format';
import { needsAttention } from '@/shared/lib/validate';
import { Banner } from '@/shared/ui/Banner';
import { attentionCause } from '@/shared/lib/validate';

/**
 * Routes come from CLAUDE.md's Org Admin list, minus the Agent map: FD-19 deletes it and
 * folds what it showed into the Team tab of #/agents.
 */
const SCREENS: Record<string, { title: string; body: string }> = {
  dashboard: {
    title: 'Home',
    body: 'Before launch, a setup checklist. After launch, what needs reviewing, what is running, and what it has cost today. Prompt 3 builds it.',
  },
  onboarding: {
    title: 'Set up your office',
    body: 'Five steps: who works here, which teammates to hire, who owns each one, which tools they may use, then launch. Prompt 2 builds it.',
  },
  requests: {
    title: 'Requests',
    body: 'Agent requests from your team. Review, adjust the instructions, add guardrails, then approve. Prompt 3 builds it.',
  },
  performance: {
    title: 'Performance',
    body: 'How each teammate did over the last seven days, sortable, with the two agents that need attention called out. Prompt 3 builds it.',
  },
  structure: {
    title: 'Org structure',
    body: 'The people, departments and board your teammates report into. Prompt 2 builds it and Prompt 3 reuses it here.',
  },
  agents: {
    title: 'Agents',
    body: 'Two tabs. Team lists every teammate with its status, what it is doing, who it reports to, its owner and its cost today, filterable by person. Assignments sets who owns what. Prompt 3 builds it.',
  },
  connections: {
    title: 'Connections',
    body: 'The tools your teammates can use. Connect one, change what it may do, or disconnect it. Prompt 2 builds it and Prompt 3 reuses it here.',
  },
};

export function App() {
  const { data: office } = useOffice();
  const route = useRoute(office?.launched ? 'dashboard' : 'onboarding');
  const { data: agents = [] } = useAgents();
  const { data: requests = [] } = useRequests();
  const screen = SCREENS[route.name] ?? SCREENS['dashboard']!;

  const pending = requests.filter((r) => r.status === 'pending');
  const running = agents.filter((a) => a.status === 'running').length;
  const attention = agents.filter((a) => needsAttention(a, 'readiness'));

  return (
    <AppShell accessRole="admin" route={route.name} screenTitle={screen.title}>
      {route.name === 'dashboard' && office?.launched ? (
        <>
          <p className="mb-6 text-base">
            {running} of {agents.length} agents are running across {office.name}.
          </p>
          <StatList
            label="Summary"
            stats={[
              { label: 'Requests to review', value: pending.length },
              { label: 'Running now', value: running, of: `of ${agents.length}` },
              {
                label: 'Waiting for approval',
                value: agents.filter((a) => a.status === 'waiting').length,
              },
              { label: 'Spent today', value: money(agents.reduce((t, a) => t + a.costToday, 0)) },
            ]}
          />
          {attention.length ? (
            <div className="mb-6">
              <Banner tone="info" live="none">
                <span className="font-medium">Needs attention: </span>
                {attention
                  .map((a) => `${a.name} (${attentionCause(a, 'readiness')})`)
                  .join(', ')}
                .
              </Banner>
            </div>
          ) : null}
        </>
      ) : null}

      <Placeholder title={screen.title} body={screen.body} />
    </AppShell>
  );
}
