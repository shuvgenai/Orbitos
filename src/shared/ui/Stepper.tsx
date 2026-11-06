export type Step = { n: number; title: string; blurb: string; done: boolean; locked: boolean };

export function Stepper({
  steps,
  current,
  onGo,
}: {
  steps: Step[];
  current: number;
  onGo: (n: number) => void;
}) {
  return (
    <nav aria-label="Setup steps" className="mb-6 grid gap-2 sm:grid-cols-5">
      {steps.map((s) => (
        <button
          key={s.n}
          type="button"
          onClick={() => onGo(s.n)}
          disabled={s.locked && s.n !== current}
          aria-current={s.n === current ? 'step' : undefined}
          className={`min-h-touch rounded-button border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
            s.n === current ? 'border-ink bg-canvas' : 'border-line bg-paper'
          }`}
        >
          <span className="text-base font-medium">
            {s.done ? 'Done' : s.n}. {s.title}
          </span>
          <span className="block text-base text-muted">{s.blurb}</span>
        </button>
      ))}
    </nav>
  );
}
