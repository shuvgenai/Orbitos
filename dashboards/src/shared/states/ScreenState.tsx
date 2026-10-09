// The six shared screen states of PRD section 15.4, as ONE component.
//
// All 52 screens use this. A screen that hand-rolls an empty, loading, error,
// paused, not-yours or closed state is a defect, because the shell work is only
// cheap while there is one of each (spec section 16.1).
//
// Colour, spacing and the 44 px target come from the design values via these
// class names. Nothing here states a value, so no literal colour can leak in.
// The class names are defined when the Tailwind theme lands.
import type { ReactNode } from 'react';

export type ScreenStateValue =
  | { readonly kind: 'empty'; readonly appears: string; readonly fills: string }
  | { readonly kind: 'loading'; readonly rows?: number }
  | { readonly kind: 'error'; readonly retry: () => void }
  | { readonly kind: 'paused' }
  | { readonly kind: 'notYours'; readonly owner: string; readonly ask: string }
  | { readonly kind: 'closed'; readonly because: 'expired' | 'decided'; readonly next: string };

/** Skeleton rows stand in for the list that is coming, never a spinner. */
const SKELETON_ROWS = 3;

function Empty({ appears, fills }: { appears: string; fills: string }) {
  return (
    <div className="screen-state screen-state-empty">
      <p className="screen-state-title">{appears}</p>
      <p className="screen-state-detail">{fills}</p>
    </div>
  );
}

function Loading({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="screen-state screen-state-loading" role="status">
      <span className="screen-state-reader-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <span className="screen-state-skeleton" data-skeleton-row key={i} />
      ))}
    </div>
  );
}

function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div aria-live="assertive" className="screen-state screen-state-error" role="alert">
      <p className="screen-state-title">Something went wrong at our end.</p>
      <button className="screen-state-action" onClick={retry} type="button">
        Try again
      </button>
    </div>
  );
}

function Paused() {
  return (
    <div aria-live="polite" className="screen-state screen-state-paused" role="status">
      <p className="screen-state-title">This office is paused.</p>
      <p className="screen-state-detail">Actions are off for now. Anything waiting for you stays waiting.</p>
    </div>
  );
}

function NotYours({ owner, ask }: { owner: string; ask: string }) {
  return (
    <div className="screen-state screen-state-not-yours">
      <p className="screen-state-title">This belongs to {owner}.</p>
      <p className="screen-state-detail">To see it, ask {ask}.</p>
    </div>
  );
}

function Closed({ because, next }: { because: 'expired' | 'decided'; next: string }) {
  return (
    <div className="screen-state screen-state-closed">
      <p className="screen-state-title">{because === 'expired' ? 'This expired.' : 'This was already decided.'}</p>
      <p className="screen-state-detail">{next}</p>
    </div>
  );
}

/**
 * Renders one of the six section 15.4 states, or the screen's own content when
 * `state` is null.
 *
 * A screen hands over its state and its content together and never decides for
 * itself whether the content is safe to show. That is what makes "not yours"
 * preview nothing: the rule sits here once instead of on 52 screens.
 */
export function ScreenState({ state, children }: { state: ScreenStateValue | null; children?: ReactNode }) {
  if (state === null) return <>{children}</>;
  switch (state.kind) {
    case 'empty':
      return <Empty appears={state.appears} fills={state.fills} />;
    case 'loading':
      return <Loading rows={state.rows ?? SKELETON_ROWS} />;
    case 'error':
      return <ErrorState retry={state.retry} />;
    case 'paused':
      return <Paused />;
    case 'notYours':
      return <NotYours ask={state.ask} owner={state.owner} />;
    case 'closed':
      return <Closed because={state.because} next={state.next} />;
    default: {
      // A new state added to the union fails to compile until it renders here.
      const unreachable: never = state;
      return unreachable;
    }
  }
}
