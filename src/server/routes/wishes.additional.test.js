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
    const create = await request(app)
      .post('/api/wishes')
      .send({ content: 'Anon wish' })
      .set('Accept', 'application/json');
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
    const update = await request(app)
      .post(`/api/wishes/${id}/manage`)
      .send({ secret, content: 'Anon updated' });
    expect(update.status).toBe(200);
    const row = await db.prepare('SELECT content FROM wishes WHERE id = ?').get(id);
    expect(row.content).toBe('Anon updated');

    // update with wrong secret
    const bad = await request(app)
      .post(`/api/wishes/${id}/manage`)
      .send({ secret: 'wrong', content: 'Nope' });
    expect(bad.status).toBe(403);

    // delete with correct secret
    const del = await request(app)
      .post(`/api/wishes/${id}/manage`)
      .send({ secret, action: 'delete' });
    expect(del.status).toBe(200);
    const gone = await db.prepare('SELECT id FROM wishes WHERE id = ?').get(id);
    expect(gone).toBeUndefined();
  });

  it('lets owners manage without secret', async () => {
    // register and login
    await request(app)
      .post('/api/users/register')
      .send({ username: 'owner', passphrase: 'pass' })
      .set('Accept', 'application/json');
    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'owner', passphrase: 'pass' })
      .set('Accept', 'application/json');
    const token = login.body.token;

    const create = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Owned wish' });
    expect(create.status).toBe(201);
    const id = create.body.id;

    // owner can update without secret
    const update = await request(app)
      .post(`/api/wishes/${id}/manage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Owned updated' });
    expect(update.status).toBe(200);
    const row = await db.prepare('SELECT content FROM wishes WHERE id = ?').get(id);
    expect(row.content).toBe('Owned updated');
  });

  it('returns random wishes and respects limit', async () => {
    // create 3 wishes
    await request(app)
      .post('/api/wishes')
      .send({ content: 'r1' })
      .set('Accept', 'application/json');
    await request(app)
      .post('/api/wishes')
      .send({ content: 'r2' })
      .set('Accept', 'application/json');
    await request(app)
      .post('/api/wishes')
      .send({ content: 'r3' })
      .set('Accept', 'application/json');

    const rand = await request(app).get('/api/wishes/random').query({ limit: 2 });
    expect(rand.status).toBe(200);
    expect(Array.isArray(rand.body)).toBe(true);
    expect(rand.body.length).toBeLessThanOrEqual(2);
  });

  it('returns all wishes when ignore_attributes is set', async () => {
    // create wishes with different attributes
    await request(app)
      .post('/api/wishes')
      .send({ content: 'a', desired_roles: 'bottom' })
      .set('Accept', 'application/json');
    await request(app)
      .post('/api/wishes')
      .send({ content: 'b', desired_roles: 'top' })
      .set('Accept', 'application/json');

    const res = await request(app).get('/api/wishes').query({ ignore_attributes: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('flags wishes and returns 404 for non-existent flags', async () => {
    const create = await request(app)
      .post('/api/wishes')
      .send({ content: 'flagme' })
      .set('Accept', 'application/json');
    const id = create.body.id;

    const flag = await request(app).post(`/api/wishes/${id}/flag`);
    expect(flag.status).toBe(200);

    const bad = await request(app).post('/api/wishes/notfound/flag');
    expect(bad.status).toBe(404);
  });

  it('allows excluding and un-excluding a wish for an authenticated user', async () => {
    // Register and login
    await request(app)
      .post('/api/users/register')
      .send({ username: 'user1', passphrase: 'pass' })
      .set('Accept', 'application/json');
    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'user1', passphrase: 'pass' })
      .set('Accept', 'application/json');
    const token = login.body.token;

    // Create a wish
    const create = await request(app).post('/api/wishes').send({ content: 'Wish to hide' });
    const id = create.body.id;

    // Exclude the wish
    const exclude = await request(app)
      .post(`/api/wishes/${id}/exclude`)
      .set('Authorization', `Bearer ${token}`);
    expect(exclude.status).toBe(200);

    // List exclusions
    const list = await request(app)
      .get('/api/wishes/exclusions/list')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toContain(id);

    // Search results should filter it out
    const searchBefore = await request(app)
      .get('/api/wishes')
      .set('Authorization', `Bearer ${token}`);
    expect(searchBefore.body.some((w) => w.id === id)).toBe(false);

    // Un-exclude
    const unexclude = await request(app)
      .delete(`/api/wishes/${id}/exclude`)
      .set('Authorization', `Bearer ${token}`);
    expect(unexclude.status).toBe(200);

    // Search results should show it again
    const searchAfter = await request(app)
      .get('/api/wishes')
      .set('Authorization', `Bearer ${token}`);
    expect(searchAfter.body.some((w) => w.id === id)).toBe(true);
  });

  it('filters out exclusions for anonymous users using the exclude query parameter', async () => {
    const create1 = await request(app).post('/api/wishes').send({ content: 'w1' });
    const create2 = await request(app).post('/api/wishes').send({ content: 'w2' });
    const id1 = create1.body.id;
    const id2 = create2.body.id;

    // Default search shows both
    const searchAll = await request(app).get('/api/wishes');
    expect(searchAll.body.some((w) => w.id === id1)).toBe(true);
    expect(searchAll.body.some((w) => w.id === id2)).toBe(true);

    // Exclude w1
    const searchExcl = await request(app).get('/api/wishes').query({ exclude: id1 });
    expect(searchExcl.body.some((w) => w.id === id1)).toBe(false);
    expect(searchExcl.body.some((w) => w.id === id2)).toBe(true);
  });

  it('supports bulk importing exclusions', async () => {
    // Register and login
    await request(app)
      .post('/api/users/register')
      .send({ username: 'user2', passphrase: 'pass' })
      .set('Accept', 'application/json');
    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'user2', passphrase: 'pass' })
      .set('Accept', 'application/json');
    const token = login.body.token;

    // Create 3 wishes
    const c1 = await request(app).post('/api/wishes').send({ content: 'w1' });
    const c2 = await request(app).post('/api/wishes').send({ content: 'w2' });
    await request(app).post('/api/wishes').send({ content: 'w3' });

    // Bulk import exclusions for w1 and w2
    const importRes = await request(app)
      .post('/api/wishes/exclusions/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [c1.body.id, c2.body.id] });
    expect(importRes.status).toBe(200);

    // List exclusions
    const list = await request(app)
      .get('/api/wishes/exclusions/list')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(2);
    expect(list.body).toContain(c1.body.id);
    expect(list.body).toContain(c2.body.id);
  });
});
