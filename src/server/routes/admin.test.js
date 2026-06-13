/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const request = (await import('supertest')).default;
const appModule = await import('../index.js');
const db = (await import('../db.js')).default;
const app = appModule.default;

const defaultAdminUsername = 'admin';
const defaultAdminSecret = 'admin-board';

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

describe('Admin routes', () => {
  const loginAsAdmin = async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({ username: defaultAdminUsername, passphrase: defaultAdminSecret })
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    return response.body.token;
  };

  it('rejects admin routes without admin credentials', async () => {
    const response = await request(app).get('/api/admin/flags');
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Admin access required.');
  });

  it('lists flagged wishes and allows removal by admin', async () => {
    const wishId = 'flagged-wish-1';
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO wishes (id, user_id, content, secret_hash, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, created_at, updated_at, flagged)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      wishId,
      null,
      'Please remove me',
      null,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      now,
      now,
      1
    );

    const token = await loginAsAdmin();

    const flagsResponse = await request(app)
      .get('/api/admin/flags')
      .set('Authorization', `Bearer ${token}`);

    expect(flagsResponse.status).toBe(200);
    expect(flagsResponse.body).toEqual([
      expect.objectContaining({ id: wishId, content: 'Please remove me', flagged: 1 })
    ]);

    const removeResponse = await request(app)
      .post(`/api/admin/wishes/${wishId}/remove`)
      .set('Authorization', `Bearer ${token}`);

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body).toEqual({ success: true });

    const flagsAfterRemoval = await request(app)
      .get('/api/admin/flags')
      .set('Authorization', `Bearer ${token}`);

    expect(flagsAfterRemoval.status).toBe(200);
    expect(flagsAfterRemoval.body).toEqual([]);
  });

  it('allows admin to clear flags individually and in bulk', async () => {
    const wishId1 = 'flagged-wish-1';
    const wishId2 = 'flagged-wish-2';
    const now = new Date().toISOString();
    const insertWish = (id) => {
      db.prepare(
        `INSERT INTO wishes (id, user_id, content, secret_hash, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, created_at, updated_at, flagged)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, null, 'Content ' + id, null,
        JSON.stringify([]), JSON.stringify([]), JSON.stringify([]),
        JSON.stringify([]), JSON.stringify([]), JSON.stringify([]),
        now, now, 1
      );
    };

    insertWish(wishId1);
    insertWish(wishId2);

    const token = await loginAsAdmin();

    // 1. Clear single flag
    const clearOneResponse = await request(app)
      .post(`/api/admin/wishes/${wishId1}/clear-flag`)
      .set('Authorization', `Bearer ${token}`);
    expect(clearOneResponse.status).toBe(200);
    expect(clearOneResponse.body).toEqual({ success: true });

    // Check flagged list - only wishId2 should be flagged
    let flagsResponse = await request(app)
      .get('/api/admin/flags')
      .set('Authorization', `Bearer ${token}`);
    expect(flagsResponse.status).toBe(200);
    expect(flagsResponse.body.length).toBe(1);
    expect(flagsResponse.body[0].id).toBe(wishId2);

    // 2. Set wishId1 flagged status back to 1 to test bulk clear
    db.prepare('UPDATE wishes SET flagged = 1 WHERE id = ?').run(wishId1);

    // Clear all flags in bulk
    const clearAllResponse = await request(app)
      .post('/api/admin/wishes/clear-all-flags')
      .set('Authorization', `Bearer ${token}`);
    expect(clearAllResponse.status).toBe(200);
    expect(clearAllResponse.body).toEqual({ success: true });

    // Check flagged list - should be empty
    flagsResponse = await request(app)
      .get('/api/admin/flags')
      .set('Authorization', `Bearer ${token}`);
    expect(flagsResponse.status).toBe(200);
    expect(flagsResponse.body).toEqual([]);
  });

  it('lists users, updates roles, and deletes user accounts', async () => {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ username: 'test-admin-flow', passphrase: 'password' })
      .set('Accept', 'application/json');

    expect(registerResponse.status).toBe(200);
    const testUserId = registerResponse.body.id;

    const token = await loginAsAdmin();

    const usersResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(usersResponse.status).toBe(200);
    expect(usersResponse.body.some((user) => user.username === 'test-admin-flow')).toBe(true);

    const promoteResponse = await request(app)
      .post(`/api/admin/users/${testUserId}/role`)
      .send({ role: 'admin' })
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    expect(promoteResponse.status).toBe(200);
    expect(promoteResponse.body).toEqual({ success: true });

    const updatedUsers = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(updatedUsers.body.find((user) => user.id === testUserId).role).toBe('admin');

    const deleteResponse = await request(app)
      .post(`/api/admin/users/${testUserId}/delete`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ success: true });

    const usersAfterDelete = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(usersAfterDelete.body.some((user) => user.id === testUserId)).toBe(false);
  });

  it('resets the demo environment and returns the correct stats', async () => {
    db.prepare('INSERT INTO wishes (id, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run('preseed-wish', 'Leave me behind', new Date().toISOString(), new Date().toISOString());

    const token = await loginAsAdmin();

    const resetResponse = await request(app)
      .post('/api/admin/reset-demo')
      .set('Authorization', `Bearer ${token}`);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body).toEqual({ message: 'Demo environment successfully seeded.', stats: { usersCreated: 50, wishesCreated: 100 } });

    const usersCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role != 'admin'").get().count;
    const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;
    const wishesCount = db.prepare('SELECT COUNT(*) AS count FROM wishes').get().count;

    expect(usersCount).toBe(50);
    expect(adminCount).toBe(1);
    expect(wishesCount).toBe(100);
  });

  it('handles not found errors for removing wishes', async () => {
    const token = await loginAsAdmin();
    const response = await request(app).post('/api/admin/wishes/non-existent/remove').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Wish not found.');
  });

  it('handles invalid roles when updating user role', async () => {
    const token = await loginAsAdmin();
    const response = await request(app).post('/api/admin/users/123/role').send({ role: 'invalid' }).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Role must be user or admin.');
  });

  it('handles not found errors for updating user role', async () => {
    const token = await loginAsAdmin();
    const response = await request(app).post('/api/admin/users/non-existent/role').send({ role: 'admin' }).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found.');
  });

  it('handles not found errors for deleting users', async () => {
    const token = await loginAsAdmin();
    const response = await request(app).post('/api/admin/users/non-existent/delete').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found.');
  });

  it('handles errors during demo reset', async () => {
    const token = await loginAsAdmin();
    const originalPrepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, 'prepare').mockImplementation((sql) => {
      if (typeof sql === 'string' && sql.includes('DELETE FROM wishes')) {
        throw new Error('Mock error');
      }
      return originalPrepare(sql);
    });
    
    const response = await request(app).post('/api/admin/reset-demo').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error during seeding');
    
    spy.mockRestore();
  });

  it('allows admin to reset a user passphrase', async () => {
    // 1. Register a test user
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({ username: 'test-reset-user', passphrase: 'old-password' })
      .set('Accept', 'application/json');

    expect(registerResponse.status).toBe(200);
    const testUserId = registerResponse.body.id;

    // 2. Login as admin
    const adminToken = await loginAsAdmin();

    // 3. Login as test user to create a session
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({ username: 'test-reset-user', passphrase: 'old-password' })
      .set('Accept', 'application/json');
    expect(loginResponse.status).toBe(200);

    const activeSessionsBefore = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get(testUserId).count;
    expect(activeSessionsBefore).toBe(2);

    // 4. Reset password as admin
    const resetResponse = await request(app)
      .post(`/api/admin/users/${testUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.success).toBe(true);
    expect(typeof resetResponse.body.newPassphrase).toBe('string');
    expect(resetResponse.body.newPassphrase.length).toBeGreaterThan(0);

    // 5. Verify sessions were deleted
    const activeSessionsAfter = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get(testUserId).count;
    expect(activeSessionsAfter).toBe(0);

    // 6. Verify old password doesn't work
    const oldLoginResponse = await request(app)
      .post('/api/users/login')
      .send({ username: 'test-reset-user', passphrase: 'old-password' })
      .set('Accept', 'application/json');
    expect(oldLoginResponse.status).toBe(401);

    // 7. Verify new password works
    const newLoginResponse = await request(app)
      .post('/api/users/login')
      .send({ username: 'test-reset-user', passphrase: resetResponse.body.newPassphrase })
      .set('Accept', 'application/json');
    expect(newLoginResponse.status).toBe(200);
  });

  it('handles not found errors for resetting password', async () => {
    const adminToken = await loginAsAdmin();
    const response = await request(app)
      .post('/api/admin/users/non-existent-user/reset-password')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found.');
  });
});
