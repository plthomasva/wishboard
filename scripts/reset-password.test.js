/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, 'reset-password.js');

describe('reset-password script', () => {
  let dbPath;
  let db;

  beforeEach(() => {
    dbPath = path.resolve(__dirname, `test-reset-db-${Date.now()}.sqlite`);
    db = new Database(dbPath);
    
    db.exec(`
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
    if (db) {
      db.close();
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('resets the password when providing a username and a new passphrase', () => {
    const output = execSync(`node ${scriptPath} testuser new-secure-pass`, {
      env: { ...process.env, WISHBOARD_DB_PATH: dbPath },
      encoding: 'utf-8'
    });

    expect(output).toContain("Success! Passphrase for 'testuser' has been reset.");
    expect(output).toContain("New Passphrase: new-secure-pass");

    const user = db.prepare('SELECT passphrase_hash, passphrase_salt FROM users WHERE username = ?').get('testuser');
    expect(user.passphrase_hash).not.toBe('oldhash');
    expect(user.passphrase_salt).not.toBe('oldsalt');

    const sessions = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get('user-1').count;
    expect(sessions).toBe(0);
  });

  it('generates a new passphrase if omitted', () => {
    const output = execSync(`node ${scriptPath} testuser`, {
      env: { ...process.env, WISHBOARD_DB_PATH: dbPath },
      encoding: 'utf-8'
    });

    expect(output).toContain("Success! Passphrase for 'testuser' has been reset.");
    expect(output).toContain("New Passphrase: ");
    
    // The output should contain something like "New Passphrase: word-word-word"
    const match = output.match(/New Passphrase: (\S+-\S+-\S+)/);
    expect(match).toBeTruthy();
    const generatedPassphrase = match[1];

    const user = db.prepare('SELECT passphrase_hash, passphrase_salt FROM users WHERE username = ?').get('testuser');
    expect(user.passphrase_hash).not.toBe('oldhash');

    const sessions = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?').get('user-1').count;
    expect(sessions).toBe(0);
  });

  it('fails and exits with code 1 if user does not exist', () => {
    let error;
    try {
      execSync(`node ${scriptPath} non-existent-user`, {
        env: { ...process.env, WISHBOARD_DB_PATH: dbPath },
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(1);
    expect(error.stderr).toContain("Error: User 'non-existent-user' not found in the database.");
  });

  it('fails and prints usage if no arguments are provided', () => {
    let error;
    try {
      execSync(`node ${scriptPath}`, {
        env: { ...process.env, WISHBOARD_DB_PATH: dbPath },
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(1);
    expect(error.stderr).toContain("Usage: node reset-password.js <username> [new_passphrase]");
  });
});
