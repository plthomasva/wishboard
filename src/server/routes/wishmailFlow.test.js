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

describe('Wishmail Flow E2E', () => {
  it('allows user A to create a wish, user B to send mail, and user A to read and delete it', async () => {
    // 1. Register User A
    const resA = await request(app).post('/api/users/register').send({
      username: 'usera',
      passphrase: 'passwordA'
    });
    expect(resA.status).toBe(200);
    const tokenA = resA.body.token;

    // 2. User A creates a wish with wishmail enabled
    const wishRes = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'This is User A wish',
        wishmail_enabled: true
      });
    expect(wishRes.status).toBe(200);
    const wishId = wishRes.body.id;

    // 3. Register User B
    const resB = await request(app).post('/api/users/register').send({
      username: 'userb',
      passphrase: 'passwordB'
    });
    expect(resB.status).toBe(200);
    const tokenB = resB.body.token;

    // 4. User B sends wishmail to User A's wish
    const mailRes = await request(app)
      .post(`/api/wishes/${wishId}/mail`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        content: 'Hello User A from User B',
        return_contacts: [{ type: 'Phone', value: '555-0000' }]
      });
    expect(mailRes.status).toBe(200);
    const mailId = mailRes.body.id;

    // 5. User A reads the wishmail
    const viewRes = await request(app)
      .get(`/api/wishes/${wishId}/mail`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body).toHaveLength(1);
    expect(viewRes.body[0].id).toBe(mailId);
    expect(viewRes.body[0].content).toBe('Hello User A from User B');

    // 6. User A deletes the wishmail
    const deleteRes = await request(app)
      .delete(`/api/wishes/${wishId}/mail/${mailId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 7. Verify deletion
    const viewResAfter = await request(app)
      .get(`/api/wishes/${wishId}/mail`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(viewResAfter.status).toBe(200);
    expect(viewResAfter.body).toHaveLength(0);
  });
});
