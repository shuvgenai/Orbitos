import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { App } from './App';

/**
 * No ApiProvider and no SessionProvider: this is a public page with no identity, no mock
 * client and no session. That is also why it carries none of the app's data.
 */
const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
