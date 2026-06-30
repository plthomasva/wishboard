/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

const defaultAdminUsername = 'admin';
const defaultAdminSecret = 'admin-board';

const clearTestData = async () => {
  await db.exec('DELETE FROM sessions');
  await db.exec('DELETE FROM wishes');
  await db.exec("DELETE FROM users WHERE role != 'admin'");
};

beforeEach(async () => {
  await clearTestData();
});

afterEach(async () => {
  await clearTestData();
});

describe('Admin routes coverage', () => {
  const loginAsAdmin = async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({ username: defaultAdminUsername, passphrase: defaultAdminSecret })
      .set('Accept', 'application/json');
    return response.body.token;
  };

  it('handles not found errors for clearing single flag', async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .post('/api/admin/wishes/non-existent/clear-flag')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Wish not found.');
  });

  it('handles errors during reset-password and calls next(error)', async () => {
    const token = await loginAsAdmin();

    // Register a user to trigger reset
    const registerRes = await request(app)
      .post('/api/users/register')
      .send({ username: 'reset-error-user', passphrase: 'pwd' });
    const userId = registerRes.body.id;

    const originalPrepare = await db.prepare.bind(db);
    const spy = vi.spyOn(db, 'prepare').mockImplementation((sql) => {
      if (typeof sql === 'string' && sql.includes('UPDATE users SET passphrase_hash = ?')) {
        throw new Error('Mock error');
      }
      return originalPrepare(sql);
    });

    const response = await request(app)
      .post(`/api/admin/users/${userId}/reset-password`)
      .set('Authorization', `Bearer ${token}`);
    
    // next(error) in Express will usually render a 500 HTML page or error JSON depending on the handler
    expect(response.status).toBe(500);

    spy.mockRestore();
  });

  it('returns delete preview stats correctly', async () => {
    const token = await loginAsAdmin();
    const registerRes = await request(app)
      .post('/api/users/register')
      .send({ username: 'delete-preview-user', passphrase: 'pwd' });
    const userId = registerRes.body.id;

    await db.prepare('INSERT INTO wishes (id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('preview-wish', userId, 'test', new Date().toISOString(), new Date().toISOString());

    const response = await request(app)
      .get(`/api/admin/users/${userId}/delete-preview`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ wishesCount: 1, wishmailsCount: 0 });
  });

  it('rejects demo reset in production without force', async () => {
    const token = await loginAsAdmin();
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .post('/api/admin/reset-demo')
      .send({})
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Demo reset is disabled in production unless force is explicitly requested.');

    process.env.NODE_ENV = originalEnv;
  });

  it('allows demo reset in production with force', async () => {
    const token = await loginAsAdmin();
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .post('/api/admin/reset-demo')
      .send({ force: true })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    process.env.NODE_ENV = originalEnv;
  });

  it('reads logs successfully', async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('logs');
  });

  it('parses and formats logs successfully', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const logsDir = path.join(process.cwd(), 'data/logs');
    
    // Ensure logs directory exists
    fs.mkdirSync(logsDir, { recursive: true });
    
    // Create a temporary log file
    const testLogFile = path.join(logsDir, 'test-formatting.log');
    const logsContent = [
      JSON.stringify({ timestamp: '2026-01-01', level: 'info', message: 'Hello world', userId: 123 }),
      JSON.stringify({ timestamp: '2026-01-01', level: 'warn', message: 'Warning msg' }),
      JSON.stringify({ message: 'Only message' }),
      'Raw non-JSON log line'
    ].join('\n');
    
    fs.writeFileSync(testLogFile, logsContent, 'utf-8');
    
    try {
      const token = await loginAsAdmin();
      const response = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.logs).toContain('[2026-01-01] info: Hello world {"userId":123}');
      expect(response.body.logs).toContain('[2026-01-01] warn: Warning msg');
      expect(response.body.logs).toContain('[] : Only message');
      expect(response.body.logs).toContain('Raw non-JSON log line');
    } finally {
      // Clean up
      if (fs.existsSync(testLogFile)) {
        fs.unlinkSync(testLogFile);
      }
    }
  });

  it('returns config successfully', async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('isProduction');
  });

});
