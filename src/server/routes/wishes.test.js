process.env.WISHBOARD_DB_PATH = ':memory:';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

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

describe('Authenticated wish creation', () => {
  it('applies logged-in user identity attributes to created wishes', async () => {
    const register = await request(app)
      .post('/api/users/register')
      .send({
        username: 'user3',
        passphrase: 'secret',
        identity_genders: 'woman',
        identity_orientations: 'queer',
        identity_roles: 'speaker'
      })
      .set('Accept', 'application/json');

    expect(register.status).toBe(200);
    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'user3', passphrase: 'secret' })
      .set('Accept', 'application/json');

    expect(login.status).toBe(200);
    const token = login.body.token;
    expect(token).toBeTypeOf('string');

    const wishResponse = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Help me' })
      .set('Accept', 'application/json');

    expect(wishResponse.status).toBe(200);
    expect(wishResponse.body.id).toBeTypeOf('string');

    const row = db
      .prepare('SELECT creator_genders, creator_orientations, creator_roles FROM wishes WHERE id = ?')
      .get(wishResponse.body.id);

    expect(JSON.parse(row.creator_genders)).toEqual(['woman']);
    expect(JSON.parse(row.creator_orientations)).toEqual(['queer']);
    expect(JSON.parse(row.creator_roles)).toEqual(['speaker']);
  });
});
