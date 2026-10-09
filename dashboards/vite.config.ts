// One Vite project, three HTML entries: the User app, the Org Admin app and the
// fleet console. They are separate builds because section 15.3 gives them
// different names, not because they are different products. A customer never
// reaches the fleet bundle and never reads the words ORBIT-OS.
//
// `root` is not set. Vite's default root is the directory holding this file,
// which is dashboards/, so every path below is relative to it. Writing
// `root: __dirname` would be worse than redundant: this package is
// `"type": "module"` and __dirname does not exist in an ES module.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Absolute, and fileURLToPath rather than URL.pathname: pathname leaves a path
// with spaces or non-ASCII characters percent-encoded, and the allow list then
// names a directory that does not exist. guards/lib/walk.ts carries the same
// note for the same reason.
const DASHBOARDS = fileURLToPath(new URL('.', import.meta.url));
const FROZEN_DESIGN = fileURLToPath(new URL('../design/', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // design/ sits one level above the Vite root, and the dev server serves
    // nothing outside that root. app.css imports design/tokens.css, which is
    // frozen and must not be copied in here: a copy is a second place the
    // values live, which is the one thing section 15.1 exists to prevent. The
    // production build resolves the relative path without this.
    //
    // Two entries, not '..'. Naming the parent would have opened the whole
    // repository to the dev server, including .env.local and db/. Setting this
    // list at all turns OFF Vite's own workspace-root detection, so the Vite
    // root has to be listed here too or the server stops serving its own files.
    fs: { allow: [DASHBOARDS, FROZEN_DESIGN] },
  },
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
