// The Tailwind theme. It names the frozen design values and restates none of
// them: every entry below is a var() reference into design/tokens.css, which is
// why guards/design-naming.test.ts finds no literal colour in anything built
// from this theme.
//
// `theme` replaces Tailwind's defaults rather than extending them. That is
// deliberate. With `extend`, bg-red-500 and the rest of the default palette stay
// reachable, and the first implementer in a hurry uses one. Replacing the scale
// means a colour outside the six does not exist as a class at all.
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}', './*/index.html'],
  theme: {
    // The six, plus the two keywords section 15.1 allows.
    colors: {
      ink: 'var(--color-ink)',
      paper: 'var(--color-paper)',
      canvas: 'var(--color-canvas)',
      muted: 'var(--color-muted)',
      line: 'var(--color-line)',
      danger: 'var(--color-danger)',
      transparent: 'transparent',
      current: 'currentColor',
    },
    fontFamily: { sans: 'var(--font-sans)' },
    fontSize: { body: 'var(--font-size-body)' },
    borderRadius: { button: 'var(--radius-button)', none: '0' },
    borderWidth: { divider: 'var(--border-divider)', 0: '0' },
    outlineWidth: { focus: 'var(--focus-ring)' },
    outlineOffset: { focus: 'var(--focus-ring)' },
    // UX-3 forbids both outright, so neither has a class to reach for.
    boxShadow: { none: 'none' },
    backgroundImage: {},
    extend: {
      // The one measurement DESIGN.md gives that is not in tokens.css: the 44 px
      // minimum target. It is a size, not a colour, so it is written here once
      // instead of on every button.
      minHeight: { target: '44px' },
      minWidth: { target: '44px' },
    },
  },
  plugins: [],
} satisfies Config;
