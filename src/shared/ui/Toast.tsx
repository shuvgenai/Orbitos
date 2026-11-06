import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastContext = { notify: (message: string) => void };
const Ctx = createContext<ToastContext>({ notify: () => {} });

export const useToast = () => useContext(Ctx);

/** aria-live=polite, so a status change is announced without stealing focus (Prompt 1 item 7). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');

  const notify = useCallback((m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(''), 3000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <output aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2">
        {message ? (
          <p className="rounded-button border border-line bg-paper px-4 py-2 text-base">{message}</p>
        ) : null}
      </output>
    </Ctx.Provider>
  );
}
