import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const designMd = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');

function block(source: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const m of source.matchAll(/--([a-z-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const light = block(css.slice(0, darkStart));
const dark = { ...light, ...block(css.slice(darkStart)) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test('light tokens match UX-1 exactly', () => {
  expect(light).toMatchObject({
    'color-ink': '#000000',
    'color-paper': '#ffffff',
    'color-canvas': '#f4f4f5',
    'color-muted': '#52525b',
    'color-line': '#e4e4e7',
    'radius-button': '10px',
    'border-divider': '1px',
    'font-size-body': '16px',
    'focus-ring': '3px',
  });
});

test('text colours reach 4.5:1 on paper and canvas in both themes (UX-7)', () => {
  for (const [theme, t] of [['light', light], ['dark', dark]] as const) {
    for (const fg of ['color-ink', 'color-muted', 'color-danger']) {
      for (const bg of ['color-paper', 'color-canvas']) {
        expect(contrast(t[fg]!, t[bg]!), `${theme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test('DESIGN.md documents every colour value in both themes', () => {
  for (const value of new Set([...Object.values(light), ...Object.values(dark)])) {
    if (value.startsWith('#')) expect(designMd, value).toContain(value);
  }
});

test('no shadows (UX-1)', () => {
  expect(css).not.toMatch(/shadow/i);
});
