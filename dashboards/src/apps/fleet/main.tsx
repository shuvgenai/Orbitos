// The fleet console's entry point, mounted by dashboards/fleet/index.html.
//
// Minimal on purpose: it mounts the root and names the console. The AppShell,
// the nav and the screens arrive in the slices after this one.
//
// Section 15.3 exempts this surface, and only this one. It is the OrbitumAI
// operator's console, not a customer screen, so the name ORBIT-OS belongs
// here. guards/design-naming.test.ts does not scan this folder for that
// reason; the exemption is the whole point of the folder being separate.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');

// The entry file is the only place #root comes from. Throwing here names that
// fault plainly, where React would otherwise report a null container from
// inside its own stack.
if (container === null) throw new Error('No #root element in dashboards/fleet/index.html');

createRoot(container).render(
  <StrictMode>
    <h1>ORBIT-OS fleet console</h1>
  </StrictMode>,
);
