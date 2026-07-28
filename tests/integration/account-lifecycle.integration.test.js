/** @vitest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishboard-acclifetest-'));
const dbFile = path.join(tmpDir, 'account-lifecycle.db');

process.env.NODE_ENV = 'test';
process.env.WISHBOARD_DB_PATH = dbFile;

const request = (await import('supertest')).default;
const app = (await import('../../src/server/index.js')).default;
const { stopWatchingRules } = await import('../../src/server/rulesManager.js');

afterAll(async () => {
  stopWatchingRules?.();
  const { closeDb } = await import('../../src/server/db.js');
  await closeDb();
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
});

describe('integration: user account lifecycle & wishmail contract', () => {
  it('registers, manages profile, claims wishes, deactivates/reactivates, and exchanges wishmail', async () => {
    const userA = `userA_${Date.now()}`;
    const userB = `userB_${Date.now()}`;
    const passphraseA = 'PassphraseUserA123!';
    const passphraseB = 'PassphraseUserB123!';

    // 1. Register User A with attributes
    const regResA = await request(app)
      .post('/api/users/register')
      .send({
        username: userA,
        passphrase: passphraseA,
        identity_attributes: { gender: ['woman'], orientation: ['lesbian'], role: ['switch'] },
        contacts: [{ type: 'Email', value: 'usera@example.com' }],
        wishmail_enabled: true,
      });
    expect(regResA.status).toBe(200);
    expect(regResA.body.token).toBeTruthy();
    const tokenA = regResA.body.token;

    // 2. Register User B
    const regResB = await request(app)
      .post('/api/users/register')
      .send({
        username: userB,
        passphrase: passphraseB,
        identity_attributes: { gender: ['woman'], orientation: ['lesbian'], role: ['switch'] },
        contacts: [{ type: 'Email', value: 'userb@example.com' }],
        wishmail_enabled: true,
      });
    expect(regResB.status).toBe(200);
    const tokenB = regResB.body.token;

    // 3. User A creates a wish as logged-in user
    const wishRes = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        content: 'User A Wish for Coffee',
        wishmail_enabled: true,
      });
    expect(wishRes.status).toBe(201);
    const wishId = wishRes.body.id;

    // 4. User B sends wishmail on User A's wish
    const mailSendRes = await request(app)
      .post(`/api/wishes/${wishId}/mail`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        content: 'Hi User A! I want to meet for coffee.',
        return_contacts: [{ type: 'Email', value: 'userb@example.com' }],
      });
    expect(mailSendRes.status).toBe(200);

    // 5. User A reads wishmail
    const mailGetRes = await request(app)
      .get(`/api/wishes/${wishId}/mail`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(mailGetRes.status).toBe(200);
    expect(Array.isArray(mailGetRes.body)).toBe(true);
    expect(mailGetRes.body.length).toBe(1);
    expect(mailGetRes.body[0].content).toContain('meet for coffee');

    // 6. User A updates profile attributes
    const updateAttrRes = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        identity_attributes: { gender: ['woman', 'non-binary'], orientation: ['queer'] },
      });
    expect(updateAttrRes.status).toBe(200);
    expect(updateAttrRes.body.identity_attributes.gender).toContain('non-binary');

    // 7. User A claims an anonymous wish
    const anonWishRes = await request(app).post('/api/wishes').send({
      content: 'Anonymous wish to be claimed',
      passphrase: 'ClaimPassphrase789',
    });
    expect(anonWishRes.status).toBe(201);
    const claimWishId = anonWishRes.body.id;

    const claimRes = await request(app)
      .post(`/api/wishes/${claimWishId}/claim`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ secret: 'ClaimPassphrase789' }); // gitleaks:allow
    expect(claimRes.status).toBe(200);

    // 8. User A deactivates account
    const deactRes = await request(app)
      .post('/api/users/me/deactivate')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(deactRes.status).toBe(200);

    // Attempting login while deactivated returns is_active = false
    const deactLoginRes = await request(app)
      .post('/api/users/login')
      .send({ username: userA, passphrase: passphraseA });
    expect(deactLoginRes.status).toBe(200);
    expect(deactLoginRes.body.is_active).toBe(false);

    // Reactivate account
    const reactRes = await request(app)
      .post('/api/users/me/reactivate')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(reactRes.status).toBe(200);

    // Login should reflect is_active = true again
    const reactLoginRes = await request(app)
      .post('/api/users/login')
      .send({ username: userA, passphrase: passphraseA });
    expect(reactLoginRes.status).toBe(200);
    expect(reactLoginRes.body.is_active).toBe(true);
  });
});
