// The fleet console's entry point, mounted by dashboards/fleet/index.html.
//
// It mounts the root and hands the shell the fleet list of screens. It holds
// no route and no screen name of its own: section 15.7 is the list, and
// nav/screens.ts is that list in a shape code can read.
//
// Section 15.3 exempts this surface, and only this one. It is the OrbitumAI
// operator's console, not a customer screen, so the name ORBIT-OS belongs
// here. guards/design-naming.test.ts does not scan this folder for that
// reason; the exemption is the whole point of the folder being separate.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RoleRoutes } from '../../shared/layout/RoleRoutes';
import { FLEET_NAV } from '../../shared/nav/roles';
// The one stylesheet. It loads the frozen design values and then the theme, in
// that order, so this file never reaches for either of them directly.
import '../../shared/styles/app.css';

const container = document.getElementById('root');

// The entry file is the only place #root comes from. Throwing here names that
// fault plainly, where React would otherwise report a null container from
// inside its own stack.
if (container === null) throw new Error('No #root element in dashboards/fleet/index.html');

createRoot(container).render(
  <StrictMode>
    <RoleRoutes appName="ORBIT-OS fleet console" nav={FLEET_NAV} />
  </StrictMode>,
);
