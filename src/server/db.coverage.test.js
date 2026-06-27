import { describe, it, expect, vi } from 'vitest';
import dbWrapper from './db.js';

describe('Server db.js - execute coverage', () => {
  it('should call db.execute and db.executeMultiple through dbWrapper', async () => {
    // Note: this uses the actual in-memory db instance created during test
    // We can just execute a simple safe statement
    const resExecute = await dbWrapper.execute('SELECT 1 as val');
    expect(resExecute.rows[0].val).toBe(1);

    const resMultiple = await dbWrapper.executeMultiple('SELECT 1 as val; SELECT 2 as val;');
    // sqlite-sync returns an array for multiple statements, or the last result
    // We just expect it to not throw
    expect(resMultiple).toBeDefined();
  });
});
