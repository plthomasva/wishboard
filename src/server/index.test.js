import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from './index.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Server index.js', () => {
  it('should serve index.html for unknown routes', async () => {
    // Ensure dist directory and index.html exist for the test
    const distPath = path.resolve(__dirname, '../../dist');
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
    }
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '<html>Mock HTML</html>');
    }

    const res = await request(app).get('/some-random-client-route');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Wishboard</title>');
  });
});

