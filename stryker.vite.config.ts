import base from './vite.config.ts';

// Skip index.test.js during Stryker runs to avoid sandbox file path collisions
base.test.exclude = [...(base.test.exclude || ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*']), 'src/server/index.test.js'];

// Run with forks pool to prevent better-sqlite3 from segfaulting in worker threads during sandbox execution
base.test.pool = 'forks';

export default base;
