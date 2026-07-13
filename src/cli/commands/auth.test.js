/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAuthToken } from './auth.js';
import db from '../../server/db.js';
import readline from 'node:readline';

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

  describe('remote flow (with --url)', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('handles dry-run correctly', async () => {
      let output = '';
      vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += msg + '\n';
      });

      await generateAuthToken('admin', { url: 'https://demo.wishboards.app', dryRun: true });

      expect(output).toContain(
        '[DRY RUN] Would generate remote session token for user: admin at https://demo.wishboards.app'
      );
    });

    it('authenticates via API using provided passphrase', async () => {
      let output = '';
      vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += msg + '\n';
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'remote-session-token-123', role: 'admin' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await generateAuthToken('admin', { url: 'demo.wishboards.app', passphrase: 'mypassword' });

      expect(fetchMock).toHaveBeenCalledWith('https://demo.wishboards.app/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', passphrase: 'mypassword' }),
      });
      expect(output).toContain('Successfully generated session token for admin (admin - remote):');
      expect(output).toContain('remote-session-token-123');
    });

    it('authenticates via API prompting for passphrase if not provided (non-TTY fallback)', async () => {
      let output = '';
      vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += msg + '\n';
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'prompted-token', role: 'user' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Ensure non-TTY is mocked
      const originalIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = false;

      // Mock readline.createInterface
      const questionMock = vi.fn((query, callback) => {
        callback('promptedpassword');
      });
      const closeMock = vi.fn();

      const mockRl = {
        question: questionMock,
        close: closeMock,
      };

      vi.spyOn(readline, 'createInterface').mockReturnValue(mockRl);

      await generateAuthToken('regularuser', { url: 'http://localhost:3000' });

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'regularuser', passphrase: 'promptedpassword' }),
      });
      expect(output).toContain(
        'Successfully generated session token for regularuser (user - remote):'
      );
      expect(output).toContain('prompted-token');

      process.stdin.isTTY = originalIsTTY;
    });

    it('authenticates via API prompting for passphrase in TTY raw mode', async () => {
      let output = '';
      vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += msg + '\n';
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'tty-token', role: 'admin' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Mock TTY environment
      const originalIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;

      const setRawModeMock = vi.fn();
      const resumeMock = vi.fn();
      const pauseMock = vi.fn();
      const removeListenerMock = vi.fn();

      process.stdin.setRawMode = setRawModeMock;
      vi.spyOn(process.stdin, 'resume').mockImplementation(resumeMock);
      vi.spyOn(process.stdin, 'pause').mockImplementation(pauseMock);
      vi.spyOn(process.stdin, 'removeListener').mockImplementation(removeListenerMock);

      let dataCallback = null;
      vi.spyOn(process.stdin, 'on').mockImplementation((event, cb) => {
        if (event === 'data') {
          dataCallback = cb;
        }
        return process.stdin;
      });

      vi.spyOn(process.stdout, 'write').mockImplementation(() => {});

      // Start in background
      const promise = generateAuthToken('ttyuser', { url: 'http://localhost:3000' });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(dataCallback).toBeDefined();

      // Simulate typing: 'p', 'a', 's', backspace, 's'
      dataCallback('p');
      dataCallback('a');
      dataCallback('s');
      dataCallback('\u007f'); // backspace
      dataCallback('s');
      dataCallback('\n'); // enter

      await promise;

      expect(setRawModeMock).toHaveBeenNthCalledWith(1, true);
      expect(setRawModeMock).toHaveBeenNthCalledWith(2, false);
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ttyuser', passphrase: 'pas' }),
      });
      expect(output).toContain(
        'Successfully generated session token for ttyuser (admin - remote):'
      );
      expect(output).toContain('tty-token');

      delete process.stdin.setRawMode;
      process.stdin.isTTY = originalIsTTY;
    });

    it('handles Ctrl+C in TTY raw mode by exiting', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

      // Mock TTY environment
      const originalIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;

      process.stdin.setRawMode = vi.fn();
      vi.spyOn(process.stdin, 'resume').mockImplementation(() => {});
      vi.spyOn(process.stdin, 'pause').mockImplementation(() => {});
      vi.spyOn(process.stdin, 'removeListener').mockImplementation(() => {});

      let dataCallback = null;
      vi.spyOn(process.stdin, 'on').mockImplementation((event, cb) => {
        if (event === 'data') {
          dataCallback = cb;
        }
        return process.stdin;
      });

      vi.spyOn(process.stdout, 'write').mockImplementation(() => {});

      const _promise = generateAuthToken('ttyuser', { url: 'http://localhost:3000' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate Ctrl+C
      dataCallback('\u0003');

      expect(exitSpy).toHaveBeenCalledWith(130);

      delete process.stdin.setRawMode;
      process.stdin.isTTY = originalIsTTY;
    });

    it('throws error if auth response is not OK', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        generateAuthToken('admin', { url: 'demo.wishboards.app', passphrase: 'wrong' })
      ).rejects.toThrow('Remote auth failed: Invalid credentials');
    });

    it('throws error if auth response json format is invalid or missing token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        generateAuthToken('admin', { url: 'demo.wishboards.app', passphrase: 'pass' })
      ).rejects.toThrow('Remote server response did not include a session token.');
    });
    it('rejects gracefully if remote server returns non-JSON error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          json: () => Promise.reject(new Error('Invalid JSON')),
        })
      );

      await expect(
        generateAuthToken('admin', { url: 'https://demo.wishboards.app', passphrase: 'pass' })
      ).rejects.toThrow('Remote auth failed: 502 Bad Gateway');
    });

    it('strips trailing slashes from URL and generates remote session token', async () => {
      let output = '';
      vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += msg + '\n';
      });
      await generateAuthToken('admin', { url: 'https://demo.wishboards.app//', dryRun: true });
      expect(output).toContain(
        '[DRY RUN] Would generate remote session token for user: admin at https://demo.wishboards.app'
      );
    });
  });
});
