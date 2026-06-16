/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

const defaultAdminUsername = 'admin';
const defaultAdminSecret = 'admin-board';

const clearTestData = () => {
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM wishes');
  db.exec("DELETE FROM users WHERE role != 'admin'");
};

beforeEach(() => {
  clearTestData();
});

afterEach(() => {
  clearTestData();
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

    const originalPrepare = db.prepare.bind(db);
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
    // Since we don't have a specific error handler, express sends 500.
    expect(response.status).toBe(500);

    spy.mockRestore();
  });

  it('reads logs successfully', async () => {
    const token = await loginAsAdmin();
    const response = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('logs');
  });

});

