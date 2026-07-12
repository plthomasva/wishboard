/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAuthToken } from './auth.js';
import db from '../../server/db.js';

describe('auth token command', () => {
  beforeEach(async () => {
    // Re-create the tables for the in-memory database used in tests
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passphrase_hash TEXT NOT NULL,
        passphrase_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Insert a test user
    await db.exec(`
      INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, created_at)
      VALUES ('user-admin', 'adminuser', 'hash', 'salt', 'admin', '2023-01-01');
    `);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.exec(`
      DELETE FROM sessions;
      DELETE FROM users;
    `);
  });

  it('generates and saves a session token for an existing user', async () => {
    let output = '';
    vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += msg + '\n';
    });

    await generateAuthToken('adminuser');

    expect(output).toContain('Successfully generated session token for adminuser (admin):');

    // Extract the token (second line of output)
    const lines = output.trim().split('\n');
    const token = lines[lines.length - 1];
    expect(token).toHaveLength(48); // 24 bytes in hex is 48 chars

    // Verify it is in the database
    const session = await db
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
      .get(token);
    expect(session).toBeDefined();
    expect(session.user_id).toBe('user-admin');

    const expiryDate = new Date(session.expires_at);
    const differenceInDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(differenceInDays).toBeGreaterThan(6.9); // ~7 days
    expect(differenceInDays).toBeLessThan(7.1);
  });

  it('fails and throws an error if user does not exist', async () => {
    await expect(generateAuthToken('nonexistent')).rejects.toThrow(
      'User "nonexistent" not found in database.'
    );

    const sessionsCount = (await db.prepare('SELECT COUNT(*) AS count FROM sessions').get()).count;
    expect(sessionsCount).toBe(0);
  });

  it('handles --dry-run option and does not write to database', async () => {
    let output = '';
    vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += msg + '\n';
    });

    await generateAuthToken('adminuser', { dryRun: true });

    expect(output).toContain('[DRY RUN] Would generate session token for user: adminuser');

    const sessionsCount = (await db.prepare('SELECT COUNT(*) AS count FROM sessions').get()).count;
    expect(sessionsCount).toBe(0);
  });
});
