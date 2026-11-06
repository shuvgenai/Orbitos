export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  // PRD 15.4: say what will appear here and the one action that fills it. Never an
  // illustration.
  return (
    <section className="rounded-button border border-line bg-paper p-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-base text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
