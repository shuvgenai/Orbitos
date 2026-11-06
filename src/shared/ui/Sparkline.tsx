/** A trend line, with the numbers also available to a screen reader. */
export function Sparkline({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const w = 70;
  const h = 22;
  const step = w / Math.max(1, data.length - 1);
  const points = data
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (h - 2 - (v / max) * (h - 4)).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">
        {label}: {data.join(', ')}
      </span>
    </>
  );
}
