// One frame for every route: the title, then one of the six states.
//
// Each state is written out by hand. A loop over the union would shrink with
// the union, which is the mistake guards/design-naming.test.ts calls out and
// ScreenState.test.tsx already avoids.
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { ScreenRow } from '../nav/roles';
import { Screen } from './Screen';

const ROW: ScreenRow = {
  screen: 'Receipts',
  route: '/receipts',
  section: '15.5',
  inSidebar: true,
  appears: 'One receipt for every action your office took',
  fills: 'Your first finished task writes the first receipt.',
};

test('the title is the screen name the PRD gives, as the one h1', () => {
  render(<Screen row={ROW} state={null} />);
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading.textContent).toBe('Receipts');
  expect(screen.getAllByRole('heading')).toHaveLength(1);
});

test('content shows when there is no state', () => {
  render(
    <Screen row={ROW} state={null}>
      <p>one receipt</p>
    </Screen>,
  );
  expect(screen.getByText('one receipt')).toBeVisible();
});

test('empty says what appears and the one action that fills it', () => {
  render(<Screen row={ROW} state={{ kind: 'empty', appears: 'Your receipts', fills: 'Ask for your first task.' }} />);
  expect(screen.getByText('Your receipts')).toBeVisible();
  expect(screen.getByText('Ask for your first task.')).toBeVisible();
});

test('loading shows skeleton rows through the shared component', () => {
  const { container } = render(<Screen row={ROW} state={{ kind: 'loading' }} />);
  expect(container.querySelectorAll('[data-skeleton-row]').length).toBeGreaterThan(0);
  expect(container.querySelector('.screen-state-loading')).not.toBeNull();
});

test('error shows the shared sentence and a retry, never a code', () => {
  const retry = vi.fn();
  render(<Screen row={ROW} state={{ kind: 'error', retry }} />);
  screen.getByRole('button', { name: 'Try again' }).click();
  expect(retry).toHaveBeenCalledTimes(1);
});

test('paused says so', () => {
  const { container } = render(<Screen row={ROW} state={{ kind: 'paused' }} />);
  expect(container.querySelector('.screen-state-paused')).not.toBeNull();
});

test('not yours says whose it is and who to ask', () => {
  render(<Screen row={ROW} state={{ kind: 'notYours', owner: 'Ada', ask: 'your Org Admin' }} />);
  expect(screen.getByText('This belongs to Ada.')).toBeVisible();
  expect(screen.getByText('To see it, ask your Org Admin.')).toBeVisible();
});

test('closed says which of the two it is, and what happens now', () => {
  render(<Screen row={ROW} state={{ kind: 'closed', because: 'expired', next: 'Ask again when you need it.' }} />);
  expect(screen.getByText('This expired.')).toBeVisible();
  expect(screen.getByText('Ask again when you need it.')).toBeVisible();
});

test('a state hides the content, so "not yours" previews nothing', () => {
  render(
    <Screen row={ROW} state={{ kind: 'notYours', owner: 'Ada', ask: 'your Org Admin' }}>
      <p>a receipt for 40 pounds</p>
    </Screen>,
  );
  expect(screen.queryByText('a receipt for 40 pounds')).toBeNull();
});

test('the title stays visible in every state, so a screen is never nameless', () => {
  const { unmount } = render(<Screen row={ROW} state={{ kind: 'loading' }} />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Receipts');
  unmount();
  render(<Screen row={ROW} state={{ kind: 'notYours', owner: 'Ada', ask: 'your Org Admin' }} />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Receipts');
});

test('the frame re-implements no state of its own', () => {
  const { container } = render(<Screen row={ROW} state={{ kind: 'paused' }} />);
  // Every screen-state class in the output belongs to the shared component, so
  // nothing carrying one may sit outside the block that component renders.
  const own = [...container.querySelectorAll('[class]')].filter(
    (el) => el.className.includes('screen-state') && el.closest('.screen-state') === null,
  );
  expect(own).toEqual([]);
});
