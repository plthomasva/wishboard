/**
 * metricsCollector.js
 *
 * Lightweight in-process metrics collector for local/Docker deployments.
 * Replaces the express-status-monitor iframe with data that feeds native
 * Recharts sparklines — no extra npm dependencies beyond what Node provides.
 *
 * Collects:
 *   - CPU usage % (via process.cpuUsage delta)
 *   - Heap used / heap total (MB)
 *   - RSS memory (MB)
 *   - OS load average (1 min)
 *   - HTTP response counts by status class (2xx/3xx/4xx/5xx) and mean latency
 *
 * Data is kept in a fixed-size circular buffer (RETENTION samples).
 * Each sample is taken at INTERVAL_MS resolution.
 */

import os from 'node:os';
import v8 from 'node:v8';

const INTERVAL_MS = 5_000;   // sample every 5 seconds
const RETENTION   = 720;     // keep 60 minutes of samples (720 × 5s)

/** @type {{ ts: number, cpu: number, heapUsed: number, heapTotal: number, rss: number, load: number }[]} */
const osSamples = [];

/** @type {{ ts: number, r2xx: number, r3xx: number, r4xx: number, r5xx: number, count: number, mean: number }[]} */
const httpSamples = [];

// Accumulator for the current 5-second window
let currentWindow = newWindow();

function newWindow() {
  return { r2xx: 0, r3xx: 0, r4xx: 0, r5xx: 0, count: 0, mean: 0 };
}

// CPU tracking
let prevCpuUsage = process.cpuUsage();
let prevCpuTime  = Date.now();

let collectorTimer = null;

/**
 * Record a completed HTTP request into the current window.
 * Call this from Express middleware after the response is sent.
 *
 * @param {number} statusCode
 * @param {number} durationMs
 */
export function recordRequest(statusCode, durationMs) {
  const cls = Math.floor(statusCode / 100);
  currentWindow[`r${cls}xx`] = (currentWindow[`r${cls}xx`] ?? 0) + 1;
  currentWindow.count += 1;
  // Running mean: Welford's online algorithm
  currentWindow.mean += (durationMs - currentWindow.mean) / currentWindow.count;
}

/**
 * Express middleware that records response status and latency.
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordRequest(res.statusCode, durationMs);
  });

  next();
}

/**
 * Start the background sampling timer.
 * Safe to call multiple times — only starts once.
 */
export function startCollector() {
  if (collectorTimer) return;

  collectorTimer = setInterval(() => {
    const now = Date.now();

    // ── CPU % ──────────────────────────────────────────────────────────────────
    const cpuNow   = process.cpuUsage();
    const wallMs   = now - prevCpuTime;
    const userMs   = (cpuNow.user   - prevCpuUsage.user)   / 1000;
    const systemMs = (cpuNow.system - prevCpuUsage.system) / 1000;
    const cpuPct   = wallMs > 0 ? Math.min(100, ((userMs + systemMs) / wallMs) * 100) : 0;
    prevCpuUsage = cpuNow;
    prevCpuTime  = now;

    // ── Memory ─────────────────────────────────────────────────────────────────
    const heap = v8.getHeapStatistics();
    const mem  = process.memoryUsage();

    osSamples.push({
      ts:        now,
      cpu:       Math.round(cpuPct * 10) / 10,
      heapUsed:  Math.round(heap.used_heap_size / 1024 / 1024 * 10) / 10,
      heapTotal: Math.round(heap.heap_size_limit / 1024 / 1024 * 10) / 10,
      rss:       Math.round(mem.rss / 1024 / 1024 * 10) / 10,
      load:      Math.round(os.loadavg()[0] * 100) / 100,
    });

    if (osSamples.length > RETENTION) osSamples.shift();

    // ── HTTP window ────────────────────────────────────────────────────────────
    httpSamples.push({ ts: now, ...currentWindow });
    if (httpSamples.length > RETENTION) httpSamples.shift();

    currentWindow = newWindow();
  }, INTERVAL_MS);

  // Don't keep the process alive just for metrics
  if (collectorTimer.unref) collectorTimer.unref();
}

/**
 * Stop the background timer (used in tests).
 */
export function stopCollector() {
  if (collectorTimer) {
    clearInterval(collectorTimer);
    collectorTimer = null;
  }
}

/**
 * Return a snapshot of the last `maxPoints` samples for both series.
 *
 * @param {number} [maxPoints=360]  How many 5-second buckets to return (default = last 30 min)
 * @returns {{ osSamples: typeof osSamples, httpSamples: typeof httpSamples }}
 */
export function getSnapshot(maxPoints = 360) {
  return {
    osSamples:  osSamples.slice(-maxPoints),
    httpSamples: httpSamples.slice(-maxPoints),
    intervalMs: INTERVAL_MS,
  };
}
