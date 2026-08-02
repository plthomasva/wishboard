# @wishboards/matching-engine

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC_BY--NC_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Node.js CI](https://github.com/wishboards/matching-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/wishboards/matching-engine/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@wishboards/matching-engine.svg)](https://www.npmjs.com/package/@wishboards/matching-engine)

A zero-dependency, identity-based dynamic matchmaking and rules evaluation engine.

> **License & Non-Commercial Notice**: This software is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** license. Free for non-commercial, personal, open-source, and educational use. Commercial use requires prior authorization.

---

## Features

- **Pure & Framework-Agnostic**: Zero runtime dependencies. Accepts standard JavaScript/TypeScript objects and returns deterministic match decisions.
- **Dynamic Rule System**: All identity, role, orientation, and preference logic is driven by data rules (DB or YAML), rather than hardcoded `if/else` logic.
- **5 Core Rule Engine Types**:
  1. `expansion`: Synonym & variant mapping (e.g. `enby` → `nonbinary`).
  2. `enrichment`: Implicit attribute additions (e.g. `lesbian` → `woman`).
  3. `acceptance`: Broad target acceptance overrides (e.g. `pansexual` → `man, woman, nonbinary`).
  4. `exclusion`: Mutually exclusive attribute detection (e.g. `monogamous` vs `polyamorous`).
  5. `cross_match`: Complementary role & preference matching (e.g. `switch` ↔ `top, bottom`).
- **Context-Aware Rules**: Evaluate rule conditions against target profiles dynamically.
- **Full TypeScript Support**: Written in TypeScript with complete type definitions included.

---

## Installation

```bash
npm install @wishboards/matching-engine
```

---

## Quick Start

```typescript
import { isCompatible, Rule, Wish, UserProfile } from '@wishboards/matching-engine';

// 1. Define active rule set (from DB or config file)
const rules: Rule[] = [
  {
    id: 1,
    rule_type: 'enrichment',
    trigger_attribute: 'orientation',
    trigger_value: 'lesbian',
    target_attribute: 'gender',
    target_value: 'woman',
  },
  {
    id: 2,
    rule_type: 'acceptance',
    trigger_attribute: 'orientation',
    trigger_value: 'lesbian',
    target_attribute: 'gender',
    target_value: 'woman',
  },
];

// 2. Define Wish creator and searcher profiles
const wish: Wish = {
  creator_attributes: { gender: ['woman'], orientation: ['lesbian'] },
  desired_attributes: { gender: ['woman'] },
};

const searcher: UserProfile = {
  identity_attributes: { gender: ['woman'], orientation: ['lesbian'] },
};

// 3. Evaluate bidirectional compatibility
const compatible = isCompatible(wish, searcher, rules);
console.log('Is Compatible:', compatible); // true
```

---

## API Reference

### `isCompatible(wish, searcher, rules)`

Evaluates whether a searcher profile and a wish creator profile are mutually compatible based on desired attributes and active rules.

### `enrichAttributes(attributes, targetCategory, rules)`

Implicitly enriches a user's attribute array for a given category (e.g. adding `woman` if orientation is `lesbian`).

### `buildAcceptedSet(attributes, targetCategory, rules)`

Builds a set of accepted target values based on `acceptance` rules (e.g., returning all genders for pan/queer orientations).

### `getExpandedDesired(attributes, category, rules)`

Returns expanded desired attributes by applying synonym/variant `expansion` rules.

### `getExclusionConflicts(attributes, rules)`

Identifies any mutually exclusive attribute conflicts (returns array of conflict objects with descriptive messages).

---

## License

Licensed under [CC BY-NC 4.0](LICENSE).
