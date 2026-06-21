/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { EventEmitter } from 'events';

// Mock fs and https before importing the module
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    default: {
      ...original,
      mkdirSync: vi.fn(),
      createWriteStream: vi.fn(),
      existsSync: vi.fn(),
      unlink: vi.fn((p, cb) => cb && cb()),
    },
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(),
    existsSync: vi.fn(),
    unlink: vi.fn((p, cb) => cb && cb()),
  };
});

vi.mock('https', () => {
  return {
    default: {
      get: vi.fn(),
    },
    get: vi.fn(),
  };
});

import { downloadFile, main, FONTS, targetDir } from './download-fonts.js';

describe('download-fonts', () => {
  let mockWriteStream;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockWriteStream = new EventEmitter();
    mockWriteStream.close = vi.fn((cb) => cb && cb());
    fs.createWriteStream.mockReturnValue(mockWriteStream);
  });

  describe('downloadFile', () => {
    it('successfully downloads a file', async () => {
      const mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;
      mockResponse.pipe = vi.fn();

      https.get.mockImplementation((url, cb) => {
        cb(mockResponse);
        // Simulate response finish
        setTimeout(() => {
          mockWriteStream.emit('finish');
        }, 10);
        return new EventEmitter();
      });

      const promise = downloadFile('https://example.com/font.ttf', 'test.ttf');
      await expect(promise).resolves.toBeUndefined();
      expect(https.get).toHaveBeenCalledWith('https://example.com/font.ttf', expect.any(Function));
    });

    it('rejects on non-200 status code', async () => {
      const mockResponse = new EventEmitter();
      mockResponse.statusCode = 404;

      https.get.mockImplementation((url, cb) => {
        cb(mockResponse);
        return new EventEmitter();
      });

      const promise = downloadFile('https://example.com/font.ttf', 'test.ttf');
      await expect(promise).rejects.toThrow('Failed to download: Status 404');
    });

    it('rejects on network error', async () => {
      const mockRequest = new EventEmitter();
      https.get.mockReturnValue(mockRequest);

      const promise = downloadFile('https://example.com/font.ttf', 'test.ttf');
      
      // Simulate request error
      mockRequest.emit('error', new Error('Network Error'));

      await expect(promise).rejects.toThrow('Network Error');
      expect(fs.unlink).toHaveBeenCalledWith('test.ttf', expect.any(Function));
    });
  });

  describe('main', () => {
    it('downloads all fonts when offline fallback is not needed', async () => {
      const mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;
      mockResponse.pipe = vi.fn();

      https.get.mockImplementation((url, cb) => {
        cb(mockResponse);
        setTimeout(() => {
          mockWriteStream.emit('finish');
        }, 5);
        return new EventEmitter();
      });

      await main();

      expect(fs.mkdirSync).toHaveBeenCalledWith(targetDir, { recursive: true });
      expect(https.get).toHaveBeenCalledTimes(FONTS.length);
    });

    it('logs warning and uses cached files when download fails but they exist', async () => {
      // Simulate download failure
      https.get.mockImplementation((url, cb) => {
        const req = new EventEmitter();
        setTimeout(() => {
          req.emit('error', new Error('Connection failed'));
        }, 5);
        return req;
      });

      // Pretend cache exists
      fs.existsSync.mockReturnValue(true);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await main();

      expect(consoleWarnSpy).toHaveBeenCalledTimes(FONTS.length);
      expect(consoleLogSpy).toHaveBeenCalledWith('Checking for font updates...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Using cached version of Kalam-Regular.ttf');
    });

    it('exits with code 1 when download fails and cache does not exist', async () => {
      // Simulate download failure
      https.get.mockImplementation((url, cb) => {
        const req = new EventEmitter();
        setTimeout(() => {
          req.emit('error', new Error('Connection failed'));
        }, 5);
        return req;
      });

      // Pretend cache does not exist
      fs.existsSync.mockReturnValue(false);

      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await main();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
