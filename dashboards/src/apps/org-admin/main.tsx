// The Org Admin app's entry point, mounted by dashboards/org-admin/index.html.
//
// Minimal on purpose: it mounts the root and names the app. The AppShell, the
// nav and the screens arrive in the slices after this one.
//
// Section 15.3: Org Admin is a customer surface too. Setting up the office is
// not an internal job, so this says Orbitcrew and never the internal name.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');

// The entry file is the only place #root comes from. Throwing here names that
// fault plainly, where React would otherwise report a null container from
// inside its own stack.
if (container === null) throw new Error('No #root element in dashboards/org-admin/index.html');

createRoot(container).render(
  <StrictMode>
    <h1>Orbitcrew</h1>
  </StrictMode>,
);
