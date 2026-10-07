// Loads the jest-dom matchers for every test in the dashboards project, and
// unmounts each render so one test cannot see another's DOM.
//
// It lives under src, not at the folder root, for two reasons. The root allows
// only *.config.ts files, so guards/contract-boundary.test.ts rejects a stray
// source file there. And src is already in the tsconfig include, so the matcher
// augmentation this import carries reaches the test files that rely on it.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
