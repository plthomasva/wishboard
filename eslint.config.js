// Version pin: `eslint` and `@eslint/js` are held on the 9.x line — Dependabot
// bumps to 10.x were ignored (PRs #114 eslint, #129 @eslint/js). Reason:
// `eslint-plugin-react` has no ESLint 10 support yet — on v10 it hits a removed
// RuleContext API (jsx-eslint/eslint-plugin-react#3977; fix in PR #3979). The
// rest of the toolchain already allows eslint ^10; this plugin is the lone
// holdout. Lift the pin once it ships a stable release with `eslint ^10` in its
// peers. (Related: `typescript-eslint` still peers `typescript <6.1.0`, which
// keeps us on typescript 6.0.x and blocks the Dependabot TS 7 bump — same wait.)
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

// vitest exposes these as globals (vite.config.ts -> test.globals: true)
const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  suite: 'readonly',
  expect: 'readonly',
  expectTypeOf: 'readonly',
  assert: 'readonly',
  vi: 'readonly',
  vitest: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'reports',
      '.stryker-tmp',
      '**/.aws-sam/**',
      '**/node_modules/**',
      'src/client/public',
      'scratch/**',
    ],
  },

  // Base recommended rules for every JS/TS file
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Pervasive stylistic rules in existing code — surface as warnings, not
  // CI-blocking errors, so linting can be adopted incrementally.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Allow intentionally-unused bindings when prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // React client (browser)
  {
    files: ['src/client/src/**/*.{ts,tsx,js,jsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Apostrophes/quotes in JSX copy render fine; escaping hurts readability.
      'react/no-unescaped-entities': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Node code (server, cli, scripts, serverless, root config files)
  {
    files: [
      'src/server/**/*.{js,ts}',
      'src/cli/**/*.{js,ts}',
      'scripts/**/*.js',
      'aws-serverless/**/*.{js,mjs}',
      '*.{js,ts,mjs}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Test files (vitest globals + node)
  {
    files: ['**/*.{test,spec}.{js,mjs,ts,tsx}', '**/setupTests.ts', 'vitest.global-setup.js'],
    languageOptions: {
      globals: { ...globals.node, ...vitestGlobals },
    },
  },

  // Turn off rules that conflict with Prettier — keep this last
  prettier
);
