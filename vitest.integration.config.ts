import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Integration/contract tests exercise REAL boundaries (a file-backed libSQL
// database, the real `sam` CLI, package.json invariants) that the mocked unit
// suite deliberately stubs. They live under tests/integration/ and run via a
// separate `npm run test:integration` so the fast unit loop is unaffected.
export default defineConfig({
  test: {
    root: projectRoot,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.js'],
    globalSetup: 'vitest.global-setup.js',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
