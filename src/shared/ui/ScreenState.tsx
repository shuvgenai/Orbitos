import { Banner } from './Banner';
import { EmptyState } from './EmptyState';

export type ScreenStateKind =
  | 'empty'
  | 'loading'
  | 'error'
  | 'office-paused'
  | 'not-yours'
  | 'decided';

/**
 * PRD 15.4's six states, as one component, with the copy pattern the section fixes.
 *
 * The prototype supplies only the empty state: it is synchronous against localStorage, so
 * it has no loading or error path, no paused-office concept and no not-yours case
 * (docs/plan.md 4-C9). These five are therefore designed, not copied.
 *
 * "Never an error code on a customer screen" is the rule that matters most here: `error`
 * takes a plain sentence and a retry, never a status or a stack.
 */
export function ScreenState({
  kind,
  title,
  body,
  action,
  rows = 3,
}: {
  kind: ScreenStateKind;
  title?: string;
  body?: string;
  action?: React.ReactNode;
  rows?: number;
}) {
  if (kind === 'loading') {
    // Skeleton rows matching the list, not a spinner.
    return (
      <output
        aria-live="polite"
        aria-busy="true"
        className="block rounded-button border border-line bg-paper"
      >
        <span className="sr-only">Loading</span>
        {skeletonRows(rows).map((key, i) => (
          <div key={key} className={`px-4 py-4 ${i > 0 ? 'border-t border-line' : ''}`}>
            <div className="h-4 w-1/3 rounded bg-canvas" />
            <div className="mt-2 h-4 w-2/3 rounded bg-canvas" />
          </div>
        ))}
      </output>
    );
  }

  if (kind === 'error') {
    return (
      <Banner tone="error" live="alert">
        <p className="font-medium">{title ?? 'That did not work'}</p>
        <p>{body ?? 'Nothing was changed. Try again, and tell your admin if it keeps happening.'}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </Banner>
    );
  }

  if (kind === 'office-paused') {
    return (
      <Banner tone="error" live="status">
        <p className="font-medium">{title ?? 'This office is paused'}</p>
        <p>
          {body ??
            'Nothing is running and nothing will be sent. Anything waiting for approval stays waiting. Your Org Admin can start it again.'}
        </p>
      </Banner>
    );
  }

  if (kind === 'not-yours') {
    return (
      <EmptyState
        title={title ?? 'This belongs to someone else'}
        body={body ?? 'Ask your Org Admin if you need to see it. Nothing of it is shown here.'}
        action={action}
      />
    );
  }

  if (kind === 'decided') {
    return (
      <Banner tone="info" live="status">
        <p className="font-medium">{title ?? 'Already decided'}</p>
        <p>{body ?? 'Someone answered this already, so there is nothing left to do here.'}</p>
      </Banner>
    );
  }

  return <EmptyState title={title ?? 'Nothing here yet'} body={body ?? ''} action={action} />;
}

/** Stable keys for the skeleton rows, so no list is keyed by its index. */
const skeletonRows = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `skeleton-${i}`);
