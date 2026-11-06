/**
 * A real `<progress>` element rather than a div with role="progressbar".
 *
 * The native element carries the role, the value and the announcement for free, which is
 * what PRD 15.2's "status changes announced" row asks for. Its appearance is reset in
 * src/styles/index.css so it still reads as one line and one rule, per DESIGN.md.
 */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-3">
      <progress value={pct} max={100} aria-label={label} className="orbit-progress h-2 flex-1">
        {pct}%
      </progress>
      <b className="text-base tabular-nums">{pct}%</b>
    </div>
  );
}
