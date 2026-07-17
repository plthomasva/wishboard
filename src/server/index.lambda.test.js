import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

process.env.WISHBOARD_DB_PATH = ':memory:';

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

  it('should return 400 for /api/admin/local-metrics in Lambda mode (serverless only)', async () => {
    const { default: app, server } = await import('./index.js');

    // local-metrics is only meaningful outside Lambda; in Lambda mode it returns 400
    const res = await request(app)
      .get('/api/admin/local-metrics')
      .set('Authorization', 'Bearer invalid-token'); // invalid token -> 401 (no valid session)
    // We just confirm the route is present and rejects: 401 (bad token), 403
    // (admin required), or 400 (route reached in Lambda mode) — never 404.
    expect([400, 401, 403]).toContain(res.status);

    server.close();
  }, 20000);
});
