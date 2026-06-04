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
      searcher_genders: 'man',
      searcher_orientations: 'straight',
      q: 'wish'
    });
    
    // Straight man should see "Straight Woman wish" but NOT "Lesbian wish".
    const contents1 = resSearch1.body.map(w => w.content);
    expect(contents1).toContain('Straight Woman wish');
    expect(contents1).not.toContain('Lesbian wish');

    // 4. Search as a Lesbian Woman
    const resSearch2 = await request(app).get('/api/wishes').query({
      searcher_genders: 'woman',
      searcher_orientations: 'lesbian',
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
      searcher_roles: 'dom',
      q: 'Sub'
    });
    expect(resSearchDom.body.map(w => w.content)).toContain('Sub looking for dom');

    const resSearchSub = await request(app).get('/api/wishes').query({
      searcher_roles: 'sub',
      q: 'Sub'
    });
    expect(resSearchSub.body.map(w => w.content)).not.toContain('Sub looking for dom');
  });
});
