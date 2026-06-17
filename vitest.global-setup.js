/**
 * Vitest global setup/teardown.
 * 
 * This teardown closes the socket.io HTTP server that is initialized when
 * any test file imports `src/server/index.js`. Without this, socket.io keeps
 * the vitest process alive after all suites complete.
 */

export async function teardown() {
  try {
    // index.js may not have been imported at all in a coverage-only run,
    // so guard against that with a dynamic import that won't throw.
    const mod = await import('./src/server/index.js');
    const server = mod.server ?? null;
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  } catch {
    // If index.js wasn't loaded (e.g., client-only test run) just skip.
  }
}
