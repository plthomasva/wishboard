import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app, { server } from './index.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('Server index.js', () => {
  it('should serve index.html for unknown routes', async () => {
    // Ensure dist directory and index.html exist for the test
    const distPath = path.resolve(__dirname, '../../dist');
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
    }
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '<html><head><title>Wishboard</title></head><body>Mock HTML</body></html>');
    }

    const res = await request(app).get('/some-random-client-route');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Wishboard</title>');
  });

  it('should return configuration on /api/config', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.realtimeProvider).toBeDefined();
  });

  it('should grant access to /api/admin/metrics using a valid ticket', async () => {
    const { generateMetricsTicket } = await import('./auth.js');
    const ticket = generateMetricsTicket();
    
    // We expect 404 or 200 depending on if statusMonitor is initialized, but not 401
    const res = await request(app).get(`/api/admin/metrics?ticket=${ticket}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

});

