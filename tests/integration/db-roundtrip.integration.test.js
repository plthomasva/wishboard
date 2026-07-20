/** @vitest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';

// A real, file-backed libSQL database (NOT :memory:) in a throwaway temp dir.
// The unit suite runs against :memory:, which hides the real driver, on-disk
// schema creation, and file persistence — exactly the boundary this exercises.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishboard-itest-'));
const dbFile = path.join(tmpDir, 'roundtrip.db');
const rulesPath = path.join(tmpDir, 'rules.test.yaml');

process.env.NODE_ENV = 'test';
process.env.WISHBOARD_DB_PATH = dbFile;
process.env.RULES_PATH = rulesPath;

// Matching rules are auto-seeded into the DB by rulesManager on first boot.

const request = (await import('supertest')).default;
const app = (await import('../../src/server/index.js')).default;
const { stopWatchingRules } = await import('../../src/server/rulesManager.js');

afterAll(async () => {
  stopWatchingRules?.();
  // Close the app's DB handle before removing the temp files (Windows won't
  // delete a file libSQL still holds open).
  const { closeDb } = await import('../../src/server/db.js');
  await closeDb();
  // Windows may release the libSQL file handle a beat after close; retry, then
  // give up quietly (this lives in os.tmpdir, which the OS reaps anyway).
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
});

describe('integration: file-backed libSQL round-trip', () => {
  it('creates the schema on disk and matches a persisted wish through the real driver', async () => {
    const marker = `integration wish ${Date.now()}`;

    // Create a wish through the real HTTP API → real matching engine → real DB write.
    const created = await request(app)
      .post('/api/wishes')
      .send({
        content: marker,
        creator_attributes: { gender: ['woman'], orientation: ['lesbian'] },
        desired_attributes: { gender: ['woman'] },
      });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    const wishId = created.body.id;

    // Read it back via a compatible search (real matching query against the real DB).
    const search = await request(app)
      .get('/api/wishes')
      .query({ sg: 'woman', so: 'lesbian', q: 'integration' });
    expect(search.status).toBe(200);
    expect(search.body.map((w) => w.content)).toContain(marker);

    // The database must be a real file on disk, not in-memory.
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(fs.statSync(dbFile).size).toBeGreaterThan(0);

    // Proof of real persistence: an INDEPENDENT libSQL client opens the same
    // file and sees the committed row — something :memory: could never show.
    const raw = createClient({ url: `file:${dbFile}` });
    try {
      const res = await raw.execute({
        sql: 'SELECT id, content FROM wishes WHERE id = ?',
        args: [wishId],
      });
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].content).toBe(marker);
    } finally {
      await raw.close();
    }
  });
});
