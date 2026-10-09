// The User app's entry point, mounted by dashboards/user/index.html.
//
// It mounts the root and hands the shell this role's list of screens. It holds
// no route and no screen name of its own: section 15.5 is the list, and
// nav/screens.ts is that list in a shape code can read.
//
// Section 15.3: this is a customer surface. It says Orbitcrew and never the
// internal name.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RoleRoutes } from '../../shared/layout/RoleRoutes';
import { USER_NAV } from '../../shared/nav/roles';
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
    <RoleRoutes appName="Orbitcrew" nav={USER_NAV} />
  </StrictMode>,
);
