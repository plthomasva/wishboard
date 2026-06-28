/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to mock process.cpuUsage before metricsCollector.js is imported
vi.hoisted(() => {
  const real = process.cpuUsage();
  let count = 0;
  process.cpuUsage = () => {
    count++;
    return {
      user: real.user + count * 1_000_000,
      system: real.system + count * 500_000
    };
  };
});


import os from 'node:os';
import v8 from 'node:v8';
import {
  recordRequest,
  metricsMiddleware,
  startCollector,
  stopCollector,
  getSnapshot,
  resetCollector
} from './metricsCollector.js';

describe('metricsCollector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCollector();
    stopCollector();
  });


  afterEach(() => {
    vi.useRealTimers();
    stopCollector();
    vi.restoreAllMocks();
  });

  describe('recordRequest', () => {
    it('records status code counts and latency mean using Welford algorithm', () => {
      recordRequest(200, 50);
      
      startCollector();
      vi.advanceTimersByTime(5000);
      
      let snapshot = getSnapshot(1);
      expect(snapshot.httpSamples).toHaveLength(1);

      expect(snapshot.httpSamples[0].r2xx).toBe(1);
      expect(snapshot.httpSamples[0].count).toBe(1);
      expect(snapshot.httpSamples[0].mean).toBe(50);

      recordRequest(201, 100);
      recordRequest(404, 200);
      recordRequest(500, 300);
      vi.advanceTimersByTime(5000);

      snapshot = getSnapshot(2);
      expect(snapshot.httpSamples).toHaveLength(2);
      const latest = snapshot.httpSamples[1];
      expect(latest.r2xx).toBe(1);
      expect(latest.r4xx).toBe(1);
      expect(latest.r5xx).toBe(1);
      expect(latest.count).toBe(3);
      expect(latest.mean).toBe(200);
    });
  });

  describe('metricsMiddleware', () => {
    it('measures request duration and records stats on response finish', () => {
      const req = {};
      const res = {
        statusCode: 302,
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        })
      };
      const next = vi.fn();

      metricsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));

      startCollector();
      vi.advanceTimersByTime(5000);
      const snapshot = getSnapshot(1);
      expect(snapshot.httpSamples[0].r3xx).toBe(1);
      expect(snapshot.httpSamples[0].count).toBe(1);
    });
  });

  describe('collector loop', () => {
    it('collects cpu, memory, loadavg correctly on intervals', () => {
      vi.spyOn(v8, 'getHeapStatistics').mockReturnValue({
        used_heap_size: 50 * 1024 * 1024,
        heap_size_limit: 1024 * 1024 * 1024,
      });

      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 120 * 1024 * 1024,
      });

      vi.spyOn(os, 'loadavg').mockReturnValue([1.5, 1.2, 1]);

      startCollector();

      vi.advanceTimersByTime(5000);
      let snapshot = getSnapshot(1);
      expect(snapshot.osSamples).toHaveLength(1);
      
      const sample1 = snapshot.osSamples[0];
      expect(sample1.cpu).toBe(30);
      expect(sample1.heapUsed).toBe(50);

      expect(sample1.heapTotal).toBe(1024);
      expect(sample1.rss).toBe(120);
      expect(sample1.load).toBe(1.5);

      vi.advanceTimersByTime(5000);
      snapshot = getSnapshot(2);
      expect(snapshot.osSamples).toHaveLength(2);
    });

    it('enforces retention size limits', () => {
      startCollector();
      for (let i = 0; i < 725; i++) {
        vi.advanceTimersByTime(5000);
      }

      const snapshot = getSnapshot(1000);
      expect(snapshot.osSamples.length).toBe(720);
      expect(snapshot.httpSamples.length).toBe(720);
    });

    it('does not double start collector', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      startCollector();
      startCollector();
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });
});
