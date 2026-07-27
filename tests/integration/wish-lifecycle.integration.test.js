/** @vitest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishboard-wislifetest-'));
const dbFile = path.join(tmpDir, 'wish-lifecycle.db');

process.env.NODE_ENV = 'test';
process.env.WISHBOARD_DB_PATH = dbFile;
process.env.WISHBOARD_ADMIN_SECRET = 'itest-admin-passphrase';

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

describe('integration: wish lifecycle (domain attributes, deactivation, flagging, exclusion)', () => {
  it('handles creation, domain attribute matching, deactivation/reactivation, flagging, and admin removal', async () => {
    const marker = `Lifecycle Wish ${Date.now()}`;

    // 1. Create wish with domain-driven attributes
    const createRes = await request(app)
      .post('/api/wishes')
      .send({
        content: marker,
        creator_attributes: { gender: ['woman'], orientation: ['lesbian'] },
        desired_attributes: { gender: ['woman'] },
        passphrase: 'WishSecretPassphrase123',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();
    const wishId = createRes.body.id;

    // 2. Search for the wish using domain-driven attributes query
    const searchAttr = JSON.stringify({ gender: 'woman', orientation: 'lesbian' });
    const searchRes = await request(app)
      .get('/api/wishes')
      .query({ attributes: searchAttr, q: 'Lifecycle' });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.map((w) => w.id)).toContain(wishId);

    // 3. Deactivate the wish using the passphrase
    const deactRes = await request(app)
      .post(`/api/wishes/${wishId}/deactivate`)
      .send({ secret: 'WishSecretPassphrase123' }); // gitleaks:allow
    expect(deactRes.status).toBe(200);

    // Search should no longer return deactivated wish
    const searchDeact = await request(app)
      .get('/api/wishes')
      .query({ attributes: searchAttr, q: 'Lifecycle' });
    expect(searchDeact.body.map((w) => w.id)).not.toContain(wishId);

    // 4. Reactivate the wish using the passphrase
    const reactRes = await request(app)
      .post(`/api/wishes/${wishId}/reactivate`)
      .send({ secret: 'WishSecretPassphrase123' }); // gitleaks:allow
    expect(reactRes.status).toBe(200);

    // Search should return reactivated wish again
    const searchReact = await request(app)
      .get('/api/wishes')
      .query({ attributes: searchAttr, q: 'Lifecycle' });
    expect(searchReact.body.map((w) => w.id)).toContain(wishId);

    // 5. Flag the wish
    const flagRes = await request(app).post(`/api/wishes/${wishId}/flag`);
    expect(flagRes.status).toBe(200);

    // Admin login & verify flagged list
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username: 'admin', passphrase: 'itest-admin-passphrase' });
    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.token;

    const flagsRes = await request(app)
      .get('/api/admin/flags')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(flagsRes.status).toBe(200);
    expect(flagsRes.body.map((f) => f.id)).toContain(wishId);

    // 6. Admin removes wish
    const removeRes = await request(app)
      .post(`/api/admin/wishes/${wishId}/remove`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(removeRes.status).toBe(200);

    // Wish should be completely removed
    const searchRemoved = await request(app)
      .get('/api/wishes')
      .query({ attributes: searchAttr, q: 'Lifecycle' });
    expect(searchRemoved.body.map((w) => w.id)).not.toContain(wishId);
  });
});
