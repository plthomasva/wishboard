/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { describe, expect, it } from 'vitest';
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

  it('reports username existence', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ username: 'user5', passphrase: 'secret' })
      .set('Accept', 'application/json');

    const existsResponse = await request(app).get('/api/users/exists').query({ username: 'user5' });
    expect(existsResponse.status).toBe(200);
    expect(existsResponse.body.exists).toBe(true);

    const missingResponse = await request(app).get('/api/users/exists').query({ username: 'unknown' });
    expect(missingResponse.status).toBe(200);
    expect(missingResponse.body.exists).toBe(false);
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

  it('updates authenticated user attributes', async () => {
    const register = await request(app)
      .post('/api/users/register')
      .send({ username: 'user6', passphrase: 'updateme' })
      .set('Accept', 'application/json');

    const token = register.body.token;
    const update = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ identity_genders: 'non-binary', identity_orientations: 'pansexual', identity_roles: 'mentor' })
      .set('Accept', 'application/json');

    expect(update.status).toBe(200);
    expect(update.body.identity_genders).toEqual(['non-binary']);
    expect(update.body.identity_orientations).toEqual(['pansexual']);
    expect(update.body.identity_roles).toEqual(['mentor']);

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.identity_genders).toEqual(['non-binary']);
    expect(me.body.identity_orientations).toEqual(['pansexual']);
    expect(me.body.identity_roles).toEqual(['mentor']);
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

  it('persists identity attributes provided during registration', async () => {
    const register = await request(app)
      .post('/api/users/register')
      .send({
        username: 'identity_user',
        passphrase: 'testpass',
        identity_genders: 'woman',
        identity_orientations: 'bisexual',
        identity_roles: 'switch'
      })
      .set('Accept', 'application/json');

    expect(register.status).toBe(200);
    expect(register.body.identity_genders).toEqual(['woman']);
    expect(register.body.identity_orientations).toEqual(['bisexual']);
    expect(register.body.identity_roles).toEqual(['switch']);

    // Verify the attributes survive a fresh login (i.e. they were actually saved to the DB)
    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'identity_user', passphrase: 'testpass' })
      .set('Accept', 'application/json');

    expect(login.status).toBe(200);
    expect(login.body.identity_genders).toEqual(['woman']);
    expect(login.body.identity_orientations).toEqual(['bisexual']);
    expect(login.body.identity_roles).toEqual(['switch']);

    // Also verify via direct DB query for belt-and-suspenders
    const row = db.prepare('SELECT identity_genders, identity_orientations, identity_roles FROM users WHERE username = ?').get('identity_user');
    expect(JSON.parse(row.identity_genders)).toEqual(['woman']);
    expect(JSON.parse(row.identity_orientations)).toEqual(['bisexual']);
    expect(JSON.parse(row.identity_roles)).toEqual(['switch']);
  });
  it('handles missing usernames in /exists and /register', async () => {
    const exists = await request(app).get('/api/users/exists');
    expect(exists.status).toBe(400);

    const register = await request(app).post('/api/users/register').send({});
    expect(register.status).toBe(400);
  });

  it('handles registering an already existing username', async () => {
    await request(app).post('/api/users/register').send({ username: 'duplicate' });
    const duplicate = await request(app).post('/api/users/register').send({ username: 'duplicate' });
    expect(duplicate.status).toBe(409);
  });

  it('handles missing credentials in /login', async () => {
    const login1 = await request(app).post('/api/users/login').send({ username: 'u' });
    expect(login1.status).toBe(400);

    const login2 = await request(app).post('/api/users/login').send({ passphrase: 'p' });
    expect(login2.status).toBe(400);
  });

  it('handles unauthenticated requests to protected endpoints', async () => {
    const putMe = await request(app).put('/api/users/me').send({});
    expect(putMe.status).toBe(401);

    const getMe = await request(app).get('/api/users/me');
    expect(getMe.status).toBe(401);

    const getWishes = await request(app).get('/api/users/me/wishes');
    expect(getWishes.status).toBe(401);
  });

  it('handles logout by deleting the session', async () => {
    const register = await request(app).post('/api/users/register').send({ username: 'logoutuser' });
    const token = register.body.token;

    const logout = await request(app).post('/api/users/logout').set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const getMe = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(getMe.status).toBe(401);
  });
});

