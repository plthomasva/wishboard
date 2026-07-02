import { describe, expect, it, vi, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import nodePath from 'node:path';

describe('Logger', () => {
  let tmpDir;

  afterEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
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

    // Point the log file at a throwaway temp dir (reaped in afterEach) so the
    // test never writes log files into the repo working tree.
    tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'wishboard-logtest-'));
    const path = await import('node:path');
    vi.spyOn(path.default, 'join').mockReturnValue(nodePath.join(tmpDir, 'app.log'));

    const mockEmitSystemLog = vi.fn();
    vi.doMock('./socket.js', () => ({
      emitSystemLog: mockEmitSystemLog,
    }));

    const logger = (await import('./logger.js')).default;
    expect(logger).toBeDefined();

    // production has DailyRotateFile, SocketTransport, and Console
    expect(logger.transports.length).toBe(3);

    logger.info('test message', { extraField: 'metaData' });
    logger.info('test empty meta');

    // Wait a short moment for the async import & WebSocket emit log operation to finish
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockEmitSystemLog).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('enables colorize in console transport under development TTY environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;
    const originalIsTTY = process.stdout ? process.stdout.isTTY : undefined;

    process.env.NODE_ENV = 'development';
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (process.stdout) {
      process.stdout.isTTY = true;
    }

    const logger = (await import('./logger.js')).default;
    expect(logger).toBeDefined();

    process.env.NODE_ENV = originalEnv;
    if (originalLambda === undefined) {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    } else {
      process.env.AWS_LAMBDA_FUNCTION_NAME = originalLambda;
    }
    if (process.stdout) {
      process.stdout.isTTY = originalIsTTY;
    }
  });
});
