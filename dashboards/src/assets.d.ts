// Ambient declarations for the imports a bundler resolves and tsc does not.
//
// This file is also the one input that makes dashboards/tsconfig.json a
// non-empty project. Without it tsc exits with TS18003 ("No inputs were
// found"), so `pnpm typecheck` could not reach the dashboards project at all
// until sub-project 1a wrote its first component.
declare module '*.css';

declare module '*.svg' {
  const src: string;
  export default src;
}
