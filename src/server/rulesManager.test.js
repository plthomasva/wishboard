/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
delete process.env.RULES_PATH;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.resolve(__dirname, '../../data/rules.test.yaml');

// We need to import dynamically so process.env.NODE_ENV is picked up, 
// and so we can clear/mock state if necessary.
let rulesManager;

describe('rulesManager', () => {
  beforeEach(async () => {
    if (fs.existsSync(rulesPath)) {
      fs.unlinkSync(rulesPath);
    }
    // force re-import to reset module state
    vi.resetModules();
    rulesManager = await import('./rulesManager.js');
  });

  afterEach(async () => {
    if (fs.existsSync(rulesPath)) {
      fs.unlinkSync(rulesPath);
    }
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
  });

  it('adds a new rule and saves', async () => {
    fs.writeFileSync(rulesPath, 'rules: []\n', 'utf8');
    rulesManager.reloadRules();
    rulesManager.addRule({ id: 'rule-new', rule_type: 'expansion' });
    
    expect(rulesManager.getRules().length).toBe(1);
    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).toContain('rule-new');
  });

  it('updates an existing rule', async () => {
    const validYaml = `
rules:
  - id: "rule-2"
    rule_type: "expansion"
    trigger_value: "old"
`;
    fs.writeFileSync(rulesPath, validYaml, 'utf8');
    rulesManager.reloadRules();

    const success = rulesManager.updateRule('rule-2', { trigger_value: 'new' });
    expect(success).toBe(true);

    const rules = rulesManager.getRules();
    expect(rules[0].trigger_value).toBe('new');

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
  - id: "rule-3"
`;
    fs.writeFileSync(rulesPath, validYaml, 'utf8');
    rulesManager.reloadRules();

    const success = rulesManager.deleteRule('rule-3');
    expect(success).toBe(true);
    expect(rulesManager.getRules().length).toBe(0);

    const content = fs.readFileSync(rulesPath, 'utf8');
    expect(content).not.toContain('rule-3');
  });

  it('returns false when deleting a non-existent rule', async () => {
    expect(rulesManager.deleteRule('does-not-exist')).toBe(false);
  });
});
