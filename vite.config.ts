import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(projectRoot, 'src/client');
const packageJson = JSON.parse(fs.readFileSync(resolve(projectRoot, 'package.json'), 'utf-8'));

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  },
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
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  test: {
    // Use repo root for testing so both client and server files are visible.
    root: projectRoot,
    globals: true,
    environment: 'jsdom',
    include: ['src/client/src/**/*.{test,spec}.{ts,tsx}', 'src/server/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
    setupFiles: 'src/client/src/setupTests.ts',
    globalSetup: 'vitest.global-setup.js',
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.d.ts'],
      include: ['src/client/src/**/*.{js,ts,tsx}', 'src/server/**/*.{js,ts}', 'scripts/**/*.{js,ts}']
    }
  }
});
