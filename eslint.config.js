// ESLint 9 flat config. Spec section 8: `pnpm lint` gates on zero errors, and
// react/no-danger is an error.
//
// react/no-danger is the one rule the spec names, because
// dangerouslySetInnerHTML is how a customer screen stops being a customer
// screen: it renders whatever a job, an email or a connector produced, with no
// escaping. Everything else here is the recommended set, which catches the
// ordinary mistakes without anyone choosing rule by rule.
//
// TypeScript and TSX are parsed by @babel/eslint-parser, with
// @babel/preset-typescript and @babel/preset-react. The parser only reads
// syntax: it strips the types and hands ESLint a plain ESTree tree. That is
// what this gate wants. Type-aware linting is deliberately NOT on, because it
// needs every linted file to sit in a tsconfig project, and this repo has two
// projects that between them exclude reference/, landing/, archive/ and
// dashboards/ from the root one. `pnpm typecheck` already reads types; this
// gate reads shape.
import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import react from 'eslint-plugin-react';
import globals from 'globals';

/**
 * The seven frozen directories of spec section 8.
 *
 * Findings inside them are reported and never fixed, and a fix needs the
 * founder's explicit approval case by case. So they are not linted by
 * `pnpm lint`: a gate that cannot go green is a gate somebody switches off.
 * Their counts are recorded in docs/decisions.md. They are collected by
 * running ESLint against a throwaway config that imports this one and filters
 * FROZEN back out of the ignore list: `--no-ignore` cannot be used, because it
 * lifts the node_modules and generated ignores at the same time.
 */
const FROZEN = ['frontdesk/', 'api/', 'db/', 'shared/', 'template/', 'ops/', 'design/'];

/** Not ours to lint, or not source at all. */
const NOT_OURS = [
  // The prototype. Behaviour and copy spec, read-only, PRD section 15.3.
  'reference/',
  // Its own repository, and gitignored here.
  'landing/',
  'archive/',
  '**/node_modules/',
  '**/generated/',
  '**/dist/',
  '**/.vitest/',
];

/**
 * Parse TypeScript and TSX without a babel config file on disk.
 *
 * The presets are held inside a wrapper parser rather than in
 * `languageOptions.parserOptions`, because ESLint deep-merges parserOptions
 * across matching config blocks and that merge turns an array into an
 * object: `presets: ['a', 'b']` arrives at Babel as `{ 0: 'a', 1: 'b' }`,
 * Babel ignores it, and every TypeScript file fails with a parsing error on
 * its first type annotation. Keeping the array out of the schema keeps it an
 * array.
 *
 * requireConfigFile: false lets Babel find no config file on disk, which is
 * the case here and is meant to be: the presets below are the whole
 * configuration, they apply to linting only, and they live next to the rule
 * they serve. `configFile: false` is deliberately NOT set. Given both
 * `babelrc: false` and `configFile: false`, @babel/eslint-parser 8 takes a
 * fast path that parses without loading Babel's config at all, so the presets
 * are ignored and TypeScript fails to parse.
 */
const babelTypescript = {
  meta: { name: 'babel-typescript' },
  parseForESLint(code, options) {
    return babelParser.parseForESLint(code, {
      ...options,
      requireConfigFile: false,
      babelOptions: {
        babelrc: false,
        presets: ['@babel/preset-typescript', '@babel/preset-react'],
      },
    });
  },
};

const typescriptParser = {
  parser: babelTypescript,
  parserOptions: { sourceType: 'module', ecmaFeatures: { jsx: true } },
};

export default [
  { ignores: [...NOT_OURS, ...FROZEN] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    plugins: { react },
    rules: {
      // The rule spec section 8 names. An error, never a warning: a warning is
      // a finding nobody is blocked by.
      'react/no-danger': 'error',
      // These two do not report anything. They tell core `no-unused-vars`
      // that a name used inside JSX is used: without them every imported
      // component and every local view function in the dashboards is reported
      // as dead code, and the gate blames the author for the linter's blind
      // spot.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: typescriptParser,
    rules: {
      // Both of these are type-blind here, and both are owned by tsc instead.
      //
      // The parser strips the types before ESLint sees the file, so core
      // no-undef reads every type name and every type-literal member name as
      // an undeclared global: `RootedPath`, `NodeJS`, `kind`. Core
      // no-unused-vars reads every `import type` as dead. Neither is a defect
      // and no rule option tells them apart. typescript-eslint's type-aware
      // replacements are what normally do this work, and this repo does not
      // use it.
      //
      // Nothing is lost. `pnpm typecheck` reports an undefined name as TS2304,
      // and noUnusedLocals and noUnusedParameters are on in both tsconfig
      // projects, which is what now reports unused code. Both rules stay on
      // for .js, .mjs and .cjs, where the parser is not in the way.
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    // The browser half. Only dashboards/src runs in a page.
    files: ['dashboards/src/**/*.{ts,tsx}'],
    languageOptions: { ...typescriptParser, globals: globals.browser },
    settings: { react: { version: 'detect' } },
  },
  {
    // Everything else runs in Node: guards, configs, scripts.
    files: [
      'guards/**/*.ts',
      '*.{js,ts}',
      'scripts/**/*.{js,mjs,ts}',
      'dashboards/*.{js,ts}',
      'web/src/**/*.ts',
      'worker/src/**/*.ts',
      'contract/**/*.ts',
    ],
    languageOptions: { globals: globals.node },
  },
];
