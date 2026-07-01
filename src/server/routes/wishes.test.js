/** @vitest-environment node */
import path from 'node:path';
const rulesPath = path.resolve(process.cwd(), 'data/rules.wishesRoute.test.yaml');

process.env.WISHBOARD_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.RULES_PATH = rulesPath;

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';

const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const app = appModule.default;
const db = (await import('../db.js')).default;
const { addRule, reloadRules } = await import('../rulesManager.js');

const clearTestData = async () => {
  await db.exec('DELETE FROM sessions');
  await db.exec('DELETE FROM wishes');
  await db.exec("DELETE FROM users WHERE role != 'admin'");
  const srcRules = path.resolve(process.cwd(), 'data/rules.yaml');
  if (fs.existsSync(srcRules)) {
    fs.copyFileSync(srcRules, rulesPath);
  }
  reloadRules();
};

beforeEach(async () => {
  await clearTestData();
});

afterEach(async () => {
  await clearTestData();
});

describe('Authenticated wish creation', () => {
  it('applies logged-in user identity attributes to created wishes', async () => {
    const register = await request(app)
      .post('/api/users/register')
      .send({
        username: 'user3',
        passphrase: 'secret',
        identity_genders: 'woman',
        identity_orientations: 'queer',
        identity_roles: 'speaker',
      })
      .set('Accept', 'application/json');

    expect(register.status).toBe(200);
    const login = await request(app)
      .post('/api/users/login')
      .send({ username: 'user3', passphrase: 'secret' })
      .set('Accept', 'application/json');

    expect(login.status).toBe(200);
    const token = login.body.token;
    expect(token).toBeTypeOf('string');

    const wishResponse = await request(app)
      .post('/api/wishes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Help me' })
      .set('Accept', 'application/json');

    expect(wishResponse.status).toBe(201);
    expect(wishResponse.body.id).toBeTypeOf('string');

    const row = await db
      .prepare(
        'SELECT creator_genders, creator_orientations, creator_roles FROM wishes WHERE id = ?'
      )
      .get(wishResponse.body.id);

    expect(JSON.parse(row.creator_genders)).toEqual(['woman']);
    expect(JSON.parse(row.creator_orientations)).toEqual(['queer']);
    expect(JSON.parse(row.creator_roles)).toEqual(['speaker']);
  });

  it('saves contacts and wishmail_enabled flag', async () => {
    const wishResponse = await request(app)
      .post('/api/wishes')
      .send({
        content: 'Contact test',
        contacts: [{ type: 'Email', value: 'test@example.com' }],
        wishmail_enabled: true,
      })
      .set('Accept', 'application/json');

    expect(wishResponse.status).toBe(201);

    const row = await db
      .prepare('SELECT contacts, wishmail_enabled FROM wishes WHERE id = ?')
      .get(wishResponse.body.id);
    expect(JSON.parse(row.contacts)).toEqual([{ type: 'Email', value: 'test@example.com' }]);
    expect(row.wishmail_enabled).toBe(1);
  });

  it('accepts multipart form data with image and returns image_id', async () => {
    // Create a 1x1 transparent PNG buffer
    const dummyImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );

    const wishResponse = await request(app)
      .post('/api/wishes')
      .attach('image', dummyImage, 'test.png')
      .field('content', 'This is my handwritten wish')
      .field('wishmail_enabled', 'true')
      .set('Accept', 'application/json');

    expect(wishResponse.status).toBe(201);
    expect(wishResponse.body.id).toBeTypeOf('string');

    const row = await db
      .prepare('SELECT content, wishmail_enabled, image_id FROM wishes WHERE id = ?')
      .get(wishResponse.body.id);
    expect(row.content).toBe('This is my handwritten wish');
    expect(row.wishmail_enabled).toBe(1);
    expect(row.image_id).toBeTypeOf('string');
    expect(row.image_id).toMatch(/image-.*\.png/);
  });

  it('rejects uploads of invalid file types', async () => {
    const dummyText = Buffer.from('this is not an image');
    const wishResponse = await request(app)
      .post('/api/wishes')
      .attach('image', dummyText, 'test.txt')
      .field('content', 'This should fail')
      .set('Accept', 'application/json');

    expect(wishResponse.status).toBe(500);
    expect(wishResponse.text).toMatch(/Invalid file type/);
  });
});

describe('Matchmaking logic', () => {
  it('correctly filters mutually compatible and incompatible wishes based on gender and orientation', async () => {
    // 1. Create Lesbian Woman wish
    await request(app).post('/api/wishes').send({
      content: 'Lesbian wish',
      creator_genders: 'woman',
      creator_orientations: 'lesbian',
      desired_genders: 'woman',
    });

    // 2. Create Straight Woman wish
    await request(app).post('/api/wishes').send({
      content: 'Straight Woman wish',
      creator_genders: 'woman',
      creator_orientations: 'straight',
      desired_genders: 'man',
    });

    // 3. Search as a Straight Man
    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'wish',
    });

    // Straight man should see "Straight Woman wish" but NOT "Lesbian wish".
    const contents1 = resSearch1.body.map((w) => w.content);
    console.log(resSearch1.body);
    expect(contents1).toContain('Straight Woman wish');
    expect(contents1).not.toContain('Lesbian wish');

    // 4. Search as a Lesbian Woman
    const resSearch2 = await request(app).get('/api/wishes').query({
      sg: 'woman',
      so: 'lesbian',
      q: 'wish',
    });

    // Lesbian woman should see "Lesbian wish" but NOT "Straight Woman wish".
    const contents2 = resSearch2.body.map((w) => w.content);
    expect(contents2).toContain('Lesbian wish');
    expect(contents2).not.toContain('Straight Woman wish');
  });

  it('correctly matches role preferences (dom/sub)', async () => {
    await request(app).post('/api/wishes').send({
      content: 'Sub looking for dom',
      creator_roles: 'sub',
      desired_roles: 'dom',
    });

    const resSearchDom = await request(app).get('/api/wishes').query({
      sr: 'dom',
      q: 'Sub',
    });
    expect(resSearchDom.body.map((w) => w.content)).toContain('Sub looking for dom');

    const resSearchSub = await request(app).get('/api/wishes').query({
      sr: 'sub',
      q: 'Sub',
    });
    expect(resSearchSub.body.map((w) => w.content)).not.toContain('Sub looking for dom');
  });

  it('correctly uses implicit preferences when desired_genders is empty', async () => {
    await request(app).post('/api/wishes').send({
      content: 'Implicit Lesbian wish',
      creator_genders: 'woman',
      creator_orientations: 'lesbian',
    });

    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'Implicit Lesbian wish',
    });

    expect(resSearch1.body).toHaveLength(0);
  });

  it('prevents straight users from matching their own gender implicitly', async () => {
    await request(app).post('/api/wishes').send({
      content: 'Straight Man wish',
      creator_genders: 'man',
      creator_orientations: 'straight',
    });

    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'Straight Man wish',
    });

    expect(resSearch1.body).toHaveLength(0);
  });

  it('allows explicit desired_genders to override implicit orientation preferences', async () => {
    await request(app).post('/api/wishes').send({
      content: 'Lesbian looking for man',
      creator_genders: 'woman',
      creator_orientations: 'lesbian',
      desired_genders: 'man',
    });

    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'Lesbian looking for man',
    });

    expect(resSearch1.body).toHaveLength(1);
  });

  it('accepts all genders when orientation is not specified', async () => {
    await request(app).post('/api/wishes').send({
      content: 'No orientation wish',
      creator_genders: 'woman',
      creator_orientations: '',
    });

    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'No orientation wish',
    });

    expect(resSearch1.body).toHaveLength(1);
  });

  it('correctly uses rule engine for expansions and cross-matches (handler/pet/pup)', async () => {
    // 1. Add rules via rulesManager
    addRule({
      id: 'r1',
      rule_type: 'expansion',
      trigger_attribute: 'role',
      trigger_value: 'pet',
      target_attribute: 'role',
      target_value: 'pup, kitten',
    });
    addRule({
      id: 'r2',
      rule_type: 'cross_match',
      trigger_attribute: 'role',
      trigger_value: 'handler',
      target_attribute: 'role',
      target_value: 'pet',
    });

    // 2. Create wish wanting a pet
    await request(app).post('/api/wishes').send({
      content: 'Looking for pet',
      desired_roles: 'pet',
    });

    // 3. Search as pup (expansion match)
    const resPup = await request(app).get('/api/wishes').query({ sr: 'pup', q: 'Looking for pet' });
    expect(resPup.body).toHaveLength(1);

    // 4. Search as handler (cross match)
    const resHandler = await request(app)
      .get('/api/wishes')
      .query({ sr: 'handler', q: 'Looking for pet' });
    expect(resHandler.body).toHaveLength(1);

    // 5. Create wish wanting a handler
    await request(app).post('/api/wishes').send({
      content: 'Looking for handler',
      desired_roles: 'handler',
    });

    // 6. Search as pet (cross match)
    const resPet = await request(app)
      .get('/api/wishes')
      .query({ sr: 'pet', q: 'Looking for handler' });
    expect(resPet.body).toHaveLength(1);

    // 7. Search as pup (expansion of cross match!)
    const resPupCross = await request(app)
      .get('/api/wishes')
      .query({ sr: 'pup', q: 'Looking for handler' });
    expect(resPupCross.body).toHaveLength(1);

    // Cleanup rules
    // Rules are handled by the afterEach hook
  });
});

describe('Claiming wishes', () => {
  it('allows an authenticated user to claim an anonymous wish with the correct passphrase', async () => {
    // 1. Create anonymous wish
    const wishRes = await request(app).post('/api/wishes').send({ content: 'Anonymous wish' });
    expect(wishRes.status).toBe(201);
    const wishId = wishRes.body.id;
    const secret = wishRes.body.secret;

    // 2. Create and login user
    await request(app)
      .post('/api/users/register')
      .send({ username: 'claimuser', passphrase: 'pwd' });
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username: 'claimuser', passphrase: 'pwd' });
    const token = loginRes.body.token;

    // 3. Claim the wish
    const claimRes = await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secret });

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.success).toBe(true);

    // 4. Verify wish is now owned by the user
    const userWishesRes = await request(app)
      .get('/api/users/me/wishes')
      .set('Authorization', `Bearer ${token}`);
    expect(userWishesRes.body).toHaveLength(1);
    expect(userWishesRes.body[0].id).toBe(wishId);
  });

  it('allows managing wish with contacts and wishmail_enabled', async () => {
    const wishRes = await request(app).post('/api/wishes').send({ content: 'Manage test' });
    const { id, secret } = wishRes.body;

    const manageRes = await request(app)
      .post(`/api/wishes/${id}/manage`)
      .send({
        secret,
        content: 'Updated content',
        contacts: [{ type: 'Phone', value: '123' }],
        wishmail_enabled: true,
        action: 'update',
      });

    expect(manageRes.status).toBe(200);

    const viewRes = await request(app).get(`/api/wishes/${id}`);
    expect(viewRes.body.content).toBe('Updated content');
    expect(viewRes.body.contacts).toEqual([{ type: 'Phone', value: '123' }]);
    expect(viewRes.body.wishmail_enabled).toBe(true);
  });

  it('prevents claiming with wrong passphrase or without auth', async () => {
    const wishRes = await request(app).post('/api/wishes').send({ content: 'Anon' });
    const wishId = wishRes.body.id;

    // Unauthenticated
    const noAuth = await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .send({ secret: wishRes.body.secret });
    expect(noAuth.status).toBe(401);

    // Wrong passphrase
    await request(app).post('/api/users/register').send({ username: 'u2', passphrase: 'p' });
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ username: 'u2', passphrase: 'p' });
    const token = loginRes.body.token;

    const wrongPass = await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secret: 'wrong' });
    expect(wrongPass.status).toBe(403);
  });

  it('correctly matches gender synonyms and variants using rules engine', async () => {
    // 1. Wish desiring 'nonbinary', searcher is 'enby' (should match)
    await request(app).post('/api/wishes').send({
      content: 'Wish for nonbinary',
      creator_genders: 'woman',
      creator_orientations: 'pan',
      desired_genders: 'nonbinary',
    });
    const resEnby = await request(app).get('/api/wishes').query({
      sg: 'enby',
      so: 'pan',
      q: 'Wish for nonbinary',
    });
    expect(resEnby.body.length).toBe(1);

    // 2. Wish desiring 'woman', searcher is 'female' (should match)
    await request(app).post('/api/wishes').send({
      content: 'Wish for woman',
      creator_genders: 'man',
      creator_orientations: 'straight',
      desired_genders: 'woman',
    });
    const resFemale = await request(app).get('/api/wishes').query({
      sg: 'female',
      so: 'straight',
      q: 'Wish for woman',
    });
    expect(resFemale.body.length).toBe(1);

    // 3. Wish desiring 'man', searcher is 'male' (should match)
    await request(app).post('/api/wishes').send({
      content: 'Wish for man',
      creator_genders: 'woman',
      creator_orientations: 'straight',
      desired_genders: 'man',
    });
    const resMale = await request(app).get('/api/wishes').query({
      sg: 'male',
      so: 'straight',
      q: 'Wish for man',
    });
    expect(resMale.body.length).toBe(1);
  });
});
