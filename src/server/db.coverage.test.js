import { describe, it, expect, afterAll } from 'vitest';
import dbWrapper, { closeDb } from './db.js';

describe('Server db.js - execute & wrapper coverage', () => {
  afterAll(() => {
    closeDb();
  });

  it('should call db.execute, db.executeMultiple through dbWrapper', async () => {
    // Note: this uses the actual in-memory db instance created during test
    const resExecute = await dbWrapper.execute('SELECT 1 as val');
    expect(resExecute.rows[0].val).toBe(1);

    await dbWrapper.executeMultiple('SELECT 1 as val; SELECT 2 as val;');
  });

  it('should handle dbWrapper.prepare run, get, all and mapArg boolean/undefined parameters', async () => {
    // Test dbWrapper.prepare.run with boolean (true/false) and undefined parameters
    const runResult = await dbWrapper
      .prepare(
        'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, is_active, identity_attributes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        'wrapper-user-1',
        'wrapperuser',
        'hash',
        'salt',
        true,
        undefined,
        new Date().toISOString()
      );

    expect(runResult.changes).toBe(1);

    // Test dbWrapper.prepare.get returning single row
    const row = await dbWrapper
      .prepare('SELECT id, is_active, identity_attributes FROM users WHERE id = ?')
      .get('wrapper-user-1');

    expect(row).toBeDefined();
    expect(row.id).toBe('wrapper-user-1');
    expect(row.is_active).toBe(1); // true mapped to 1
    expect(row.identity_attributes).toBeNull(); // undefined mapped to null

    // Test dbWrapper.prepare.all returning array
    const allRows = await dbWrapper.prepare('SELECT id FROM users WHERE is_active = ?').all(true);

    expect(Array.isArray(allRows)).toBe(true);
    expect(allRows.some((r) => r.id === 'wrapper-user-1')).toBe(true);

    // Test dbWrapper.prepare.all with false (mapped to 0)
    const inactiveRows = await dbWrapper
      .prepare('SELECT id FROM users WHERE is_active = ?')
      .all(false);

    expect(Array.isArray(inactiveRows)).toBe(true);

    // Test dbWrapper.prepare.get returning undefined for non-existent row
    const nonExistent = await dbWrapper
      .prepare('SELECT id FROM users WHERE id = ?')
      .get('non-existent-id');

    expect(nonExistent).toBeUndefined();
  });
});
