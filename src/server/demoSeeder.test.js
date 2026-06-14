/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { describe, expect, it } from 'vitest';
const db = (await import('./db.js')).default;
const { generateDemoData } = await import('./demoSeeder.js');

describe('generateDemoData', () => {
  it('creates 50 demo users and 100 demo wishes while preserving admin', () => {
    const stats = generateDemoData();

    expect(stats).toEqual({ usersCreated: 50, wishesCreated: 100 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role != 'admin'").get().count).toBe(50);
    expect(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM wishes').get().count).toBe(100);
  }, 15000);
});
