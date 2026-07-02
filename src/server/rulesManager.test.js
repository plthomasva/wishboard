/** @vitest-environment node */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Write the test rules file to a throwaway temp dir (reaped in afterAll) rather
// than into the repo's data/ directory.
const tmpRulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishboard-rulesmgr-'));
const rulesPath = path.join(tmpRulesDir, 'rules.test.yaml');

process.env.NODE_ENV = 'test';
process.env.RULES_PATH = rulesPath;

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let rulesManager;

describe('rulesManager', () => {
  let loggerInstance;
  let spyError;
  let spyWarn;

  beforeEach(async () => {
    if (fs.existsSync(rulesPath)) {
      fs.unlinkSync(rulesPath);
    }
    // Force re-import to reset module state
    vi.resetModules();

    // Import logger dynamically AFTER resetModules so it matches the instance used by rulesManager!
    loggerInstance = (await import('./logger.js')).default;
    rulesManager = await import('./rulesManager.js');

    // Spy on logger calls and silence them during tests
    spyError = vi.spyOn(loggerInstance, 'error').mockImplementation(() => {});
    spyWarn = vi.spyOn(loggerInstance, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (fs.existsSync(rulesPath)) {
      fs.unlinkSync(rulesPath);
    }
    vi.restoreAllMocks();
  });

  afterAll(() => {
    fs.rmSync(tmpRulesDir, { recursive: true, force: true });
  });

  it('starts with empty rules if file not found', async () => {
    expect(rulesManager.getRules()).toEqual([]);
  });

  it('loads valid YAML and populates rules', async () => {
    const validYaml = `
rules:
  - id: "rule-1"
    rule_type: "expansion"
    trigger_attribute: "role"
    trigger_value: "pet"
    target_attribute: "role"
    target_value: "pup"
`;
    fs.writeFileSync(rulesPath, validYaml, 'utf8');
    rulesManager.reloadRules();
    const rules = rulesManager.getRules();
    expect(rules.length).toBe(1);
    expect(rules[0].id).toBe('rule-1');
  });

  it('falls back to previous state on invalid YAML', async () => {
    const validYaml = `
rules:
  - id: "rule-1"
`;
    fs.writeFileSync(rulesPath, validYaml, 'utf8');
    rulesManager.reloadRules();
    expect(rulesManager.getRules().length).toBe(1);

    // write invalid yaml
    fs.writeFileSync(rulesPath, 'rules: [invalid', 'utf8');
    rulesManager.reloadRules();

    // should still be 1 (fallback)
    expect(rulesManager.getRules().length).toBe(1);

    // Assert error log and syntax error tracking
    expect(spyError).toHaveBeenCalledWith(
      'Failed to load or parse rules.yaml. Retaining previous valid rules state.',
      expect.objectContaining({ error: expect.stringContaining('YAML syntax errors') })
    );
  });

  it('keeps previous state if "rules" array is missing', () => {
    const validYaml = `
rules:
  - id: "rule-1"
`;
    fs.writeFileSync(rulesPath, validYaml, 'utf8');
    rulesManager.reloadRules();
    expect(rulesManager.getRules().length).toBe(1);

    // valid yaml but no rules array
    fs.writeFileSync(rulesPath, 'other_key: true', 'utf8');
    rulesManager.reloadRules();

    expect(rulesManager.getRules().length).toBe(1);

    expect(spyWarn).toHaveBeenCalledWith(
      'Rules file parsed but "rules" array is missing or invalid. Keeping previous state.'
    );
  });

  it('adds a new rule and saves', async () => {
    fs.writeFileSync(rulesPath, 'rules: []\n', 'utf8');
    rulesManager.reloadRules();
    rulesManager.addRule({ id: 'rule-new', rule_type: 'expansion' });

    expect(rulesManager.getRules().length).toBe(1);
    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).toContain('rule-new');
  });

  it('adds a new rule when rules key is missing in YAML file', async () => {
    fs.writeFileSync(rulesPath, 'other_key: true\n', 'utf8');
    rulesManager.reloadRules();
    rulesManager.addRule({ id: 'rule-new', rule_type: 'expansion' });

    expect(rulesManager.getRules().length).toBe(1);
    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).toContain('rule-new');
  });

  it('updates an existing rule', async () => {
    const validYaml = `
rules:
  - id: "rule-1"
    rule_type: "enrichment"
    trigger_value: "val1"
  - id: "rule-2"
    rule_type: "expansion"
    trigger_value: "old"
  - id: "rule-3"
    rule_type: "cross_match"
    trigger_value: "val3"
`;
    fs.writeFileSync(rulesPath, validYaml, 'utf8');
    rulesManager.reloadRules();

    const success = rulesManager.updateRule('rule-2', { trigger_value: 'new' });
    expect(success).toBe(true);

    const rules = rulesManager.getRules();
    expect(rules.length).toBe(3);
    expect(rules[0].trigger_value).toBe('val1');
    expect(rules[1].trigger_value).toBe('new');
    expect(rules[2].trigger_value).toBe('val3');

    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).toContain('new');
    expect(content).not.toContain('old');
  });

  it('returns false when updating a non-existent rule', async () => {
    expect(rulesManager.updateRule('does-not-exist', {})).toBe(false);
  });

  it('deletes an existing rule', async () => {
    const validYaml = `
rules:
  - id: "rule-1"
  - id: "rule-3"
  - id: "rule-4"
`;
    fs.writeFileSync(rulesPath, validYaml, 'utf8');
    rulesManager.reloadRules();

    const success = rulesManager.deleteRule('rule-3');
    expect(success).toBe(true);

    const rules = rulesManager.getRules();
    expect(rules.length).toBe(2);
    expect(rules[0].id).toBe('rule-1');
    expect(rules[1].id).toBe('rule-4');

    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).not.toContain('rule-3');
    expect(content).toContain('rule-1');
    expect(content).toContain('rule-4');
  });

  it('returns false when deleting a non-existent rule', async () => {
    expect(rulesManager.deleteRule('does-not-exist')).toBe(false);
  });

  it('handles update and delete when rules key is missing in YAML document', async () => {
    fs.writeFileSync(rulesPath, 'other_key: true\n', 'utf8');
    rulesManager.reloadRules();

    expect(rulesManager.updateRule('some-id', { trigger_value: 'val' })).toBe(false);
    expect(rulesManager.deleteRule('some-id')).toBe(false);
  });

  describe('auto-seeding rules', () => {
    const originalEnv = process.env.NODE_ENV;
    const defaultRulesVal = fs.readFileSync(
      path.resolve(__dirname, '../../data/rules.yaml'),
      'utf8'
    );

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('seeds rules if the target file does not exist', async () => {
      if (fs.existsSync(rulesPath)) {
        fs.unlinkSync(rulesPath);
      }

      vi.resetModules();
      await import('./rulesManager.js');

      expect(fs.existsSync(rulesPath)).toBe(true);
      const content = fs.readFileSync(rulesPath, 'utf8');
      expect(content).toEqual(defaultRulesVal);
    });

    it('seeds rules if the target file is empty', async () => {
      fs.writeFileSync(rulesPath, '', 'utf8');

      vi.resetModules();
      await import('./rulesManager.js');

      expect(fs.existsSync(rulesPath)).toBe(true);
      const content = fs.readFileSync(rulesPath, 'utf8');
      expect(content).toEqual(defaultRulesVal);
    });

    it('seeds rules if the target file has zero rules', async () => {
      fs.writeFileSync(rulesPath, 'rules: []\n', 'utf8');

      vi.resetModules();
      await import('./rulesManager.js');

      expect(fs.existsSync(rulesPath)).toBe(true);
      const content = fs.readFileSync(rulesPath, 'utf8');
      expect(content).toEqual(defaultRulesVal);
    });

    it('does not overwrite rules if the target file has rules', async () => {
      const customRules =
        'rules:\n  - id: custom-rule\n    rule_type: expansion\n    trigger_attribute: role\n    trigger_value: custom\n    target_attribute: role\n    target_value: custom-val\n';
      fs.writeFileSync(rulesPath, customRules, 'utf8');

      vi.resetModules();
      await import('./rulesManager.js');

      expect(fs.existsSync(rulesPath)).toBe(true);
      const content = fs.readFileSync(rulesPath, 'utf8');
      expect(content).toEqual(customRules);
    });
  });
});
