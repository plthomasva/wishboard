import { Rule, UserProfile, Wish, Conflict } from './types.js';

export const normalizeToken = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
};

export const hasToken = (str: unknown, token: string): boolean => {
  const escapedToken = escapeRegExp(token);
  return new RegExp(String.raw`\b${escapedToken}\b`, 'i').test(normalizeToken(str));
};

export const parseJsonSafe = (str: unknown): Record<string, unknown> => {
  if (!str) return {};
  if (typeof str !== 'string') return (str as Record<string, unknown>) || {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
};

export const normalizeArrayInput = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  const array = Array.isArray(value) ? value : [value];
  return array
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseAttributesInput = (rawAttrs: unknown): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  if (!rawAttrs) return result;

  let parsed = rawAttrs;
  if (typeof rawAttrs === 'string') {
    parsed = parseJsonSafe(rawAttrs);
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const key of Object.keys(parsed as Record<string, unknown>)) {
      result[key] = normalizeArrayInput((parsed as Record<string, unknown>)[key]);
    }
  }
  return result;
};

export const matchesContext = (
  rule: Rule,
  contextProfile: Record<string, string[]> | undefined,
  rules: Rule[] = []
): boolean => {
  if (!rule.context_attribute || !rule.context_value) return true;
  if (!contextProfile) return false;

  const ctxVals = contextProfile[rule.context_attribute] || [];
  const expandedCtxVals = getExpandedDesired(ctxVals, rule.context_attribute, rules, undefined);
  return expandedCtxVals.some((v) => hasToken(v, rule.context_value!));
};

export const getExpandedDesired = (
  desiredVals: string[],
  category: string,
  rules: Rule[] = [],
  contextProfile: Record<string, string[]> | undefined = undefined
): string[] => {
  const result = new Set(desiredVals.map(normalizeToken));
  const expandRules = rules.filter(
    (r) =>
      r.rule_type === 'expansion' &&
      r.trigger_attribute === category &&
      r.target_attribute === category
  );

  for (const val of desiredVals) {
    for (const rule of expandRules) {
      if (hasToken(val, rule.trigger_value)) {
        if (contextProfile !== undefined && !matchesContext(rule, contextProfile, rules)) {
          continue;
        }
        const targets = rule.target_value.split(',').map((t) => t.trim().toLowerCase());
        targets.forEach((t) => result.add(t));
      }
    }
  }
  return Array.from(result);
};

export const getExclusionConflicts = (
  attributes: Record<string, string[]>,
  rules: Rule[] = []
): Conflict[] => {
  const conflicts: Conflict[] = [];
  const expandedAttrs: Record<string, string[]> = {};
  for (const key of Object.keys(attributes)) {
    const vals = attributes[key] || [];
    expandedAttrs[key] = getExpandedDesired(vals, key, rules, attributes);
  }

  const exclusionRules = rules.filter((r) => r.rule_type === 'exclusion');

  for (const rule of exclusionRules) {
    const triggerTokens = rule.trigger_value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const targetTokens = rule.target_value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const hasTrigger = triggerTokens.some((token) =>
      expandedAttrs[rule.trigger_attribute]?.some((attrVal) => hasToken(attrVal, token))
    );

    let hasContext = true;
    if (rule.context_attribute && rule.context_value) {
      const ctxAttr = rule.context_attribute;
      const contextTokens = rule.context_value
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      hasContext = contextTokens.some((token) =>
        expandedAttrs[ctxAttr]?.some((attrVal: string) => hasToken(attrVal, token))
      );
    }

    const hasTarget = targetTokens.some((token) =>
      expandedAttrs[rule.target_attribute]?.some((attrVal: string) => hasToken(attrVal, token))
    );

    if (hasTrigger && hasContext && hasTarget) {
      conflicts.push({
        rule_id: rule.id,
        trigger_attribute: rule.trigger_attribute,
        trigger_value: rule.trigger_value,
        context_attribute: rule.context_attribute || null,
        context_value: rule.context_value || null,
        target_attribute: rule.target_attribute,
        target_value: rule.target_value,
        message: `"${rule.trigger_value}" and "${rule.target_value}" are mutually exclusive.`,
      });
    }
  }

  return conflicts;
};

export const evaluateRuleConditions = (
  rule: Rule,
  userAttributes: Record<string, string[]>,
  rules: Rule[] = []
): boolean => {
  const triggerVals = userAttributes[rule.trigger_attribute] || [];
  const triggerMatch = triggerVals.some((v) => hasToken(v, rule.trigger_value));

  let contextMatch = true;
  if (rule.context_attribute && rule.context_value) {
    const ctxVal = rule.context_value;
    const ctxVals = userAttributes[rule.context_attribute] || [];
    const expandedCtxVals = getExpandedDesired(ctxVals, rule.context_attribute, rules);
    contextMatch = expandedCtxVals.some((v) => hasToken(v, ctxVal));
  }

  return triggerMatch && contextMatch;
};

export const enrichAttributes = (
  userAttributes: Record<string, string[]>,
  targetCategory: string,
  rules: Rule[] = []
): string[] => {
  const enriched = new Set((userAttributes[targetCategory] || []).map(normalizeToken));
  const enrichmentRules = rules.filter(
    (r) => r.rule_type === 'enrichment' && r.target_attribute === targetCategory
  );

  for (const rule of enrichmentRules) {
    if (evaluateRuleConditions(rule, userAttributes, rules)) {
      enriched.add(rule.target_value.toLowerCase());
    }
  }
  return Array.from(enriched);
};

export const buildAcceptedSet = (
  userAttributes: Record<string, string[]>,
  targetCategory: string,
  rules: Rule[] = []
): Set<string> => {
  const accepted = new Set<string>();
  const acceptanceRules = rules.filter(
    (r) => r.rule_type === 'acceptance' && r.target_attribute === targetCategory
  );

  for (const rule of acceptanceRules) {
    if (evaluateRuleConditions(rule, userAttributes, rules)) {
      const targets = rule.target_value.split(',').map((t) => t.trim().toLowerCase());
      targets.forEach((t) => accepted.add(t));
    }
  }
  return accepted;
};

export const applyCrossRule = (
  val: string,
  rule: Rule,
  contextProfile: Record<string, string[]> | undefined,
  rules: Rule[],
  result: Set<string>
): void => {
  if (contextProfile !== undefined && !matchesContext(rule, contextProfile, rules)) return;
  if (hasToken(val, rule.trigger_value)) {
    const targets = rule.target_value.split(',').map((t) => t.trim().toLowerCase());
    targets.forEach((t) => result.add(t));
  }
  if (rule.target_value.split(',').some((t) => hasToken(val, t.trim().toLowerCase()))) {
    result.add(rule.trigger_value.toLowerCase());
  }
};

export const getCrossMatchedDesired = (
  desiredVals: string[],
  category: string,
  rules: Rule[] = [],
  contextProfile: Record<string, string[]> | undefined = undefined
): string[] => {
  const result = new Set<string>();
  const crossRules = rules.filter(
    (r) =>
      r.rule_type === 'cross_match' &&
      r.trigger_attribute === category &&
      r.target_attribute === category
  );

  for (const val of desiredVals) {
    for (const rule of crossRules) {
      applyCrossRule(val, rule, contextProfile, rules, result);
    }
  }
  return Array.from(result);
};

export const matchesAttribute = (
  searcherVals: string[],
  desiredVals: string[],
  category: string,
  rules: Rule[] = [],
  contextProfile: Record<string, string[]> | undefined = undefined
): boolean => {
  if (!desiredVals || desiredVals.length === 0) return true;
  if (!searcherVals || searcherVals.length === 0) return false;

  const normalizedSearcher = new Set(searcherVals.map(normalizeToken));
  const expandedDesired = getExpandedDesired(desiredVals, category, rules, contextProfile);
  const crossMatchedDesired = getCrossMatchedDesired(desiredVals, category, rules, contextProfile);
  const expandedCrossMatched = getExpandedDesired(
    Array.from(crossMatchedDesired),
    category,
    rules,
    contextProfile
  );

  const allAcceptable = new Set([
    ...expandedDesired,
    ...crossMatchedDesired,
    ...expandedCrossMatched,
  ]);

  return Array.from(allAcceptable).some((desired) => normalizedSearcher.has(desired));
};

export const matchesGenderPreferenceImplicit = (
  searcherAttributes: Record<string, string[]>,
  desiredGenders: string[] = [],
  rules: Rule[] = []
): boolean => {
  if (!desiredGenders || desiredGenders.length === 0) return true;
  const searcherOrientations = searcherAttributes.orientation || [];
  if (!searcherOrientations || searcherOrientations.length === 0) return false;

  const accepted = buildAcceptedSet(searcherAttributes, 'gender', rules);
  if (accepted.size === 0) return false;

  return matchesAttribute(Array.from(accepted), desiredGenders, 'gender', rules);
};

export const isCompatible = (wish: Wish, searcher: UserProfile, rules: Rule[] = []): boolean => {
  const creatorProfileRaw =
    typeof wish.creator_attributes === 'string'
      ? parseJsonSafe(wish.creator_attributes)
      : wish.creator_attributes || {};

  const desiredProfileRaw =
    typeof wish.desired_attributes === 'string'
      ? parseJsonSafe(wish.desired_attributes)
      : wish.desired_attributes || {};

  const searcherProfileRaw =
    typeof searcher.identity_attributes === 'string'
      ? parseJsonSafe(searcher.identity_attributes)
      : searcher.identity_attributes || {};

  const creatorParsed: Record<string, string[]> = {};
  for (const key of Object.keys(creatorProfileRaw)) {
    creatorParsed[key] = normalizeArrayInput(creatorProfileRaw[key]);
  }

  const desiredParsed: Record<string, string[]> = {};
  for (const key of Object.keys(desiredProfileRaw)) {
    desiredParsed[key] = normalizeArrayInput(desiredProfileRaw[key]);
  }

  const searcherParsed: Record<string, string[]> = {};
  for (const key of Object.keys(searcherProfileRaw)) {
    searcherParsed[key] = normalizeArrayInput(searcherProfileRaw[key]);
  }

  const creatorProfile: Record<string, string[]> = {};
  for (const key of Object.keys(creatorParsed)) {
    creatorProfile[key] = enrichAttributes(creatorParsed, key, rules);
  }

  const searcherProfile: Record<string, string[]> = {};
  for (const key of Object.keys(searcherParsed)) {
    searcherProfile[key] = enrichAttributes(searcherParsed, key, rules);
  }

  // 1. Does the searcher want the wish creator?
  const searcherWantsCreatorGender = matchesGenderPreferenceImplicit(
    searcherProfile,
    creatorProfile.gender,
    rules
  );

  // 2. Does the wish creator want the searcher?
  let creatorWantsSearcherGender = false;
  const desiredGenders = desiredParsed.gender || [];
  if (desiredGenders.length > 0) {
    creatorWantsSearcherGender = matchesAttribute(
      searcherProfile.gender || [],
      desiredGenders,
      'gender',
      rules,
      searcherProfile
    );
  } else {
    creatorWantsSearcherGender = matchesGenderPreferenceImplicit(
      creatorProfile,
      searcherProfile.gender || [],
      rules
    );
  }

  let creatorWantsSearcherAttributes = true;
  for (const [cat, desiredVals] of Object.entries(desiredParsed)) {
    if (cat === 'gender') continue;
    if (!matchesAttribute(searcherProfile[cat] || [], desiredVals, cat, rules, searcherProfile)) {
      creatorWantsSearcherAttributes = false;
      break;
    }
  }

  return searcherWantsCreatorGender && creatorWantsSearcherGender && creatorWantsSearcherAttributes;
};
