/**
 * Vitest global setup/teardown.
 *
 * Closes resources that keep the Vitest process alive after all suites finish:
 *   - The socket.io HTTP server (opened by src/server/index.js)
 *   - The libsql database client (holds file/WAL handles even for :memory: DBs)
 *   - The Winston logger (holds stdout stream handles via Console transport)
 *   - The metricsCollector setInterval timer
 */

async function cleanModule(flag, modulePath, cleanFn) {
  if (!flag) return;
  try {
    const mod = await import(modulePath);
    await cleanFn(mod);
  } catch {
    // ignore
  }
}

export async function teardown() {
  // ── HTTP server ────────────────────────────────────────────────────────────
  await cleanModule(
    globalThis.__wishboardServerLoaded,
    './src/server/index.js',
    async (mod) => {
      const server = mod.server ?? null;
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    }
  );

  // ── WebSocket server (Socket.io) ───────────────────────────────────────────
  await cleanModule(
    globalThis.__wishboardSocketLoaded,
    './src/server/socket.js',
    (mod) => mod.closeSocket()
  );

  // ── Metrics collector timer ────────────────────────────────────────────────
  await cleanModule(
    globalThis.__wishboardCollectorLoaded,
    './src/server/metricsCollector.js',
    (mod) => mod.stopCollector()
  );

  // ── libsql database client ─────────────────────────────────────────────────
  await cleanModule(
    globalThis.__wishboardDbLoaded,
    './src/server/db.js',
    (mod) => mod.closeDb()
  );

  // ── Winston logger ─────────────────────────────────────────────────────────
  await cleanModule(
    globalThis.__wishboardLoggerLoaded,
    './src/server/logger.js',
    (mod) => mod.default.close()
  );
}
