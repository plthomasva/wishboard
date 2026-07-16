/** @vitest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';

// Verifies the single-node WAL opt-in: with WISHBOARD_DB_WAL=1 on a file-backed
// DB (and not in Lambda), db.js should switch the database to WAL. WAL is a
// property persisted in the file header, so an independent client can confirm it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishboard-wal-'));
const dbFile = path.join(tmpDir, 'wal.db');

process.env.NODE_ENV = 'test';
process.env.WISHBOARD_DB_PATH = dbFile;
process.env.WISHBOARD_DB_WAL = '1';
delete process.env.AWS_LAMBDA_FUNCTION_NAME;

// Importing db.js runs schema init and (given the flag + guards) sets WAL.
const { closeDb } = await import('../../src/server/db.js');

afterAll(async () => {
  await closeDb();
  delete process.env.WISHBOARD_DB_WAL;
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
});

describe('integration: WAL opt-in for single-node deployments', () => {
  it('switches the file-backed database to WAL when WISHBOARD_DB_WAL=1', async () => {
    const raw = createClient({ url: `file:${dbFile}` });
    try {
      const r = await raw.execute('PRAGMA journal_mode');
      expect(String(r.rows[0].journal_mode).toLowerCase()).toBe('wal');
    } finally {
      await raw.close();
    }
  });
});
