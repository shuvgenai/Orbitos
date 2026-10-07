// Pins the browser test project itself, not any component.
//
// A vitest project whose include list matches no file reports success without
// running anything, so the first real component test could be deleted and the
// suite would stay green forever. This file is the one test that cannot be
// deleted without the project going empty, and it fails if jsdom or the
// jest-dom matchers stop loading.
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

test('the browser project renders into a real DOM', () => {
  render(<p>rendered</p>);
  expect(screen.getByText('rendered')).toBeInTheDocument();
});

test('a jest-dom matcher is loaded, so a visibility assertion is real', () => {
  render(
    <>
      <span>shown</span>
      <span hidden>concealed</span>
    </>,
  );
  expect(screen.getByText('shown')).toBeVisible();
  expect(screen.getByText('concealed')).not.toBeVisible();
});
