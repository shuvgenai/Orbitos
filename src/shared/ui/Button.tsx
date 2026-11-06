import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Approve is 48px per PRD 15.2; everything else is at least 44px. */
  approve?: boolean;
  children: ReactNode;
};

// PRD 15.2: at least 44px, Approve at least 48px. Enforced HERE, not per use, because the
// prototype left 15 of 26 targets under 44px at 375px (docs/plan.md 5-R3).
const base =
  'inline-flex items-center justify-center gap-2 rounded-button border px-4 text-base ' +
  'font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper border-ink hover:bg-ink/90',
  ghost: 'bg-paper text-ink border-line hover:bg-canvas',
  danger: 'bg-paper text-danger border-danger hover:bg-danger hover:text-paper',
};

export function Button({
  variant = 'ghost',
  approve = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const size = approve ? 'min-h-approve' : 'min-h-touch';
  return (
    <button type={type} className={`${base} ${variants[variant]} ${size} min-w-touch ${className}`} {...rest}>
      {children}
    </button>
  );
}
