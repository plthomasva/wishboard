/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

const clearTestData = () => {
  db.exec('DELETE FROM wishmails');
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM wishes');
  db.exec("DELETE FROM users WHERE role != 'admin'");
};

beforeEach(() => clearTestData());
afterEach(() => clearTestData());

describe('Wishmail routes coverage', () => {
  it('handles missing content in POST /', async () => {
    const wishRes = await request(app).post('/api/wishes').send({ content: 'Wishmail test', wishmail_enabled: true });
    const wishId = wishRes.body.id;

    const noContent = await request(app).post(`/api/wishes/${wishId}/mail`).send({});
    expect(noContent.status).toBe(400);
  });

  it('handles nonexistent wish across endpoints', async () => {
    const postRes = await request(app).post('/api/wishes/nonexistent/mail').send({ content: 'a' });
    expect(postRes.status).toBe(404);

    const getRes = await request(app).get('/api/wishes/nonexistent/mail');
    expect(getRes.status).toBe(404);

    const readRes = await request(app).post('/api/wishes/nonexistent/mail/123/read').send({});
    expect(readRes.status).toBe(404);

    const deleteRes = await request(app).delete('/api/wishes/nonexistent/mail/123');
    expect(deleteRes.status).toBe(404);
  });

  it('handles authorization and nonexistent mail in POST /read and DELETE', async () => {
    // Create wish with auth
    await request(app).post('/api/users/register').send({ username: 'mailowner', passphrase: 'pwd' });
    const login = await request(app).post('/api/users/login').send({ username: 'mailowner', passphrase: 'pwd' });
    const token = login.body.token;

    const wishRes = await request(app).post('/api/wishes').set('Authorization', `Bearer ${token}`).send({ content: 'auth wish', wishmail_enabled: true });
    const wishId = wishRes.body.id;

    // Send mail
    const mailRes = await request(app).post(`/api/wishes/${wishId}/mail`).send({ content: 'msg' });
    const mailId = mailRes.body.id;

    // Try unauthorized read
    const unauthorizedRead = await request(app).post(`/api/wishes/${wishId}/mail/${mailId}/read`).send({});
    expect(unauthorizedRead.status).toBe(403);

    // Try unauthorized delete
    const unauthorizedDelete = await request(app).delete(`/api/wishes/${wishId}/mail/${mailId}`);
    expect(unauthorizedDelete.status).toBe(403);

    // Authorized read by user
    const authorizedRead = await request(app).post(`/api/wishes/${wishId}/mail/${mailId}/read`).set('Authorization', `Bearer ${token}`).send({});
    expect(authorizedRead.status).toBe(200);

    // Nonexistent mail id read (authorized but mailId doesn't exist for this wish)
    const notFoundRead = await request(app).post(`/api/wishes/${wishId}/mail/badId/read`).set('Authorization', `Bearer ${token}`).send({});
    expect(notFoundRead.status).toBe(404);

    // Authorized delete by user
    const authorizedDelete = await request(app).delete(`/api/wishes/${wishId}/mail/${mailId}`).set('Authorization', `Bearer ${token}`);
    expect(authorizedDelete.status).toBe(200);

    // Nonexistent mail id delete
    const notFoundDelete = await request(app).delete(`/api/wishes/${wishId}/mail/badId`).set('Authorization', `Bearer ${token}`);
    expect(notFoundDelete.status).toBe(404);
  });

  it('handles passphrase authorization for DELETE', async () => {
    const wishRes = await request(app).post('/api/wishes').send({ content: 'Anon wish', wishmail_enabled: true });
    const wishId = wishRes.body.id;
    const secret = wishRes.body.secret;

    const mailRes = await request(app).post(`/api/wishes/${wishId}/mail`).send({ content: 'msg' });
    const mailId = mailRes.body.id;

    // Unauthorized delete (wrong secret)
    const badSecretDelete = await request(app).delete(`/api/wishes/${wishId}/mail/${mailId}`).set('x-wish-secret', 'wrong');
    expect(badSecretDelete.status).toBe(403);

    // Authorized delete
    const authDelete = await request(app).delete(`/api/wishes/${wishId}/mail/${mailId}`).set('x-wish-secret', secret);
    expect(authDelete.status).toBe(200);
  });
});

