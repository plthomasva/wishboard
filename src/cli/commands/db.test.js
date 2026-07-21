/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetPassword, resetRules, setSsmToken } from './db.js';
import { promptPassphrase } from './auth.js';
import db from '../../server/db.js';

vi.mock('./auth.js', () => ({
  promptPassphrase: vi.fn(),
}));

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

  it('returns true and logs dryRun locally', async () => {
    let output = '';
    const success = await resetPassword(
      'testuser',
      'pass',
      { dryRun: true },
      (msg) => (output += msg + '\n'),
      () => {}
    );
    expect(success).toBe(true);
    expect(output).toContain("Would have reset password for 'testuser' locally.");
  });

  it('returns true and logs dryRun remotely', async () => {
    let output = '';
    const success = await resetPassword(
      'testuser',
      'pass',
      { dryRun: true, url: 'http://remote' },
      (msg) => (output += msg + '\n'),
      () => {}
    );
    expect(success).toBe(true);
    expect(output).toContain("Would have reset password for 'testuser' remotely at http://remote.");
  });

  describe('remote password reset', () => {
    const origFetch = globalThis.fetch;
    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });
    afterEach(() => {
      globalThis.fetch = origFetch;
      vi.clearAllMocks();
    });

    it('successfully resets remotely', async () => {
      vi.mocked(promptPassphrase).mockResolvedValue('admin-pass');

      // Mock login fetch
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock-token' }),
      });
      // Mock reset fetch
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ new_passphrase: 'new-remote-pass' }),
      });

      let output = '';
      const success = await resetPassword(
        'testuser',
        'pass',
        { url: 'http://remote', admin: 'admin' },
        (msg) => (output += msg + '\n'),
        () => {}
      );

      expect(success).toBe(true);
      expect(promptPassphrase).toHaveBeenCalledWith('Enter passphrase for admin: ');
      expect(output).toContain("Success! Passphrase for 'testuser' has been reset remotely.");
      expect(output).toContain('New Passphrase: new-remote-pass');
    });

    it('handles remote login failure', async () => {
      vi.mocked(promptPassphrase).mockResolvedValue('admin-pass');
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      let errOutput = '';
      const success = await resetPassword(
        'testuser',
        'pass',
        { url: 'http://remote' },
        () => {},
        (msg) => (errOutput += msg + '\n')
      );

      expect(success).toBe(false);
      expect(errOutput).toContain('Error logging in as admin: Unauthorized');
    });

    it('handles remote reset failure', async () => {
      vi.mocked(promptPassphrase).mockResolvedValue('admin-pass');
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock-token' }),
      });
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      let errOutput = '';
      const success = await resetPassword(
        'testuser',
        'pass',
        { url: 'http://remote' },
        () => {},
        (msg) => (errOutput += msg + '\n')
      );

      expect(success).toBe(false);
      expect(errOutput).toContain('Error resetting password remotely: Bad Request');
    });
  });

  describe('reset-rules script', () => {
    const origFetch = globalThis.fetch;
    beforeEach(async () => {
      // Recreate the rules table for local tests
      await db.exec(`
        CREATE TABLE IF NOT EXISTS rules (
          id TEXT PRIMARY KEY,
          rule_type TEXT NOT NULL,
          trigger_attribute TEXT NOT NULL,
          trigger_value TEXT NOT NULL,
          context_attribute TEXT,
          context_value TEXT,
          target_attribute TEXT NOT NULL,
          target_value TEXT NOT NULL
        );
      `);
      globalThis.fetch = vi.fn();
    });

    afterEach(async () => {
      globalThis.fetch = origFetch;
      await db.exec('DELETE FROM rules;');
      vi.clearAllMocks();
    });

    it('resets rules locally successfully', async () => {
      // Insert a dummy rule
      await db
        .prepare(
          `
        INSERT INTO rules (id, rule_type, trigger_attribute, trigger_value, target_attribute, target_value)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run('dummy-rule', 'expansion', 'gender', 'dummy', 'gender', 'dummy-val');

      let output = '';
      const success = await resetRules(
        {},
        (msg) => (output += msg + '\n'),
        () => {}
      );

      expect(success).toBe(true);
      expect(output).toContain('Cleared existing rules.');
      expect(output).toContain('Success! Matching rules have been reset to defaults.');

      const rulesCount = (await db.prepare('SELECT COUNT(*) AS count FROM rules').get()).count;
      expect(rulesCount).toBeGreaterThan(0);

      const dummy = await db.prepare('SELECT id FROM rules WHERE id = ?').get('dummy-rule');
      expect(dummy).toBeUndefined();
    });

    it('logs dryRun locally without changing DB', async () => {
      // Insert a dummy rule
      await db
        .prepare(
          `
        INSERT INTO rules (id, rule_type, trigger_attribute, trigger_value, target_attribute, target_value)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run('dummy-rule', 'expansion', 'gender', 'dummy', 'gender', 'dummy-val');

      let output = '';
      const success = await resetRules(
        { dryRun: true },
        (msg) => (output += msg + '\n'),
        () => {}
      );

      expect(success).toBe(true);
      expect(output).toContain('Would have reset matching rules to bundled defaults locally.');

      const dummy = await db.prepare('SELECT id FROM rules WHERE id = ?').get('dummy-rule');
      expect(dummy).toBeDefined();
      expect(dummy.id).toBe('dummy-rule');
    });

    it('logs dryRun remotely without making calls', async () => {
      let output = '';
      const success = await resetRules(
        { dryRun: true, url: 'http://remote-url' },
        (msg) => (output += msg + '\n'),
        () => {}
      );

      expect(success).toBe(true);
      expect(output).toContain(
        'Would have reset matching rules to bundled defaults remotely at http://remote-url.'
      );
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('resets rules remotely successfully', async () => {
      vi.mocked(promptPassphrase).mockResolvedValue('admin-pass');

      // Mock login fetch
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock-token' }),
      });
      // Mock reset-rules fetch
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rules_count: 49 }),
      });

      let output = '';
      const success = await resetRules(
        { url: 'http://remote-url', admin: 'admin', force: true },
        (msg) => (output += msg + '\n'),
        () => {}
      );

      expect(success).toBe(true);
      expect(promptPassphrase).toHaveBeenCalledWith('Enter passphrase for admin: ');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      // Verify reset rules call arguments
      const resetCallArgs = globalThis.fetch.mock.calls[1];
      expect(resetCallArgs[0]).toBe('http://remote-url/api/admin/reset-rules');
      expect(JSON.parse(resetCallArgs[1].body)).toEqual({ force: true });

      expect(output).toContain('Success! Matching rules have been reset to defaults.');
      expect(output).toContain('Rules re-seeded: 49');
    });

    it('handles remote login failure', async () => {
      vi.mocked(promptPassphrase).mockResolvedValue('admin-pass');

      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      let errOutput = '';
      const success = await resetRules(
        { url: 'http://remote-url' },
        () => {},
        (msg) => (errOutput += msg + '\n')
      );

      expect(success).toBe(false);
      expect(errOutput).toContain('Error logging in as admin: Unauthorized');
    });

    it('handles remote reset rules failure', async () => {
      vi.mocked(promptPassphrase).mockResolvedValue('admin-pass');

      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock-token' }),
      });
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Explicit force required' }),
      });

      let errOutput = '';
      const success = await resetRules(
        { url: 'http://remote-url' },
        () => {},
        (msg) => (errOutput += msg + '\n')
      );

      expect(success).toBe(false);
      expect(errOutput).toContain(
        'Error resetting rules remotely: Forbidden — Explicit force required'
      );
    });

    it('handles local DB failure gracefully', async () => {
      const originalPrepare = await db.prepare.bind(db);
      const spy = vi.spyOn(db, 'prepare').mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('DELETE FROM rules')) {
          throw new Error('Mock local DB failure');
        }
        return originalPrepare(sql);
      });

      let errOutput = '';
      const success = await resetRules(
        {},
        () => {},
        (msg) => (errOutput += msg + '\n')
      );

      expect(success).toBe(false);
      expect(errOutput).toContain('Error resetting rules: Mock local DB failure');
      spy.mockRestore();
    });
  });

  describe('setSsmToken', () => {
    it('previews action in dryRun mode', async () => {
      let output = '';
      const success = await setSsmToken(
        '/wishboard/dev/turso-auth-token',
        'dummy-token',
        { dryRun: true },
        (msg) => (output += msg + '\n'),
        () => {}
      );

      expect(success).toBe(true);
      expect(output).toContain('[DRY RUN] Would store SSM parameter');
    });

    it('handles SSM errors gracefully', async () => {
      let errOutput = '';
      const success = await setSsmToken(
        '/invalid/param',
        'val',
        { region: 'us-east-1' },
        () => {},
        (msg) => (errOutput += msg + '\n')
      );

      // In unit test without real AWS credentials, SSMClient call throws
      expect(success).toBe(false);
      expect(errOutput).toContain('Error setting SSM parameter');
    });
  });
});
