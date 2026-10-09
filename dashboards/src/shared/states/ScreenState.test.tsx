// The six PRD section 15.4 states, pinned one at a time.
//
// All 52 screens render these through this one component, so a defect here is a
// defect on every screen. Each state gets its own test, written out by hand, so
// deleting a state from the union shrinks the component and not the test.
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ScreenState } from './ScreenState';

const EMPTY = { kind: 'empty', appears: 'Your receipts', fills: 'Ask for your first task.' } as const;

test('empty says what will appear and the one action that fills it', () => {
  render(<ScreenState state={EMPTY} />);
  expect(screen.getByText('Your receipts')).toBeVisible();
  expect(screen.getByText('Ask for your first task.')).toBeVisible();
});

test('empty shows no illustration, because section 15.4 forbids one', () => {
  const { container } = render(<ScreenState state={EMPTY} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('svg')).toBeNull();
});

test('loading shows skeleton rows matching the list, and never a spinner', () => {
  const { container } = render(<ScreenState state={{ kind: 'loading', rows: 4 }} />);
  expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(4);
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
});

test('loading tells a screen reader it is busy', () => {
  render(<ScreenState state={{ kind: 'loading' }} />);
  const status = screen.getByRole('status');
  expect(status).toHaveAttribute('aria-busy', 'true');
  expect(status).toHaveAttribute('aria-live', 'polite');
});

test('error offers a retry that runs, and is keyboard reachable', () => {
  const retry = vi.fn();
  render(<ScreenState state={{ kind: 'error', retry }} />);
  const button = screen.getByRole('button', { name: 'Try again' });
  button.focus();
  expect(button).toHaveFocus();
  button.click();
  expect(retry).toHaveBeenCalledOnce();
});

test('error is announced, and carries no error code', () => {
  render(<ScreenState state={{ kind: 'error', retry: () => {} }} />);
  const alert = screen.getByRole('alert');
  expect(alert).toHaveAttribute('aria-live', 'assertive');
  expect(alert.textContent ?? '').not.toMatch(/\d/);
});

test('office paused says actions are off and waiting items stay waiting', () => {
  render(<ScreenState state={{ kind: 'paused' }} />);
  const banner = screen.getByRole('status');
  expect(banner.textContent ?? '').toContain('paused');
  expect(banner.textContent ?? '').toContain('waiting');
});

test('not yours says whose it is and who to ask', () => {
  render(<ScreenState state={{ kind: 'notYours', owner: 'Dana', ask: 'your office admin' }} />);
  expect(screen.getByText(/Dana/)).toBeVisible();
  expect(screen.getByText(/your office admin/)).toBeVisible();
});

test('not yours previews no content, even when children are passed', () => {
  render(
    <ScreenState state={{ kind: 'notYours', owner: 'Dana', ask: 'your office admin' }}>
      <p>secret body</p>
    </ScreenState>,
  );
  expect(screen.queryByText('secret body')).toBeNull();
});

test('expired says it expired and what happens now', () => {
  render(<ScreenState state={{ kind: 'closed', because: 'expired', next: 'Ask for it again.' }} />);
  expect(screen.getByText(/expired/)).toBeVisible();
  expect(screen.getByText('Ask for it again.')).toBeVisible();
});

test('already decided says it was decided, not that it expired', () => {
  render(<ScreenState state={{ kind: 'closed', because: 'decided', next: 'Nothing to do.' }} />);
  expect(screen.getByText(/already decided/)).toBeVisible();
  expect(screen.queryByText(/expired/)).toBeNull();
});

// Design rule 7: plain language. One probe per state, so a new state cannot skip it.
test('no state writes an em dash or an exclamation mark', () => {
  const states = [
    EMPTY,
    { kind: 'loading' },
    { kind: 'error', retry: () => {} },
    { kind: 'paused' },
    { kind: 'notYours', owner: 'Dana', ask: 'your office admin' },
    { kind: 'closed', because: 'expired', next: 'Ask for it again.' },
    { kind: 'closed', because: 'decided', next: 'Nothing to do.' },
  ] as const;
  for (const state of states) {
    const { container, unmount } = render(<ScreenState state={state} />);
    expect(container.textContent ?? '', state.kind).not.toMatch(/[—–!]/);
    unmount();
  }
});

// The seam the 52 screens use: a screen hands over its state, or null, and never
// decides for itself whether content is safe to show.
test('content renders only when no state is showing', () => {
  render(
    <ScreenState state={null}>
      <p>real body</p>
    </ScreenState>,
  );
  expect(screen.getByText('real body')).toBeVisible();
});
