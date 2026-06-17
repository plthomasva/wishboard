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

describe('Wishmail routes', () => {
  it('allows sending wishmail to a wish with wishmail enabled', async () => {
    const wishRes = await request(app).post('/api/wishes').send({
      content: 'Wishmail test',
      wishmail_enabled: true
    });
    expect(wishRes.status).toBe(201);
    const wishId = wishRes.body.id;

    const mailRes = await request(app).post(`/api/wishes/${wishId}/mail`).send({
      content: 'Hello creator',
      return_contacts: [{ type: 'Email', value: 'test@example.com' }]
    });
    expect(mailRes.status).toBe(200);
    expect(mailRes.body.success).toBe(true);
    expect(mailRes.body.id).toBeTypeOf('string');
  });

  it('rejects sending wishmail to a wish with wishmail disabled', async () => {
    const wishRes = await request(app).post('/api/wishes').send({
      content: 'Wishmail disabled test',
      wishmail_enabled: false
    });
    const wishId = wishRes.body.id;

    const mailRes = await request(app).post(`/api/wishes/${wishId}/mail`).send({
      content: 'Hello'
    });
    expect(mailRes.status).toBe(403);
    expect(mailRes.body.error).toMatch(/not enabled/i);
  });

  it('allows creator to view and manage their wishmail using wish secret', async () => {
    const wishRes = await request(app).post('/api/wishes').send({
      content: 'My wish',
      wishmail_enabled: true
    });
    const { id: wishId, secret } = wishRes.body;

    await request(app).post(`/api/wishes/${wishId}/mail`).send({
      content: 'Incoming msg',
      return_contacts: [{ type: 'Phone', value: '123' }]
    });

    const viewResFail = await request(app).get(`/api/wishes/${wishId}/mail`).set('x-wish-secret', 'wrong');
    expect(viewResFail.status).toBe(403);

    const viewResSuccess = await request(app).get(`/api/wishes/${wishId}/mail`).set('x-wish-secret', secret);
    expect(viewResSuccess.status).toBe(200);
    expect(viewResSuccess.body).toHaveLength(1);
    expect(viewResSuccess.body[0].content).toBe('Incoming msg');
    expect(viewResSuccess.body[0].return_contacts[0].type).toBe('Phone');
    expect(viewResSuccess.body[0].read).toBe(false);

    const mailId = viewResSuccess.body[0].id;

    const readRes = await request(app).post(`/api/wishes/${wishId}/mail/${mailId}/read`).send({ secret });
    expect(readRes.status).toBe(200);

    const viewResAfter = await request(app).get(`/api/wishes/${wishId}/mail`).set('x-wish-secret', secret);
    expect(viewResAfter.body[0].read).toBe(true);
  });
});
