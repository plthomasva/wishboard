import base from './vite.config.ts';

// Exclude index.test.js during Stryker runs to completely avoid sandbox file path collisions
if (base.test) {
  base.test.exclude = [...(base.test.exclude || ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*']), 'src/server/index.test.js'];
}

// Force forks pool via a plugin to override Stryker's inline config injection which causes Vitest 4 to revert to threads
base.plugins = base.plugins || [];
base.plugins.push({
  name: 'force-forks-pool',
  config(config) {
    if (config.test) {
      config.test.pool = 'forks';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (config.test as any).poolOptions;
    }
  }
});

export default base;
