/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

const clearTestData = () => {
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM wishes');
  db.exec("DELETE FROM users WHERE role != 'admin'");
};

beforeEach(() => {
  clearTestData();
});

afterEach(() => {
  clearTestData();
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
        identity_roles: 'speaker'
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

    expect(wishResponse.status).toBe(200);
    expect(wishResponse.body.id).toBeTypeOf('string');

    const row = db
      .prepare('SELECT creator_genders, creator_orientations, creator_roles FROM wishes WHERE id = ?')
      .get(wishResponse.body.id);

    expect(JSON.parse(row.creator_genders)).toEqual(['woman']);
    expect(JSON.parse(row.creator_orientations)).toEqual(['queer']);
    expect(JSON.parse(row.creator_roles)).toEqual(['speaker']);
  });
});

describe('Matchmaking logic', () => {
  it('correctly filters mutually compatible and incompatible wishes based on gender and orientation', async () => {
    // 1. Create Lesbian Woman wish
    await request(app).post('/api/wishes').send({ 
      content: 'Lesbian wish', 
      creator_genders: 'woman', 
      creator_orientations: 'lesbian',
      desired_genders: 'woman' 
    });
    
    // 2. Create Straight Woman wish
    await request(app).post('/api/wishes').send({ 
      content: 'Straight Woman wish', 
      creator_genders: 'woman', 
      creator_orientations: 'straight',
      desired_genders: 'man' 
    });

    // 3. Search as a Straight Man
    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'wish'
    });
    
    // Straight man should see "Straight Woman wish" but NOT "Lesbian wish".
    const contents1 = resSearch1.body.map(w => w.content);
    expect(contents1).toContain('Straight Woman wish');
    expect(contents1).not.toContain('Lesbian wish');

    // 4. Search as a Lesbian Woman
    const resSearch2 = await request(app).get('/api/wishes').query({
      sg: 'woman',
      so: 'lesbian',
      q: 'wish'
    });
    
    // Lesbian woman should see "Lesbian wish" but NOT "Straight Woman wish".
    const contents2 = resSearch2.body.map(w => w.content);
    expect(contents2).toContain('Lesbian wish');
    expect(contents2).not.toContain('Straight Woman wish');
  });

  it('correctly matches role preferences (dom/sub)', async () => {
    await request(app).post('/api/wishes').send({ 
      content: 'Sub looking for dom', 
      creator_roles: 'sub',
      desired_roles: 'dom' 
    });

    const resSearchDom = await request(app).get('/api/wishes').query({
      sr: 'dom',
      q: 'Sub'
    });
    expect(resSearchDom.body.map(w => w.content)).toContain('Sub looking for dom');

    const resSearchSub = await request(app).get('/api/wishes').query({
      sr: 'sub',
      q: 'Sub'
    });
    expect(resSearchSub.body.map(w => w.content)).not.toContain('Sub looking for dom');
  });

  it('correctly uses implicit preferences when desired_genders is empty', async () => {
    await request(app).post('/api/wishes').send({ 
      content: 'Implicit Lesbian wish', 
      creator_genders: 'woman', 
      creator_orientations: 'lesbian'
    });
    
    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'Implicit Lesbian wish'
    });
    
    expect(resSearch1.body).toHaveLength(0);
  });

  it('prevents straight users from matching their own gender implicitly', async () => {
    await request(app).post('/api/wishes').send({ 
      content: 'Straight Man wish', 
      creator_genders: 'man', 
      creator_orientations: 'straight'
    });
    
    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'Straight Man wish'
    });
    
    expect(resSearch1.body).toHaveLength(0);
  });

  it('allows explicit desired_genders to override implicit orientation preferences', async () => {
    await request(app).post('/api/wishes').send({ 
      content: 'Lesbian looking for man', 
      creator_genders: 'woman', 
      creator_orientations: 'lesbian',
      desired_genders: 'man'
    });
    
    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'Lesbian looking for man'
    });
    
    expect(resSearch1.body).toHaveLength(1);
  });

  it('accepts all genders when orientation is not specified', async () => {
    await request(app).post('/api/wishes').send({ 
      content: 'No orientation wish', 
      creator_genders: 'woman', 
      creator_orientations: ''
    });
    
    const resSearch1 = await request(app).get('/api/wishes').query({
      sg: 'man',
      so: 'straight',
      q: 'No orientation wish'
    });
    
    expect(resSearch1.body).toHaveLength(1);
  });
});

describe('Claiming wishes', () => {
  it('allows an authenticated user to claim an anonymous wish with the correct passphrase', async () => {
    // 1. Create anonymous wish
    const wishRes = await request(app).post('/api/wishes').send({ content: 'Anonymous wish' });
    expect(wishRes.status).toBe(200);
    const wishId = wishRes.body.id;
    const secret = wishRes.body.secret;

    // 2. Create and login user
    await request(app).post('/api/users/register').send({ username: 'claimuser', passphrase: 'pwd' });
    const loginRes = await request(app).post('/api/users/login').send({ username: 'claimuser', passphrase: 'pwd' });
    const token = loginRes.body.token;

    // 3. Claim the wish
    const claimRes = await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secret });
    
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.success).toBe(true);

    // 4. Verify wish is now owned by the user
    const userWishesRes = await request(app).get('/api/users/me/wishes').set('Authorization', `Bearer ${token}`);
    expect(userWishesRes.body).toHaveLength(1);
    expect(userWishesRes.body[0].id).toBe(wishId);
  });

  it('prevents claiming with wrong passphrase or without auth', async () => {
    const wishRes = await request(app).post('/api/wishes').send({ content: 'Anon' });
    const wishId = wishRes.body.id;

    // Unauthenticated
    const noAuth = await request(app).post(`/api/wishes/${wishId}/claim`).send({ secret: wishRes.body.secret });
    expect(noAuth.status).toBe(401);

    // Wrong passphrase
    await request(app).post('/api/users/register').send({ username: 'u2', passphrase: 'p' });
    const loginRes = await request(app).post('/api/users/login').send({ username: 'u2', passphrase: 'p' });
    const token = loginRes.body.token;

    const wrongPass = await request(app)
      .post(`/api/wishes/${wishId}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secret: 'wrong' });
    expect(wrongPass.status).toBe(403);
  });
});
