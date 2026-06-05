import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', '../server/**/*.{test,spec}.{js,ts}'],
    setupFiles: './src/setupTests.ts',
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage',
      exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
      all: true,
      include: ['src/**/*.{js,ts,tsx}', '../../src/**/*.{js,ts}']
    }
  }
});
