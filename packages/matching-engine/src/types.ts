export type RuleType = 'expansion' | 'enrichment' | 'acceptance' | 'exclusion' | 'cross_match';

export interface Rule {
  id?: number | string;
  rule_type: RuleType;
  trigger_attribute: string;
  trigger_value: string;
  target_attribute: string;
  target_value: string;
  context_attribute?: string | null;
  context_value?: string | null;
  [key: string]: unknown;
}

export type AttributeMap = Record<string, string[] | string | undefined | null>;

export interface UserProfile {
  identity_attributes?: AttributeMap | string;
  [key: string]: unknown;
}

export interface Wish {
  creator_attributes?: AttributeMap | string;
  desired_attributes?: AttributeMap | string;
  [key: string]: unknown;
}

export interface Conflict {
  rule_id?: number | string;
  trigger_attribute: string;
  trigger_value: string;
  context_attribute: string | null;
  context_value: string | null;
  target_attribute: string;
  target_value: string;
  message: string;
}
