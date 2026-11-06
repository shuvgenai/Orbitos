export type ChipProps = {
  pressed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
};

/** A toggle. aria-pressed is the state; it is a real button so the keyboard reaches it. */
export function Chip({ pressed, onToggle, disabled = false, title, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={`min-h-touch rounded-button border px-3 text-base disabled:cursor-not-allowed disabled:opacity-50 ${
        pressed ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:bg-canvas'
      }`}
    >
      {children}
    </button>
  );
}
