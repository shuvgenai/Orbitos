// One route's frame: the title, then one of the six states, then nothing else.
//
// It re-implements no state. ScreenState owns all six of section 15.4, and a
// screen that hand-rolls an empty or a loading state is a defect, which
// guards/screen-states.test.ts fails the build on. This file exists so that
// using the shared component is the path of least effort on all 52 screens.
//
// The title sits outside ScreenState on purpose. A screen that is loading, or
// is not yours, still has a name, and a page whose only heading disappears
// while it loads leaves a screen reader with nothing to announce.
import type { ReactNode } from 'react';
import type { ScreenRow } from '../nav/roles';
import { ScreenState, type ScreenStateValue } from '../states/ScreenState';

type ScreenProps = {
  /** The screen's row, which carries the name the PRD gives it. */
  readonly row: ScreenRow;
  /** One of the six states, or null when the screen has its own content to show. */
  readonly state: ScreenStateValue | null;
  readonly children?: ReactNode;
};

export function Screen({ row, state, children }: ScreenProps) {
  return (
    <>
      <h1 className="text-body font-medium">{row.screen}</h1>
      {/* Content and state go in together. The screen never decides for itself
          whether its content is safe to show: that rule lives in ScreenState
          once, instead of on 52 screens. */}
      <ScreenState state={state}>{children}</ScreenState>
    </>
  );
}
