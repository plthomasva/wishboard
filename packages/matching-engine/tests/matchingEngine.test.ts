import { describe, it, expect } from 'vitest';
import {
  normalizeToken,
  escapeRegExp,
  hasToken,
  parseJsonSafe,
  parseAttributesInput,
  matchesContext,
  getExpandedDesired,
  getExclusionConflicts,
  evaluateRuleConditions,
  enrichAttributes,
  buildAcceptedSet,
  applyCrossRule,
  getCrossMatchedDesired,
  matchesAttribute,
  matchesGenderPreferenceImplicit,
  isCompatible,
} from '../src/index.js';
import { Rule, Wish, UserProfile } from '../src/types.js';

describe('matchingEngine', () => {
  describe('normalizeToken', () => {
    it('trims and lowercases string values', () => {
      expect(normalizeToken('  MAN  ')).toBe('man');
      expect(normalizeToken(null)).toBe('');
      expect(normalizeToken(undefined)).toBe('');
    });
  });

  describe('escapeRegExp', () => {
    it('escapes regex special characters', () => {
      expect(escapeRegExp('a.b*c?')).toBe('a\\.b\\*c\\?');
    });
  });

  describe('hasToken', () => {
    it('matches whole word tokens', () => {
      expect(hasToken('gay man', 'man')).toBe(true);
      expect(hasToken('human', 'man')).toBe(false);
    });
  });

  describe('parseJsonSafe', () => {
    it('parses valid json string', () => {
      expect(parseJsonSafe('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns original object if passed non-string', () => {
      const obj = { a: 1 };
      expect(parseJsonSafe(obj)).toBe(obj);
    });

    it('returns empty object on invalid json', () => {
      expect(parseJsonSafe('invalid json')).toEqual({});
      expect(parseJsonSafe(null)).toEqual({});
    });
  });

  describe('parseAttributesInput', () => {
    it('parses JSON string or object into normalized array attributes', () => {
      const raw = JSON.stringify({ gender: ['man'], orientation: 'gay' });
      const parsed = parseAttributesInput(raw);
      expect(parsed.gender).toEqual(['man']);
      expect(parsed.orientation).toEqual(['gay']);
    });

    it('returns empty object for empty input', () => {
      expect(parseAttributesInput(null)).toEqual({});
    });
  });

  describe('matchesContext', () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        rule_type: 'expansion',
        trigger_attribute: 'orientation',
        target_attribute: 'orientation',
        trigger_value: 'homosexual',
        target_value: 'gay',
      },
    ];

    it('returns true when rule has no context requirement', () => {
      const rule: Rule = {
        rule_type: 'enrichment',
        trigger_attribute: 'gender',
        trigger_value: 'man',
        target_attribute: 'gender',
        target_value: 'man',
      };
      expect(matchesContext(rule, {})).toBe(true);
    });

    it('returns false when contextProfile is missing', () => {
      const rule: Rule = {
        rule_type: 'enrichment',
        trigger_attribute: 'orientation',
        trigger_value: 'gay',
        target_attribute: 'gender',
        target_value: 'man',
        context_attribute: 'orientation',
        context_value: 'gay',
      };
      expect(matchesContext(rule, undefined)).toBe(false);
    });

    it('evaluates context against expanded values', () => {
      const rule: Rule = {
        rule_type: 'enrichment',
        trigger_attribute: 'orientation',
        trigger_value: 'gay',
        target_attribute: 'gender',
        target_value: 'man',
        context_attribute: 'orientation',
        context_value: 'gay',
      };
      const contextProfile = { orientation: ['homosexual'] };
      expect(matchesContext(rule, contextProfile, rules)).toBe(true);
    });
  });

  describe('getExpandedDesired', () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        rule_type: 'expansion',
        trigger_attribute: 'role',
        target_attribute: 'role',
        trigger_value: 'dom',
        target_value: 'top, master',
      },
    ];

    it('expands trigger values based on expansion rules', () => {
      const expanded = getExpandedDesired(['dom'], 'role', rules);
      expect(expanded).toContain('dom');
      expect(expanded).toContain('top');
      expect(expanded).toContain('master');
    });
  });

  describe('getExclusionConflicts', () => {
    const rules: Rule[] = [
      {
        id: 'ex1',
        rule_type: 'exclusion',
        trigger_attribute: 'role',
        trigger_value: 'top',
        target_attribute: 'role',
        target_value: 'bottom',
      },
    ];

    it('detects mutually exclusive attribute combinations', () => {
      const attributes = { role: ['top', 'bottom'] };
      const conflicts = getExclusionConflicts(attributes, rules);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].rule_id).toBe('ex1');
    });

    it('returns empty array when no conflicts exist', () => {
      const attributes = { role: ['top', 'switch'] };
      const conflicts = getExclusionConflicts(attributes, rules);
      expect(conflicts).toEqual([]);
    });
  });

  describe('enrichAttributes & buildAcceptedSet', () => {
    const rules: Rule[] = [
      {
        id: 'en1',
        rule_type: 'enrichment',
        trigger_attribute: 'orientation',
        trigger_value: 'lesbian',
        target_attribute: 'gender',
        target_value: 'woman',
      },
      {
        id: 'ac1',
        rule_type: 'acceptance',
        trigger_attribute: 'orientation',
        trigger_value: 'straight',
        context_attribute: 'gender',
        context_value: 'man',
        target_attribute: 'gender',
        target_value: 'woman, female',
      },
    ];

    it('enriches user attributes based on trigger conditions', () => {
      const enriched = enrichAttributes({ orientation: ['lesbian'] }, 'gender', rules);
      expect(enriched).toContain('woman');
    });

    it('builds accepted set based on acceptance rules and context', () => {
      const userAttrs = { orientation: ['straight'], gender: ['man'] };
      const accepted = buildAcceptedSet(userAttrs, 'gender', rules);
      expect(Array.from(accepted)).toContain('woman');
      expect(Array.from(accepted)).toContain('female');
    });
  });

  describe('getCrossMatchedDesired', () => {
    const rules: Rule[] = [
      {
        id: 'cr1',
        rule_type: 'cross_match',
        trigger_attribute: 'role',
        target_attribute: 'role',
        trigger_value: 'top',
        target_value: 'bottom',
      },
    ];

    it('returns complementary target values for trigger values', () => {
      const cross = getCrossMatchedDesired(['top'], 'role', rules);
      expect(cross).toContain('bottom');
    });

    it('returns complementary trigger values for target values', () => {
      const cross = getCrossMatchedDesired(['bottom'], 'role', rules);
      expect(cross).toContain('top');
    });
  });

  describe('evaluateRuleConditions', () => {
    it('evaluates rule trigger and context conditions', () => {
      const rule: Rule = {
        rule_type: 'enrichment',
        trigger_attribute: 'orientation',
        trigger_value: 'gay',
        target_attribute: 'gender',
        target_value: 'man',
        context_attribute: 'gender',
        context_value: 'man',
      };
      expect(evaluateRuleConditions(rule, { orientation: ['gay'], gender: ['man'] })).toBe(true);
      expect(evaluateRuleConditions(rule, { orientation: ['straight'], gender: ['man'] })).toBe(
        false
      );
    });
  });

  describe('applyCrossRule', () => {
    it('populates result set with complementary target or trigger values', () => {
      const rule: Rule = {
        rule_type: 'cross_match',
        trigger_attribute: 'role',
        target_attribute: 'role',
        trigger_value: 'top',
        target_value: 'bottom',
      };
      const result = new Set<string>();
      applyCrossRule('top', rule, undefined, [], result);
      expect(Array.from(result)).toContain('bottom');

      const result2 = new Set<string>();
      applyCrossRule('bottom', rule, undefined, [], result2);
      expect(Array.from(result2)).toContain('top');
    });
  });

  describe('matchesAttribute', () => {
    it('returns true when desired attributes are empty', () => {
      expect(matchesAttribute(['man'], [], 'gender')).toBe(true);
    });

    it('returns false when searcher attributes are empty and desired attributes exist', () => {
      expect(matchesAttribute([], ['man'], 'gender')).toBe(false);
    });
  });

  describe('matchesGenderPreferenceImplicit', () => {
    it('returns true when desired genders are empty', () => {
      expect(matchesGenderPreferenceImplicit({}, [])).toBe(true);
    });

    it('returns false when searcher has no orientation', () => {
      expect(matchesGenderPreferenceImplicit({ gender: ['man'] }, ['woman'])).toBe(false);
    });
  });

  describe('isCompatible', () => {
    const rules: Rule[] = [
      {
        id: 'en1',
        rule_type: 'enrichment',
        trigger_attribute: 'orientation',
        trigger_value: 'gay',
        target_attribute: 'gender',
        target_value: 'man',
      },
      {
        id: 'ac1',
        rule_type: 'acceptance',
        trigger_attribute: 'orientation',
        trigger_value: 'gay',
        context_attribute: 'gender',
        context_value: 'man',
        target_attribute: 'gender',
        target_value: 'man',
      },
      {
        id: 'cr1',
        rule_type: 'cross_match',
        trigger_attribute: 'role',
        target_attribute: 'role',
        trigger_value: 'top',
        target_value: 'bottom',
      },
    ];

    it('evaluates compatibility between a wish and a searcher', () => {
      const wish: Wish = {
        creator_attributes: { gender: ['man'], orientation: ['gay'], role: ['top'] },
        desired_attributes: { gender: ['man'], role: ['bottom'] },
      };
      const searcher: UserProfile = {
        identity_attributes: { gender: ['man'], orientation: ['gay'], role: ['bottom'] },
      };

      expect(isCompatible(wish, searcher, rules)).toBe(true);
    });

    it('returns false when role criteria do not match', () => {
      const wish: Wish = {
        creator_attributes: { gender: ['man'], orientation: ['gay'], role: ['top'] },
        desired_attributes: { gender: ['man'], role: ['master'] },
      };
      const searcher: UserProfile = {
        identity_attributes: { gender: ['man'], orientation: ['gay'], role: ['bottom'] },
      };

      expect(isCompatible(wish, searcher, rules)).toBe(false);
    });
  });
});
