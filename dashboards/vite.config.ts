// One Vite project, three HTML entries: the User app, the Org Admin app and the
// fleet console. They are separate builds because section 15.3 gives them
// different names, not because they are different products. A customer never
// reaches the fleet bundle and never reads the words ORBIT-OS.
//
// `root` is not set. Vite's default root is the directory holding this file,
// which is dashboards/, so every path below is relative to it. Writing
// `root: __dirname` would be worse than redundant: this package is
// `"type": "module"` and __dirname does not exist in an ES module.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // Named inputs, so the three bundles keep these names in the output instead
    // of being told apart by a hash. Vite builds every entry listed here; one
    // left out is a dashboard that silently never ships.
    rollupOptions: {
      input: {
        user: 'user/index.html',
        'org-admin': 'org-admin/index.html',
        fleet: 'fleet/index.html',
      },
    },
  },
});
