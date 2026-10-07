// The User app's entry point, mounted by dashboards/user/index.html.
//
// It mounts the root and names the app, and that is all it does. The AppShell,
// the nav and the 52 screens arrive in the slices after this one. What this
// file does change is the S-43 tripwire: a non-test .tsx under
// dashboards/src/apps arms it, so from here on all three entry files must
// exist and carry the titles PRD section 15.3 gives them.
//
// Section 15.3: this is a customer surface. It says Orbitcrew and never the
// internal name.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The one stylesheet. It loads the frozen design values and then the theme, in
// that order, so this file never reaches for either of them directly.
import '../../shared/styles/app.css';

const container = document.getElementById('root');

// The entry file is the only place #root comes from. Throwing here names that
// fault plainly, where React would otherwise report a null container from
// inside its own stack.
if (container === null) throw new Error('No #root element in dashboards/user/index.html');

createRoot(container).render(
  <StrictMode>
    <h1>Orbitcrew</h1>
  </StrictMode>,
);
