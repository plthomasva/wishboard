/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { describe, expect, it, afterEach } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const { createSessionToken } = await import('../auth.js');
const app = appModule.default;

afterEach(async () => {
  await db.exec('DELETE FROM wishmails');
  await db.exec('DELETE FROM wishes');
  await db.exec('DELETE FROM sessions');
  await db.exec("DELETE FROM users WHERE role != 'admin'");
});

describe('User deactivation and cascade delete', () => {
  it('previews and deletes user with cascading deletes', async () => {
    // 1. Register a user
    const register = await request(app)
      .post('/api/users/register')
      .send({ username: 'delete_me_user', passphrase: 'password' })
      .set('Accept', 'application/json');
    const token = register.body.token;

    // 2. Create a wish
    const wishRes = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'My first wish' })
      .set('Accept', 'application/json');
    const wishId = wishRes.body.id;

    // 3. Create a wishmail for that wish
    await db
      .prepare('INSERT INTO wishmails (id, wish_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run('mail1', wishId, 'A reply', new Date().toISOString());

    // 4. Preview delete
    const preview = await request(app)
      .get('/api/users/me/delete-preview')
      .set('Authorization', `Bearer ${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.wishesCount).toBe(1);
    expect(preview.body.wishmailsCount).toBe(1);

    // 5. Delete user
    const del = await request(app)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    // 6. Verify cascade
    const wishCount = (
      await db.prepare('SELECT COUNT(*) as c FROM wishes WHERE id = ?').get(wishId)
    ).c;
    expect(wishCount).toBe(0);
    const mailCount = (
      await db.prepare('SELECT COUNT(*) as c FROM wishmails WHERE id = ?').get('mail1')
    ).c;
    expect(mailCount).toBe(0);
    const userCount = (
      await db.prepare('SELECT COUNT(*) as c FROM users WHERE username = ?').get('delete_me_user')
    ).c;
    expect(userCount).toBe(0);
  });

  it('deactivates and reactivates a user', async () => {
    const register = await request(app)
      .post('/api/users/register')
      .send({ username: 'deact_user' })
      .set('Accept', 'application/json');
    const token = register.body.token;

    const deact = await request(app)
      .post('/api/users/me/deactivate')
      .set('Authorization', `Bearer ${token}`);
    expect(deact.status).toBe(200);

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.is_active).toBe(false);

    const react = await request(app)
      .post('/api/users/me/reactivate')
      .set('Authorization', `Bearer ${token}`);
    expect(react.status).toBe(200);

    const me2 = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me2.body.is_active).toBe(true);
  });

  it('handles unauthenticated requests for new endpoints', async () => {
    expect((await request(app).get('/api/users/me/delete-preview')).status).toBe(401);
    expect((await request(app).post('/api/users/me/delete')).status).toBe(401);
    expect((await request(app).post('/api/users/me/deactivate')).status).toBe(401);
    expect((await request(app).post('/api/users/me/reactivate')).status).toBe(401);
  });

  it('prevents the last admin from deleting themselves', async () => {
    // There should be exactly one admin created by default in memory DB
    const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
    expect(admin).toBeDefined();

    const token = await createSessionToken(admin.id);

    const del = await request(app)
      .post('/api/users/me/delete')
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(403);
    expect(del.body.error).toMatch(/last admin user/);
  });
});
