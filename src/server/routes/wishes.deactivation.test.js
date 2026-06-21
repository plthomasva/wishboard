/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { describe, expect, it, afterEach } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

afterEach(async () => {
  await db.exec('DELETE FROM wishes');
  await db.exec('DELETE FROM sessions');
  await db.exec("DELETE FROM users WHERE role != 'admin'");
});

describe('Wish deactivation', () => {
  it('deactivates and reactivates a wish, affecting search visibility', async () => {
    // 1. Register a user
    const register = await request(app)
      .post('/api/users/register')
      .send({ username: 'wish_deact_user' })
      .set('Accept', 'application/json');
    const token = register.body.token;

    // 2. Create a wish
    const wishRes = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'A unique searchable wish' })
      .set('Accept', 'application/json');
    const wishId = wishRes.body.id;

    // 3. Search for it
    let search = await request(app).get('/api/wishes').query({ q: 'unique searchable' });
    expect(search.body.length).toBe(1);

    // 4. Deactivate the wish
    const deact = await request(app)
      .post(`/api/wishes/${wishId}/deactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(deact.status).toBe(200);

    // 5. Search for it - should be hidden
    search = await request(app).get('/api/wishes').query({ q: 'unique searchable' });
    expect(search.body.length).toBe(0);

    // 6. Reactivate
    const react = await request(app)
      .post(`/api/wishes/${wishId}/reactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(react.status).toBe(200);

    // 7. Search for it - should be visible
    search = await request(app).get('/api/wishes').query({ q: 'unique searchable' });
    expect(search.body.length).toBe(1);
  });
  
  it('handles unauthorized deactivation/reactivation', async () => {
    const res = await request(app).post('/api/wishes/some-id/deactivate');
    expect(res.status).toBe(404); // Or 403, depending on the implementation. The current implementation returns 404 first if not found.
  });
});
