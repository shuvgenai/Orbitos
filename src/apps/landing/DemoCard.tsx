import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Pill';
import { COPY, DEPARTMENTS, type Department } from './data';

type Decision = 'pending' | 'approved' | 'held';

/**
 * The demo card. The spec calls it "the memorable element": the visitor feels the "you stay
 * in control" promise by clicking the approval box, so Approve, Hold and Undo are real.
 *
 * On the spec's name for it -- "Interactive Demo Card" -- versus CLAUDE.md's "build no Card
 * component": those are different things. This is one bespoke bordered panel, not a
 * reusable Card primitive and not a card grid, and the team activity inside it is a plain
 * list. No Card component is created.
 *
 * The spec's colour notes (amber for "needs approval", green for "approved") are NOT
 * followed -- see the errata. FD-16 and PRD 15.2 allow six tokens and one red for errors
 * only, so status is carried the way the app already carries it: a word, a weight and a
 * dot, never colour alone. That is also what makes it readable to anyone who cannot
 * distinguish amber from green.
 */
export function DemoCard() {
  const [active, setActive] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const department = DEPARTMENTS[active]!;
  const decision = decisions[department.id] ?? 'pending';
  const decide = (next: Decision) =>
    setDecisions((prev) => ({ ...prev, [department.id]: next }));

  return (
    <section
      aria-label="A day in one of your offices"
      className="rounded-button border border-line bg-paper p-4 sm:p-5"
    >
      <div
        role="tablist"
        aria-label="Departments"
        aria-orientation="horizontal"
        className="mb-4 flex flex-wrap gap-1.5"
      >
        {DEPARTMENTS.map((d, i) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            id={`tab-${d.id}`}
            aria-selected={i === active}
            aria-controls={`panel-${d.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const step = e.key === 'ArrowRight' ? 1 : -1;
              const next = (active + step + DEPARTMENTS.length) % DEPARTMENTS.length;
              setActive(next);
              document.getElementById(`tab-${DEPARTMENTS[next]!.id}`)?.focus();
            }}
            className={`min-h-touch rounded-button border px-3 text-base ${
              i === active ? 'border-ink bg-ink font-medium text-paper' : 'border-line hover:bg-canvas'
            }`}
          >
            {d.tab}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${department.id}`}
        aria-labelledby={`tab-${department.id}`}
        tabIndex={0}
      >
        <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
          <p className="text-base font-semibold">{department.office}</p>
          <p className="text-base text-muted">{COPY.timestamp}</p>
        </div>

        <Activity department={department} />
        <Approval department={department} decision={decision} decide={decide} />

        <p className="mt-3 flex items-baseline justify-between gap-3 text-base text-muted">
          <span>{department.tasks}</span>
          <span className="tabular-nums">AI cost {department.cost}</span>
        </p>
      </div>
    </section>
  );
}

/** Three teammates at work. A plain list, per PRD 15.2. */
function Activity({ department }: { department: Department }) {
  const rows = [
    [COPY.teammates.coordinator, department.coordinator],
    [COPY.teammates.specialist, department.specialist],
    [COPY.teammates.frontDesk, department.frontDesk],
  ] as const;
  return (
    <ul className="mb-3">
      {rows.map(([who, what]) => (
        <li key={who} className="border-b border-line py-2 last:border-b-0">
          <span className="text-base text-muted">{who}</span>
          <span className="block text-base">{what}</span>
        </li>
      ))}
    </ul>
  );
}

/** The one item waiting for a person. Approve or hold, then undo. */
function Approval({
  department,
  decision,
  decide,
}: {
  department: Department;
  decision: Decision;
  decide: (d: Decision) => void;
}) {
  const tag =
    decision === 'approved' ? COPY.approvedTag : decision === 'held' ? COPY.heldTag : COPY.needsApproval;

  return (
    <div className="rounded-button border border-ink p-3">
      <Pill tone={decision === 'pending' ? 'warn' : 'ok'}>{tag}</Pill>
      {/* The outcome is announced, because the whole point is that the visitor changed it. */}
      <p aria-live="polite" className="mt-2 text-base">
        {decision === 'approved'
          ? department.approved
          : decision === 'held'
            ? department.held
            : department.question}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {decision === 'pending' ? (
          <>
            <Button variant="primary" approve onClick={() => decide('approved')}>
              {department.approveLabel}
            </Button>
            <Button onClick={() => decide('held')}>{COPY.hold}</Button>
          </>
        ) : (
          <Button onClick={() => decide('pending')}>{COPY.undo}</Button>
        )}
      </div>
    </div>
  );
}
