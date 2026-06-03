process.env.WISHBOARD_DB_PATH = ':memory:';

import { beforeEach, describe, expect, it } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

afterEach(() => {
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM wishes');
  db.exec("DELETE FROM users WHERE role != 'admin'");
});

describe('User registration and login', () => {
  it('registers with blank passphrase and returns a generated secret', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send({ username: 'user1' })
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTypeOf('string');
    expect(response.body.secret).toBeTypeOf('string');
    expect(response.body.secret.length).toBeGreaterThan(0);
  });

  it('registers with explicit passphrase and stores it correctly', async () => {
    const register = await request(app)
      .post('/api/users/register')
      .send({ username: 'user2', passphrase: 'mysecret' })
      .set('Accept', 'application/json');

    expect(register.status).toBe(200);
    expect(register.body.secret).toBe('mysecret');
    expect(register.body.token).toBeTypeOf('string');
  });

  it('logs in with an existing user and correct passphrase', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ username: 'user3', passphrase: 'correcthorsebatterystaple' })
      .set('Accept', 'application/json');

    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'user3', passphrase: 'correcthorsebatterystaple' })
      .set('Accept', 'application/json');

    expect(login.status).toBe(200);
    expect(login.body.token).toBeTypeOf('string');
    expect(login.body.username).toBe('user3');
  });

  it('rejects login when existing user supplies an incorrect passphrase', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ username: 'user4', passphrase: 'rightpass' })
      .set('Accept', 'application/json');

    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'user4', passphrase: 'wrongpass' })
      .set('Accept', 'application/json');

    expect(login.status).toBe(401);
    expect(login.body.error).toBe('Invalid username or passphrase.');
  });
});
