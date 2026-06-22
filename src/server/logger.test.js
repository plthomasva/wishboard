import { describe, expect, it, vi, afterEach } from 'vitest';

describe('Logger', () => {
  afterEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('initializes logger with silent console in test environment', async () => {
    process.env.NODE_ENV = 'test';
    const logger = (await import('./logger.js')).default;
    expect(logger).toBeDefined();
    expect(logger.transports.length).toBe(1); // Only Console
    expect(logger.transports[0].silent).toBe(true);
  });

  it('initializes logger with file transport and formatter in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    // We mock path so we don't actually create files in weird places during the test
    const path = await import('node:path');
    vi.spyOn(path.default, 'join').mockReturnValue('dummy-path.log');

    const logger = (await import('./logger.js')).default;
    expect(logger).toBeDefined();
    
    // production has DailyRotateFile, SocketTransport, and Console
    expect(logger.transports.length).toBe(3);
    
    logger.info('test message', { extraField: 'metaData' });
    logger.info('test empty meta');

    process.env.NODE_ENV = originalEnv;
  });
});
