import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Three separately deployable entries, one per access role (PRD 15.3), whose files live at
 * `dashboards/{user,org-admin,fleet}/index.html` -- the paths PRD 15.3 names.
 *
 * Six public paths map onto those three files: the Build Prompts deploy /user/, /org-admin/
 * and /fleet/, and Prompt 1.5 fixes the sign-in paths at /login, /org/login and
 * /admin/login. The founder's item 4 keeps both, on one domain. Routing is hash-based, so
 * the login screen is a hash route inside its own entry and each public path needs nothing
 * but a rewrite -- no SPA fallback, no second build, no server logic.
 *
 * In production that mapping is one deploy rewrite file. The plugin below is the same
 * mapping for the dev server, so dev and production answer on the same URLs. Keeping the
 * mapping in one place is also what makes the move to subdomains the founder asked about
 * cost one file plus a `base` per entry -- see docs/plan.md 4-E1 and 4-E2.
 */
const ENTRY_PATHS: Record<string, string> = {
  '/user/': '/dashboards/user/index.html',
  '/login': '/dashboards/user/index.html',
  '/org-admin/': '/dashboards/org-admin/index.html',
  '/org/login': '/dashboards/org-admin/index.html',
  '/fleet/': '/dashboards/fleet/index.html',
  '/admin/login': '/dashboards/fleet/index.html',
};

function publicPaths(): Plugin {
  return {
    name: 'orbitcrew-public-paths',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const target = ENTRY_PATHS[url] ?? ENTRY_PATHS[`${url}/`];
        if (target) req.url = target;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), publicPaths()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        user: resolve(import.meta.dirname, 'dashboards/user/index.html'),
        'org-admin': resolve(import.meta.dirname, 'dashboards/org-admin/index.html'),
        fleet: resolve(import.meta.dirname, 'dashboards/fleet/index.html'),
      },
      output: {
        // One shared vendor chunk; screens are lazy per route from the start, so Prompt 6's
        // 200 KB-per-dashboard cap is a build property rather than a retrofit.
        manualChunks: (id) =>
          id.includes('node_modules')
            ? id.includes('react') || id.includes('scheduler')
              ? 'vendor-react'
              : 'vendor'
            : undefined,
      },
    },
  },
});
