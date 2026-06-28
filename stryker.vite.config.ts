import base from './vite.config.ts';

// Exclude server tests during Stryker runs to completely avoid better-sqlite3 SIGSEGV in worker threads on Linux/Windows
if (base.test) {
  base.test.exclude = [...(base.test.exclude || ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*']), 'src/server/**/*.test.js', 'src/server/**/*.test.ts', 'src/server/index.test.js'];
}

// Force forks pool via a plugin to override Stryker's inline config injection which causes Vitest 4 to revert to threads
base.plugins = base.plugins || [];
base.plugins.push({
  name: 'force-forks-pool',
  config(config) {
    if (config.test) {
      config.test.pool = 'forks';
      delete config.test.poolOptions;
    }
  }
});

export default base;
