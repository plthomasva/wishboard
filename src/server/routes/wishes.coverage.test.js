/** @vitest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Throwaway temp dir for the legacy RULES_PATH (reaped in afterAll). The DB-backed
// rulesManager auto-seeds the default rules, so nothing is copied in.
const tmpRulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishboard-wishes-cov-'));
const testRules = path.join(tmpRulesDir, 'rules.test.yaml');

process.env.WISHBOARD_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.RULES_PATH = testRules;

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;
const { reloadRules, stopWatchingRules } = await import('../rulesManager.js');

const clearTestData = async () => {
  await db.exec('DELETE FROM sessions');
  await db.exec('DELETE FROM wishes');
  await db.exec("DELETE FROM users WHERE role != 'admin'");
  await reloadRules();
};

beforeEach(async () => {
  await clearTestData();
});

afterEach(async () => {
  await clearTestData();
});

afterAll(() => {
  stopWatchingRules();
  fs.rmSync(tmpRulesDir, { recursive: true, force: true });
});

describe('wishes.js coverage', () => {
  it('covers various matchmaking branches', async () => {
    // pan/queer
    await request(app)
      .post('/api/wishes')
      .send({
        content: 'Queer wish',
        creator_attributes: { gender: ['man'], orientation: ['queer'] },
        desired_attributes: { gender: ['trans-man'] },
      });
    const resQueer = await request(app)
      .get('/api/wishes')
      .query({ sg: 'trans-man', so: 'gay', q: 'Queer wish' });
    expect(resQueer.body.length).toBe(1);

    // bi/bisexual
    await request(app)
      .post('/api/wishes')
      .send({
        content: 'Bi wish',
        creator_attributes: { gender: ['man'], orientation: ['bisexual'] },
        desired_attributes: { gender: ['woman'] },
      });
    const resBi = await request(app)
      .get('/api/wishes')
      .query({ sg: 'woman', so: 'straight', q: 'Bi wish' });
    expect(resBi.body.length).toBe(1);

    // gay/homosexual with woman
    await request(app)
      .post('/api/wishes')
      .send({
        content: 'Gay woman wish',
        creator_attributes: { gender: ['woman'], orientation: ['homosexual'] },
        desired_attributes: { gender: ['woman'] },
      });
    const resGayW = await request(app)
      .get('/api/wishes')
      .query({ sg: 'woman', so: 'lesbian', q: 'Gay woman wish' });
    expect(resGayW.body.length).toBe(1);

    // gay/homosexual with man
    await request(app)
      .post('/api/wishes')
      .send({
        content: 'Gay man wish',
        creator_attributes: { gender: ['man'], orientation: ['homosexual'] },
        desired_attributes: { gender: ['man'] },
      });
    const resGayM = await request(app)
      .get('/api/wishes')
      .query({ sg: 'man', so: 'gay', q: 'Gay man wish' });
    expect(resGayM.body.length).toBe(1);

    // empty accepted gender set
    const resEmptySet = await request(app)
      .get('/api/wishes')
      .query({ sg: 'alien', so: 'alien', q: 'Gay man wish' });
    expect(resEmptySet.body.length).toBe(0);

    // empty searcher roles
    await request(app)
      .post('/api/wishes')
      .send({
        content: 'Role wish',
        creator_attributes: { role: ['top'] },
        desired_attributes: { role: ['bottom'] },
      });
    const resNoRole = await request(app)
      .get('/api/wishes')
      .query({ so: 'straight', sr: '', q: 'Role wish' });
    expect(resNoRole.body.length).toBe(0);

    // empty searcher orientation in matchesPreference
    await request(app).post('/api/wishes').send({
      content: 'Orient wish',
      creator_orientations: 'gay',
      desired_orientations: 'straight',
    });
    const resNoOrient = await request(app)
      .get('/api/wishes')
      .query({ so: '', sg: 'woman', q: 'Orient wish' });
    expect(resNoOrient.body.length).toBe(0);
  });

  it('covers POST / validation', async () => {
    const res = await request(app).post('/api/wishes').send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('covers GET /:id nonexistent', async () => {
    const res = await request(app).get('/api/wishes/nonexistent');
    expect(res.status).toBe(404);
  });

  it('covers POST /:id/manage errors', async () => {
    const res404 = await request(app)
      .post('/api/wishes/nonexistent/manage')
      .send({ action: 'delete' });
    expect(res404.status).toBe(404);

    const wishRes = await request(app).post('/api/wishes').send({ content: 'test' });
    const wishId = wishRes.body.id;

    const noSecret = await request(app)
      .post(`/api/wishes/${wishId}/manage`)
      .send({ action: 'delete' });
    expect(noSecret.status).toBe(401);

    // Remove secret hash to test "Invalid secret token." 403
    await db.prepare('UPDATE wishes SET secret_hash = NULL WHERE id = ?').run(wishId);
    const invalidSecret = await request(app)
      .post(`/api/wishes/${wishId}/manage`)
      .send({ action: 'delete', secret: 'test' });
    expect(invalidSecret.status).toBe(403);

    // Bad payload on a fresh wish
    const wishRes2 = await request(app).post('/api/wishes').send({ content: 'test2' });
    const badPayload = await request(app)
      .post(`/api/wishes/${wishRes2.body.id}/manage`)
      .send({ secret: wishRes2.body.secret, action: 'unknown' });
    expect(badPayload.status).toBe(400);
  });

  it('covers POST /:id/claim errors', async () => {
    const wishRes = await request(app).post('/api/wishes').send({ content: 'test' });
    const wishId = wishRes.body.id;

    await request(app).post('/api/users/register').send({ username: 'u1', passphrase: 'p1' });
    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'u1', passphrase: 'p1' });
    const token = login.body.token;

    const noSecret = await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(noSecret.status).toBe(400);

    const notFound = await request(app)
      .post(`/api/wishes/nonexistent/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secret: 'a' });
    expect(notFound.status).toBe(404);

    await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secret: wishRes.body.secret });

    // already claimed
    const already = await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secret: 'a' });
    expect(already.status).toBe(403);

    // cannot be claimed
    await request(app).post('/api/users/register').send({ username: 'u2', passphrase: 'p2' });
    const login2 = await request(app)
      .post('/api/users/login')
      .send({ username: 'u2', passphrase: 'p2' });
    const token2 = login2.body.token;

    const unclaimableWish = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'auth wish' });
    const unclaimable = await request(app)
      .post(`/api/wishes/${unclaimableWish.body.id}/claim`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ secret: 'a' });
    expect(unclaimable.status).toBe(403);
  });
});
