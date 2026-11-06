export type Stat = { label: string; value: string | number; of?: string };

/**
 * The replacement for the prototype's KPI tiles.
 *
 * PRD 15.2 and CLAUDE.md: "Plain lists. No card grids, no KPI tiles, no template gallery. A
 * list row may carry a label and a number; it may not become a tile." Build no Card and no
 * Kpi. Every place a prompt says "tiles" renders this instead.
 */
export function StatList({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <section aria-label={label} className="mb-6 rounded-button border border-line bg-paper">
      <dl>
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex items-baseline justify-between gap-4 px-4 py-3 ${
              i > 0 ? 'border-t border-line' : ''
            }`}
          >
            <dt className="text-base text-muted">{s.label}</dt>
            <dd className="text-base font-semibold tabular-nums">
              {s.value}
              {s.of ? <span className="ml-1 font-normal text-muted">{s.of}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
