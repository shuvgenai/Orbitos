import type { Config } from 'tailwindcss';

// FD-16 / PRD 15.1: the frozen design/ package is the only source of tokens, and
// design/tokens.test.ts proves tokens.css and DESIGN.md agree. This file POINTS at those CSS
// variables and restates none of their values.
//
// `colors` is REPLACED, not extended. That is deliberate: with the default palette gone,
// `bg-blue-500`, `text-slate-700` and every other stock colour class simply fails to
// compile, which enforces PRD 15.2's "black and white, one red, no second accent" at build
// time instead of by code review. `boxShadow` and `dropShadow` are emptied for the same
// reason -- DESIGN.md says no shadows, so `shadow-md` must not exist.
export default {
  content: ['./dashboards/**/*.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      ink: 'var(--color-ink)',
      paper: 'var(--color-paper)',
      canvas: 'var(--color-canvas)',
      muted: 'var(--color-muted)',
      line: 'var(--color-line)',
      danger: 'var(--color-danger)',
    },
    boxShadow: { none: 'none' },
    dropShadow: { none: '0 0 #0000' },
    extend: {
      // 860px is the breakpoint Prompt 1 item 8 names for the nav, and the founder's
      // instruction of 2026-11-06 for the root page's two columns. Tailwind's `lg` is
      // 1024, which is not the same thing and was being used by mistake.
      screens: { shell: '860px' },
      fontFamily: { sans: 'var(--font-sans)' },
      fontSize: { base: 'var(--font-size-body)' },
      borderRadius: { button: 'var(--radius-button)' },
      outlineWidth: { focus: 'var(--focus-ring)' },
      minHeight: { touch: '44px', approve: '48px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
} satisfies Config;
