export type BannerTone = 'info' | 'error' | 'success';

/**
 * `live` chooses how a screen reader treats the banner, not which HTML attribute is used:
 *   status -> <output>, which carries role=status natively
 *   alert  -> role="alert", which has no element of its own
 *   none   -> a plain div, for copy that is not a state change
 *
 * Naming it `live` rather than `role` keeps a component prop from reading as the ARIA
 * attribute. The same reason AppShell takes `accessRole`.
 */
export function Banner({
  tone = 'info',
  live,
  children,
}: {
  tone?: BannerTone;
  live?: 'status' | 'alert' | 'none';
  children: React.ReactNode;
}) {
  const border = tone === 'error' ? 'border-danger' : 'border-line';
  const text = tone === 'error' ? 'text-danger' : 'text-ink';
  const className = `block rounded-button border bg-paper px-4 py-3 text-base ${border} ${text}`;
  const resolved = live ?? (tone === 'error' ? 'alert' : 'status');

  if (resolved === 'status') return <output className={className}>{children}</output>;
  if (resolved === 'alert') {
    return (
      <div role="alert" className={className}>
        {children}
      </div>
    );
  }
  return <div className={className}>{children}</div>;
}
