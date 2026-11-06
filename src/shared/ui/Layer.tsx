import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef } from 'react';

export type LayerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** A drawer slides from the side; a modal sits in the middle. */
  kind?: 'drawer' | 'modal';
  /** alertdialog for a confirm, so a screen reader announces it as a decision. */
  alert?: boolean;
};

/**
 * One primitive behind both Drawer and Modal.
 *
 * Radix owns the focus trap, Escape, the scroll lock and hiding the rest of the page from
 * assistive technology. The prototype did none of that: it focused the first field and
 * closed on Escape, but never trapped or restored focus (docs/plan.md 5-R4).
 *
 * Focus RESTORE is ours, deliberately. Radix returns focus to its own `Dialog.Trigger`, and
 * almost nothing in this app opens a panel from a Trigger -- a performance table row, an
 * org-chart node and a request list button all open one from state. So the opener is
 * recorded here when the panel opens and refocused when it closes, which makes the
 * guarantee the primitive's own rather than a side effect of how it was opened.
 */
export function Layer({ open, onClose, title, children, footer, kind = 'drawer', alert = false }: LayerProps) {
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);

  // Radix fires this as the panel unmounts and then moves focus itself, which is why the
  // restore has to happen here rather than in an effect: an effect runs first and Radix
  // would move focus to the body afterwards.
  const restoreFocus = (event: Event) => {
    const el = opener.current;
    opener.current = null;
    if (!el?.isConnected) return;
    event.preventDefault();
    el.focus();
  };

  const frame =
    kind === 'drawer'
      ? 'fixed right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l'
      : 'fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-button border';
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
        <Dialog.Content
          // Radix sets role="dialog" and hides the rest of the page from assistive tech,
          // but it does not set aria-modal (checked against @radix-ui/react-dialog 1.3.1),
          // so it is set here: this really is a modal dialog and screen readers should say so.
          aria-modal="true"
          onCloseAutoFocus={restoreFocus}
          {...(alert ? { role: 'alertdialog' as const } : {})}
          className={`${frame} border-line bg-paper p-6`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="min-h-touch min-w-touch rounded-button border border-line px-3"
            >
              Close
            </Dialog.Close>
          </div>
          {children}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const Drawer = (p: Omit<LayerProps, 'kind'>) => <Layer {...p} kind="drawer" />;
export const Modal = (p: Omit<LayerProps, 'kind'>) => <Layer {...p} kind="modal" />;
