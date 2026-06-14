/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetPassword } from './reset-password.js';
import db from '../src/server/db.js';

describe('reset-password script', () => {
  beforeEach(() => {
    // db is already initialized with :memory: from vitest setup
    db.exec(`
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

    db.exec(`
      INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, created_at)
      VALUES ('user-1', 'testuser', 'oldhash', 'oldsalt', 'user', '2023-01-01');
    `);
    db.exec(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES ('session-1', 'user-1', '2099-01-01');
    `);
  });

  afterEach(() => {
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM users;
    `);
  });

  it('resets the password when providing a username and a new passphrase', async () => {
    let output = '';
    const success = await resetPassword(['testuser', 'new-secure-pass'], (msg) => output += msg + '\n', () => {});
    
    expect(success).toBe(true);
    expect(output).toContain("Success! Passphrase for 'testuser' has been reset.");
    expect(output).toContain("New Passphrase: new-secure-pass");

    const user = db.prepare('SELECT passphrase_hash, passphrase_salt FROM users WHERE username = ?').get('testuser');
    expect(user.passphrase_hash).not.toBe('oldhash');
    expect(user.passphrase_salt).not.toBe('oldsalt');

    const sessions = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get('user-1').count;
    expect(sessions).toBe(0);
  });

  it('generates a new passphrase if omitted', async () => {
    let output = '';
    const success = await resetPassword(['testuser'], (msg) => output += msg + '\n', () => {});

    expect(success).toBe(true);
    expect(output).toContain("Success! Passphrase for 'testuser' has been reset.");
    expect(output).toContain("New Passphrase: ");

    const match = output.match(/New Passphrase: (\S+-\S+-\S+)/);
    expect(match).toBeTruthy();

    const user = db.prepare('SELECT passphrase_hash, passphrase_salt FROM users WHERE username = ?').get('testuser');
    expect(user.passphrase_hash).not.toBe('oldhash');

    const sessions = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get('user-1').count;
    expect(sessions).toBe(0);
  });

  it('fails and returns false if user does not exist', async () => {
    let errorOutput = '';
    const success = await resetPassword(['non-existent-user'], () => {}, (msg) => errorOutput += msg + '\n');

    expect(success).toBe(false);
    expect(errorOutput).toContain("Error: User 'non-existent-user' not found in the database.");
  });

  it('fails and prints usage if no arguments are provided', async () => {
    let errorOutput = '';
    const success = await resetPassword([], () => {}, (msg) => errorOutput += msg + '\n');

    expect(success).toBe(false);
    expect(errorOutput).toContain("Usage: node reset-password.js <username> [new_passphrase]");
  });
});
