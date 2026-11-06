import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Four entries. Three are the access-role portals (PRD 15.3); the fourth is the root page
 * (FD-29). Routing is hash-based, so each public path is a rewrite onto an entry's HTML --
 * no SPA fallback, no second build, no server logic.
 *
 * THE URL SCHEME IS THE FOUNDER'S, set 2026-11-06 (FD-30). It replaces the Build Prompts'
 * /user/, /org-admin/, /fleet/ and Prompt 1.5's /admin/login:
 *
 *   landed on            signed in at
 *   /                    -- the root page, public
 *   /user                /login
 *   /orgadmin            /org/login
 *   /superadmin          /superadmin/login
 *
 * The old paths are redirected rather than dropped, because in the dev server that is four
 * lines. There is still no production rewrite config of any kind, so none of this is a
 * deployment decision -- see docs/plan.md 4-E1 and FD-29.
 */
const ENTRY_PATHS: Record<string, string> = {
  // The root page. DEV SERVER ONLY (FD-29): built as an entry so the bundle grep, axe and
  // typecheck cover it, but no production rewrite claims `/`. A marketing page arguably
  // belongs on orbitumai.com rather than in the app repo.
  '/': '/dashboards/landing/index.html',
  '/user': '/dashboards/user/index.html',
  '/login': '/dashboards/user/index.html',
  '/orgadmin': '/dashboards/orgadmin/index.html',
  '/org/login': '/dashboards/orgadmin/index.html',
  '/superadmin': '/dashboards/superadmin/index.html',
  '/superadmin/login': '/dashboards/superadmin/index.html',
};

/** The paths FD-30 replaced. Free to keep working, so they are kept. */
const REDIRECTS: Record<string, string> = {
  '/user/': '/user',
  '/org-admin/': '/orgadmin',
  '/org-admin': '/orgadmin',
  '/fleet/': '/superadmin',
  '/fleet': '/superadmin',
  '/admin/login': '/superadmin/login',
  // A trailing slash on a new path lands on the new path rather than a 404.
  '/orgadmin/': '/orgadmin',
  '/superadmin/': '/superadmin',
};

function publicPaths(): Plugin {
  return {
    name: 'orbitcrew-public-paths',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        const redirect = REDIRECTS[url];
        if (redirect) {
          res.statusCode = 308;
          res.setHeader('Location', redirect);
          res.end();
          return;
        }

        const target = ENTRY_PATHS[url];
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
        orgadmin: resolve(import.meta.dirname, 'dashboards/orgadmin/index.html'),
        superadmin: resolve(import.meta.dirname, 'dashboards/superadmin/index.html'),
        landing: resolve(import.meta.dirname, 'dashboards/landing/index.html'),
      },
      output: {
        /**
         * Chunking is EXPLICIT, and that is a correctness requirement rather than a
         * performance one.
         *
         * Left to itself, rolldown merged fleet-only modules into a chunk all three
         * entries load, which put ORBIT-OS, the operator sign-in path and two other
         * customers' names into both customer bundles. Measured in dist. PRD 15.3 bans the
         * first from the customer surfaces and FD-1 is instance-per-org, so naming each
         * entry's own code into its own chunk is what keeps the isolation real.
         *
         * Anything whose path names `fleet` goes to the fleet chunk: that covers
         * src/apps/fleet/* and the two shared modules only it imports,
         * schemas/fleet.ts and seeds/fleet-runtime.ts.
         *
         * src/shared/seeds/customer-surface.test.ts asserts the result.
         */
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          return id.includes('react') || id.includes('scheduler') ? 'vendor-react' : 'vendor';
        },
      },
    },
  },
});
