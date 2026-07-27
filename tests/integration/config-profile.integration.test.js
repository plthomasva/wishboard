/** @vitest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishboard-cfgtest-'));
const dbFile = path.join(tmpDir, 'cfg.db');

process.env.NODE_ENV = 'test';
process.env.WISHBOARD_DB_PATH = dbFile;

const request = (await import('supertest')).default;
const app = (await import('../../src/server/index.js')).default;
const { stopWatchingRules } = await import('../../src/server/rulesManager.js');

afterAll(async () => {
  stopWatchingRules?.();
  const { closeDb } = await import('../../src/server/db.js');
  await closeDb();
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
});

describe('integration: event profile configuration contract', () => {
  it('serves the active event profile from real filesystem YAML config via /api/config', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);

    const body = res.body;
    expect(body.profile).toBeDefined();
    expect(Array.isArray(body.categories)).toBe(true);
    expect(body.categories.length).toBeGreaterThan(0);

    // Verify categories schema structure
    for (const cat of body.categories) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('label');
      expect(Array.isArray(cat.suggestions)).toBe(true);
    }

    // Verify contact methods and stickers
    expect(Array.isArray(body.contact_methods)).toBe(true);
    expect(body.contact_methods.length).toBeGreaterThan(0);
    expect(body.stickers).toBeDefined();
  });
});
