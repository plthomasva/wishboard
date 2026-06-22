/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

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

describe('Wishes: anonymous and authenticated flows', () => {
  it('allows anonymous creation and management via returned secret', async () => {
    const create = await request(app).post('/api/wishes').send({ content: 'Anon wish' }).set('Accept', 'application/json');
    expect(create.status).toBe(201);
    expect(create.body.id).toBeTypeOf('string');
    expect(create.body.secret).toBeTypeOf('string');

    const id = create.body.id;
    const secret = create.body.secret;

    // GET by id
    const get = await request(app).get(`/api/wishes/${id}`);
    expect(get.status).toBe(200);
    expect(get.body.content).toBe('Anon wish');

    // update with correct secret
    const update = await request(app).post(`/api/wishes/${id}/manage`).send({ secret, content: 'Anon updated' });
    expect(update.status).toBe(200);
    const row = await db.prepare('SELECT content FROM wishes WHERE id = ?').get(id);
    expect(row.content).toBe('Anon updated');

    // update with wrong secret
    const bad = await request(app).post(`/api/wishes/${id}/manage`).send({ secret: 'wrong', content: 'Nope' });
    expect(bad.status).toBe(403);

    // delete with correct secret
    const del = await request(app).post(`/api/wishes/${id}/manage`).send({ secret, action: 'delete' });
    expect(del.status).toBe(200);
    const gone = await db.prepare('SELECT id FROM wishes WHERE id = ?').get(id);
    expect(gone).toBeUndefined();
  });

  it('lets owners manage without secret', async () => {
    // register and login
    await request(app).post('/api/users/register').send({ username: 'owner', passphrase: 'pass' }).set('Accept', 'application/json');
    const login = await request(app).post('/api/users/login').send({ username: 'owner', passphrase: 'pass' }).set('Accept', 'application/json');
    const token = login.body.token;

    const create = await request(app).post('/api/wishes').set('Authorization', `Bearer ${token}`).send({ content: 'Owned wish' });
    expect(create.status).toBe(201);
    const id = create.body.id;

    // owner can update without secret
    const update = await request(app).post(`/api/wishes/${id}/manage`).set('Authorization', `Bearer ${token}`).send({ content: 'Owned updated' });
    expect(update.status).toBe(200);
    const row = await db.prepare('SELECT content FROM wishes WHERE id = ?').get(id);
    expect(row.content).toBe('Owned updated');
  });

  it('returns random wishes and respects limit', async () => {
    // create 3 wishes
    await request(app).post('/api/wishes').send({ content: 'r1' }).set('Accept', 'application/json');
    await request(app).post('/api/wishes').send({ content: 'r2' }).set('Accept', 'application/json');
    await request(app).post('/api/wishes').send({ content: 'r3' }).set('Accept', 'application/json');

    const rand = await request(app).get('/api/wishes/random').query({ limit: 2 });
    expect(rand.status).toBe(200);
    expect(Array.isArray(rand.body)).toBe(true);
    expect(rand.body.length).toBeLessThanOrEqual(2);
  });

  it('returns all wishes when ignore_attributes is set', async () => {
    // create wishes with different attributes
    await request(app).post('/api/wishes').send({ content: 'a', desired_roles: 'bottom' }).set('Accept', 'application/json');
    await request(app).post('/api/wishes').send({ content: 'b', desired_roles: 'top' }).set('Accept', 'application/json');

    const res = await request(app).get('/api/wishes').query({ ignore_attributes: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('flags wishes and returns 404 for non-existent flags', async () => {
    const create = await request(app).post('/api/wishes').send({ content: 'flagme' }).set('Accept', 'application/json');
    const id = create.body.id;

    const flag = await request(app).post(`/api/wishes/${id}/flag`);
    expect(flag.status).toBe(200);

    const bad = await request(app).post('/api/wishes/notfound/flag');
    expect(bad.status).toBe(404);
  });
});
