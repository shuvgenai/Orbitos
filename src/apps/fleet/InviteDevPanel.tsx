import { useFleetInvites } from '@/shared/api/hooks';
import { INVITE_MESSAGE } from '@/shared/lib/invite';

/**
 * Every invitation issued, inside Dev tools, so the whole flow can be walked on localhost
 * while no mail service exists to carry a link (FD-32).
 *
 * It lives in the FLEET entry, not in the shared Dev tools, for two reasons. The invitations
 * are operator metadata — who the operator typed into the provision form — so reading them
 * from a customer entry would cross the boundary even in development. And the shared
 * `DevTools` must stay free of operator strings, because it ships in all three bundles.
 *
 * Dev tools is mounted behind `import.meta.env.DEV`, so none of this is in a production
 * build.
 */
export function InviteDevPanel() {
  // `state` arrives already resolved. Used-or-expired depends on a clock, and a clock read
  // inside a render is impure -- so the client, which owns an injectable clock, answers it.
  const { data: rows = [] } = useFleetInvites();
  if (!rows.length) return null;

  return (
    <div className="w-full">
      <p className="text-base font-medium">Invitations issued</p>
      <ul className="mt-1">
        {rows.map((i) => (
          <li key={i.token} className="border-t border-line py-2 text-base">
            <span className="font-medium">{i.email}</span>{' '}
            <span className="text-muted">
              — {i.state === 'valid' ? 'open' : INVITE_MESSAGE[i.state]} — issued by{' '}
              {i.issuedBy}
            </span>
            <a className="block break-all underline" href={i.url}>
              {i.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
