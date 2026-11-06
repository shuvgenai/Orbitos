import { useId } from 'react';

type Common = {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
};

const shell =
  'w-full min-h-touch rounded-button border border-line bg-paper px-3 text-base text-ink';

function Wrap({
  label,
  help,
  error,
  id,
  helpId,
  errId,
  children,
}: Common & { id: string; helpId: string; errId: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-base font-medium">
        {label}
      </label>
      {children}
      {help ? (
        <p id={helpId} className="mt-1 text-base text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="mt-1 text-base text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled text input. The error is announced; the help is linked, not read as an error. */
export function Field({
  label,
  help,
  error,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  ...rest
}: Common & {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
} & Record<string, unknown>) {
  const id = useId();
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  return (
    <Wrap label={label} help={help} error={error} id={id} helpId={helpId} errId={errId}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={[help ? helpId : null, error ? errId : null].filter(Boolean).join(' ') || undefined}
        className={shell}
        {...(rest as Record<string, never>)}
      />
    </Wrap>
  );
}

export function Textarea({
  label,
  help,
  error,
  value,
  onChange,
  rows = 5,
  readOnly = false,
}: Common & {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  readOnly?: boolean;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  return (
    <Wrap label={label} help={help} error={error} id={id} helpId={helpId} errId={errId}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[help ? helpId : null, error ? errId : null].filter(Boolean).join(' ') || undefined}
        className={`${shell} py-2 leading-relaxed`}
      />
    </Wrap>
  );
}

export function Select({
  label,
  help,
  error,
  value,
  onChange,
  options,
}: Common & {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  return (
    <Wrap label={label} help={help} error={error} id={id} helpId={helpId} errId={errId}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={shell}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Wrap>
  );
}
