/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Each test re-imports against a fresh in-memory DB (db.js uses :memory: under
// NODE_ENV=test), which rulesManager auto-seeds with the bundled defaults on boot.
const importFresh = async (env = {}) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const db = (await import('./db.js')).default;
  const rm = await import('./rulesManager.js');
  return { db, rm };
};

const fullRule = (over = {}) => ({
  id: 'rule-1',
  rule_type: 'expansion',
  trigger_attribute: 'gender',
  trigger_value: 'woman',
  context_attribute: null,
  context_value: null,
  target_attribute: 'gender',
  target_value: 'woman, female',
  ...over,
});

const insertDirect = (db, id) =>
  db.execute({
    sql: 'INSERT INTO rules (id, rule_type, trigger_attribute, trigger_value, target_attribute, target_value) VALUES (?,?,?,?,?,?)',
    args: [id, 'expansion', 'gender', 'woman', 'gender', 'women'],
  });

describe('rulesManager (DB-backed)', () => {
  let db;
  let rm;

  beforeEach(async () => {
    ({ db, rm } = await importFresh());
  });

  afterEach(() => {
    delete process.env.RULES_CACHE_TTL_MS;
  });

  it('seeds the 29 bundled default rules into a fresh database on boot', () => {
    expect(rm.getRules().length).toBe(29);
  });

  it('seedIfEmpty is a no-op when rules already exist', async () => {
    await rm.seedIfEmpty();
    expect(rm.getRules().length).toBe(29); // not doubled
  });

  it('seedIfEmpty repopulates an empty table with the defaults', async () => {
    await db.execute('DELETE FROM rules');
    await rm.seedIfEmpty();
    await rm.reloadRules();
    expect(rm.getRules().length).toBe(29);
  });

  describe('CRUD against an empty table', () => {
    beforeEach(async () => {
      await db.execute('DELETE FROM rules');
      await rm.reloadRules();
      expect(rm.getRules()).toEqual([]);
    });

    it('addRule inserts and updates the cache + DB', async () => {
      await rm.addRule(fullRule());
      expect(rm.getRules().length).toBe(1);
      await rm.reloadRules();
      expect(rm.getRules()[0].id).toBe('rule-1');
    });

    it('updateRule merges fields and persists', async () => {
      await rm.addRule(fullRule());
      expect(await rm.updateRule('rule-1', { trigger_value: 'man' })).toBe(true);
      await rm.reloadRules();
      expect(rm.getRules()[0].trigger_value).toBe('man');
    });

    it('updateRule returns false for an unknown id', async () => {
      expect(await rm.updateRule('nope', { trigger_value: 'x' })).toBe(false);
    });

    it('deleteRule removes from the cache + DB', async () => {
      await rm.addRule(fullRule());
      expect(await rm.deleteRule('rule-1')).toBe(true);
      await rm.reloadRules();
      expect(rm.getRules()).toEqual([]);
    });

    it('deleteRule returns false for an unknown id', async () => {
      expect(await rm.deleteRule('nope')).toBe(false);
    });
  });

  it('reloadRules picks up changes written directly to the DB', async () => {
    await db.execute('DELETE FROM rules');
    await rm.reloadRules();
    await insertDirect(db, 'ext-1');
    await rm.reloadRules();
    expect(rm.getRules().map((r) => r.id)).toContain('ext-1');
  });

  it('getRules triggers a background reload once the cache is stale (TTL)', async () => {
    ({ db, rm } = await importFresh({ RULES_CACHE_TTL_MS: '0' }));
    await db.execute('DELETE FROM rules');
    await rm.reloadRules();
    expect(rm.getRules().length).toBe(0);

    // Another instance writes a rule straight to the shared DB.
    await insertDirect(db, 'ext-2');

    // TTL=0 means the cache is immediately stale, so getRules kicks a background
    // reload (fire-and-forget). Poll until that reload lands the external change.
    await vi.waitFor(
      () => {
        rm.getRules(); // trigger the background refresh
        expect(rm.getRules().map((r) => r.id)).toContain('ext-2');
      },
      { timeout: 1000, interval: 20 }
    );
  });

  it('stopWatchingRules is a no-op (file watcher removed with the DB migration)', () => {
    expect(() => rm.stopWatchingRules()).not.toThrow();
  });
});
