import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(projectRoot, 'src/client');

export default defineConfig({
  // Vite should bundle the client app from src/client
  root: clientRoot,
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  test: {
    // Use repo root for testing so both client and server files are visible.
    root: projectRoot,
    globals: true,
    environment: 'jsdom',
    include: ['src/client/src/**/*.{test,spec}.{ts,tsx}', 'src/server/**/*.{test,spec}.{js,ts}'],
    setupFiles: 'src/client/src/setupTests.ts',
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
      all: true,
      include: ['src/client/src/**/*.{js,ts,tsx}', 'src/server/**/*.{js,ts}']
    }
  }
});
