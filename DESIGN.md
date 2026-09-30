# Orbitcrew Design System

This is the single design system for the Orbitcrew app and its notice emails (PRD UX-1).
The values come from the landing page tokens. `design/tokens.css` implements them, and
`design/tokens.test.ts` fails CI if the two drift apart.

## Colours

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-ink` | `#000000` | `#fafafa` | Text, primary buttons, focus ring |
| `--color-paper` | `#ffffff` | `#1c1c1f` | Surfaces: lists, text boxes, the sticky bar |
| `--color-canvas` | `#f4f4f5` | `#111113` | Page background |
| `--color-muted` | `#52525b` | `#a1a1aa` | Secondary text: "by Orbitcrew", timestamps, the cost line |
| `--color-line` | `#e4e4e7` | `#2e2e33` | 1 px dividers only; never text |
| `--color-danger` | `#b91c1c` | `#f87171` | Errors and failed sends only |

The theme follows the phone (`prefers-color-scheme`). There is no manual switch (UX-2).

## Type

- Inter (`"Inter Variable"`), falling back to the system sans-serif.
- Body text is at least 16 px. Nothing the owner must read is smaller.

## Shapes

- Buttons: 10 px radius.
- Dividers: 1 px, `--color-line`.
- No shadows, no gradients, no card grids. Plain lists (UX-3).

## Accessibility (UX-7)

- Text contrast is at least 4.5:1 on paper and canvas, in both themes (checked in CI).
- Focus ring: 3 px solid `--color-ink`, offset 3 px.
- Targets are at least 44 px; Send is 48 px. Send and Discard are at least 16 px apart.
- Every button has a text label. Status changes use `aria-live`.
- Works at 200% zoom and respects `prefers-reduced-motion`.

## Words (UX-6)

Customer-facing text says "Orbitcrew", "Orbi" and "Scout". It never says ORBIT-OS,
Paperclip, Hermes, adapters, heartbeats or tokens.
