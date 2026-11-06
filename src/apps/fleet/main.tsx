import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiProvider } from '@/shared/api/provider';
import { ToastProvider } from '@/shared/ui/Toast';
import '@/styles/index.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <ApiProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ApiProvider>
  </StrictMode>,
);
