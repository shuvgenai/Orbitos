import { useAgents, useOffice, useRequests } from '@/shared/api/hooks';
import { RequireAccess } from '@/shared/auth/RequireAccess';
import { useSession } from '@/shared/auth/SessionProvider';
import { AppShell } from '@/shared/layout/AppShell';
import { Placeholder } from '@/shared/layout/Placeholder';
import { useRoute } from '@/shared/layout/router';
import { money } from '@/shared/lib/format';
import { ScreenState } from '@/shared/ui/ScreenState';
import { StatList } from '@/shared/ui/StatList';
import { userNav } from './nav';

const SCREENS: Record<string, { title: string; body: string }> = {
  home: {
    title: 'My agents',
    body: 'Each teammate you own appears here with what it is doing right now, what it has cost today, and a way to change its instructions. Prompt 4 builds it.',
  },
  new: {
    title: 'Request an agent',
    body: 'Describe a job and your Org Admin sets it up. Your requests and their answers appear below the form. Prompt 4 builds it.',
  },
  activity: {
    title: 'Activity',
    body: 'Every action your teammates took, with the reason, how long it took and what it cost. Prompt 4 builds it.',
  },
};

export function App() {
  // The guard sits in front of every screen. Signed out, any route renders this entry's
  // login; signed in with the wrong access, a refusal. Never a redirect.
  return (
    <RequireAccess>
      <Screens />
    </RequireAccess>
  );
}

function Screens() {
  const route = useRoute('home');
  const { profile } = useSession();
  const { data: office } = useOffice();
  const { data: agents = [] } = useAgents();
  const { data: requests = [] } = useRequests();
  const screen = SCREENS[route.name] ?? SCREENS['home']!;

  // A person sees only the teammates they own. The database is the real gate once
  // Prompt 1.5's RLS half lands (FD-26); this filter is for the screen, not for security.
  const mine = agents.filter((a) => a.ownerId === profile?.id);
  const running = mine.filter((a) => a.status === 'running').length;

  return (
    <AppShell
      route={route.name}
      screenTitle={screen.title}
      nav={userNav(requests, profile?.id)}
      scopeName={office?.name ?? ''}
      scopeSub={office?.domain ?? ''}
    >
      {route.name === 'home' && office?.launched && mine.length > 0 ? (
        <>
          <p className="mb-6 text-base">
            {running} of {mine.length} agents are working for you right now.
          </p>
          <StatList
            label="Summary"
            stats={[
              { label: 'Running now', value: running, of: `of ${mine.length}` },
              {
                label: 'Waiting for approval',
                value: mine.filter((a) => a.status === 'waiting').length,
              },
              { label: 'Runs today', value: mine.reduce((t, a) => t + a.runsToday, 0) },
              { label: 'Spent today', value: money(mine.reduce((t, a) => t + a.costToday, 0)) },
            ]}
          />
        </>
      ) : null}

      {route.name === 'home' && !office?.launched ? (
        <ScreenState
          kind="empty"
          title="Your office is being set up"
          body="Your Org Admin is still hiring the team. You will see your agents here as soon as it goes live."
        />
      ) : (
        <Placeholder title={screen.title} body={screen.body} />
      )}
    </AppShell>
  );
}
