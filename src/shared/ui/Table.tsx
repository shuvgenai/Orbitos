export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
};

export type Sort = { key: string; dir: 1 | -1 };

export function Table<T>({
  rows,
  columns,
  sort,
  onSort,
  onRowActivate,
  rowLabel,
  rowKey,
  caption,
  footer,
}: {
  rows: T[];
  columns: Column<T>[];
  sort?: Sort;
  onSort?: (key: string) => void;
  onRowActivate?: (row: T) => void;
  rowLabel?: (row: T) => string;
  /** A stable identity per row. Without it a re-sort would reuse the wrong DOM node. */
  rowKey: (row: T) => string;
  caption: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-button border border-line bg-paper">
      <table className="w-full border-collapse text-base">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active
                ? sort.dir > 0
                  ? 'ascending'
                  : 'descending'
                : c.sortable
                  ? 'none'
                  : undefined;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`border-b border-line px-4 py-3 font-medium ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      className="min-h-touch font-medium underline-offset-4 hover:underline"
                    >
                      {c.header}
                      {active ? (sort.dir > 0 ? ' (ascending)' : ' (descending)') : ''}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              row={row}
              columns={columns}
              onRowActivate={onRowActivate}
              rowLabel={rowLabel}
            />
          ))}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}

/** A row is activatable by click, Enter and Space when the screen opens an editor from it. */
function TableRow<T>({
  row,
  columns,
  onRowActivate,
  rowLabel,
}: {
  row: T;
  columns: Column<T>[];
  onRowActivate?: (row: T) => void;
  rowLabel?: (row: T) => string;
}) {
  const interactive = Boolean(onRowActivate);
  return (
    <tr
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? rowLabel?.(row) : undefined}
      onClick={interactive ? () => onRowActivate?.(row) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowActivate?.(row);
              }
            }
          : undefined
      }
      className={interactive ? 'cursor-pointer hover:bg-canvas' : undefined}
    >
      {columns.map((c) => (
        <td
          key={c.key}
          className={`border-t border-line px-4 py-3 ${
            c.align === 'right' ? 'text-right tabular-nums' : 'text-left'
          }`}
        >
          {c.render(row)}
        </td>
      ))}
    </tr>
  );
}
