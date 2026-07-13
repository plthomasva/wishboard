/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetPassword } from './db.js';
import db from '../../server/db.js';

describe('reset-password script', () => {
  beforeEach(async () => {
    // db is already initialized with :memory: from vitest setup
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passphrase_hash TEXT NOT NULL,
        passphrase_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        identity_genders TEXT,
        identity_orientations TEXT,
        identity_roles TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.exec(`
      INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, created_at)
      VALUES ('user-1', 'testuser', 'oldhash', 'oldsalt', 'user', '2023-01-01');
    `);
    await db.exec(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES ('session-1', 'user-1', '2099-01-01');
    `);
  });

  afterEach(async () => {
    await db.exec(`
      DELETE FROM sessions;
      DELETE FROM users;
    `);
  });

  it('resets the password when providing a username and a new passphrase', async () => {
    let output = '';
    const success = await resetPassword(
      'testuser',
      'new-secure-pass',
      {},
      (msg) => (output += msg + '\n'),
      () => {}
    );

    expect(success).toBe(true);
    expect(output).toContain("Success! Passphrase for 'testuser' has been reset locally.");
    expect(output).toContain('New Passphrase: new-secure-pass');

    const user = await db
      .prepare('SELECT passphrase_hash, passphrase_salt FROM users WHERE username = ?')
      .get('testuser');
    expect(user.passphrase_hash).not.toBe('oldhash');
    expect(user.passphrase_salt).not.toBe('oldsalt');

    const sessions = (
      await db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get('user-1')
    ).count;
    expect(sessions).toBe(0);
  }, 15000);

  it('generates a new passphrase if omitted', async () => {
    let output = '';
    const success = await resetPassword(
      'testuser',
      undefined,
      {},
      (msg) => (output += msg + '\n'),
      () => {}
    );

    expect(success).toBe(true);
    expect(output).toContain("Success! Passphrase for 'testuser' has been reset locally.");
    expect(output).toContain('New Passphrase: ');

    const match = /New Passphrase: (\S+-\S+-\S+)/.exec(output);
    expect(match).toBeTruthy();

    const user = await db
      .prepare('SELECT passphrase_hash, passphrase_salt FROM users WHERE username = ?')
      .get('testuser');
    expect(user.passphrase_hash).not.toBe('oldhash');

    const sessions = (
      await db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get('user-1')
    ).count;
    expect(sessions).toBe(0);
  });

  it('fails and returns false if user does not exist', async () => {
    let errorOutput = '';
    const success = await resetPassword(
      'non-existent-user',
      undefined,
      {},
      () => {},
      (msg) => (errorOutput += msg + '\n')
    );

    expect(success).toBe(false);
    expect(errorOutput).toContain("Error: User 'non-existent-user' not found in the database.");
  });
});
