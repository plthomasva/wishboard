import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.WISHBOARD_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

vi.mock('@codegenie/serverless-express', () => {
  const mockInstance = vi.fn().mockResolvedValue('mocked-response');
  return { default: vi.fn(() => mockInstance) };
});

vi.mock('../src/server/index.js', () => {
  return { default: 'mock-app' };
});

describe('lambda.mjs', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initializes serverlessExpress and handles event, caching the instance', async () => {
    const lambda = await import('./lambda.mjs');
    const serverlessExpress = (await import('@codegenie/serverless-express')).default;

    const event = { requestContext: {} };
    const context = {};
    const res1 = await lambda.handler(event, context);

    expect(serverlessExpress).toHaveBeenCalledWith({ app: 'mock-app' });
    expect(res1).toBe('mocked-response');

    // Call again to test the cached branch
    const res2 = await lambda.handler(event, context);
    expect(res2).toBe('mocked-response');
    expect(serverlessExpress).toHaveBeenCalledTimes(1);
  }, 15000);
});
