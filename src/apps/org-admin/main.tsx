import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiProvider } from '@/shared/api/provider';
import { SessionProvider } from '@/shared/auth/SessionProvider';
import { ToastProvider } from '@/shared/ui/Toast';
import '@/styles/index.css';
import { App } from './App';
import { PORTAL } from './portal';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <ApiProvider>
      <SessionProvider portal={PORTAL}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </ApiProvider>
  </StrictMode>,
);
