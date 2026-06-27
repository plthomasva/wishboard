/** @vitest-environment node */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.resolve(__dirname, '../../data/rules.rulesManager.test.yaml');

process.env.NODE_ENV = 'test';
process.env.RULES_PATH = rulesPath;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

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
});
