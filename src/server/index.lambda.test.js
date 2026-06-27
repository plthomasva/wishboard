import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

describe('Server index.js - Lambda Mode', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME;
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'mock-lambda-function';
    vi.resetModules();
  });

  afterEach(() => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv;
  });

  it('should return 200 with not supported message for metrics on Lambda', async () => {
    const { default: app, server } = await import('./index.js');
    
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Metrics are not supported in AWS Lambda Serverless mode');
    
    server.close();
  }, 20000);
});
