# ADR 0005: Matching Engine Generalization and Context-Aware Rules

- **Status:** Implemented
- **Date:** 2026-07
- **Context Date:** 2026-07

## Context

Wishboard's matching engine relies on matching rules defined in the database `rules` table (see [ADR 0002](file:///c:/Users/pltho/wishboard/docs/adr/0002-serverless-database-architecture.md) and [#188](https://github.com/plthomasva/wishboard/issues/188)), which are seeded by default from [defaultRules.js](file:///c:/Users/pltho/wishboard/src/server/defaultRules.js). These rules govern how attribute categories such as `gender`, `orientation`, and `role` are matched bidirectionally between a wish creator and a searcher.

In the completed work for [#206](https://github.com/plthomasva/wishboard/issues/206) (see PR [#233](https://github.com/plthomasva/wishboard/pull/233)), we expanded the default taxonomy for power-exchange, activity, pet-play, and rope roles. However, during that implementation, context-gated rules were deferred due to a structural limitation:

Currently, rule evaluation is only context-aware (checking `context_attribute` and `context_value` via `evaluateRuleConditions`) for `enrichment` and `acceptance` rule types. The matching engine's expansion and cross-match helpers — [getExpandedDesired](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L84-L102) and [getCrossMatchedDesired](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L203-L224) — only accept a flat list of desired values and the category, ignoring the rules' `context_attribute` and `context_value` entirely.

This limitation prevents us from implementing rules like: _"expand `top` to include `vers` only when the searcher's orientation is `gay`"_. This prevents unintended cross-community matching between BDSM top/bottom vocabularies and queer sexual top/bottom/vers vocabularies without resorting to ad-hoc, hardcoded checks.

## Decision & Proposed Design

To resolve this limitation without introducing custom parsing helpers to [wishes.js](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js), we will generalize the matching engine to support context-gated `expansion` and `cross_match` rules.

### 1. Context-Aware Helpers

We will update [getExpandedDesired](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L84-L102) and [getCrossMatchedDesired](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L203-L224) to accept an optional `contextProfile` (the searcher's full attribute map: `{ gender, orientation, role }`).

When filtering and applying `expansion` and `cross_match` rules, the engine will check if the rule defines a `context_attribute` and `context_value`. If it does, the rule will only apply if the `contextProfile` matches those conditions.

```javascript
const matchesContext = (rule, contextProfile, rules = []) => {
  if (!rule.context_attribute || !rule.context_value) return true;
  if (!contextProfile) return false;

  const ctxVals = contextProfile[rule.context_attribute] || [];
  // Evaluate the context using a recursive expansion, passing null as the
  // contextProfile to prevent infinite loops on recursive context expansion.
  const expandedCtxVals = getExpandedDesired(ctxVals, rule.context_attribute, rules, null);
  return expandedCtxVals.some((v) => hasToken(v, rule.context_value));
};
```

### 2. Matching Engine Pipeline Updates

We will propagate the `searcherProfile` through [matchesAttribute](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L226-L242) and all call sites in [isCompatible](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L261-L327):

- For checking if the searcher matches the wish's desired attributes, the context profile is the `searcherProfile`.
- For checking if the wish creator matches the searcher's desired attributes (where the wish creator is the "searcher" of this sub-match), the context profile is the `creatorProfile`.
- Update [getExclusionConflicts](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L104-L158) to pass the written profile as the context during write-time validation, allowing context-gated expansions to be validated.

---

## Thought Experiments

### 1. Adding a 4th Attribute Category (e.g., Activity, Kink-Style)

The rule engine and the `rules` database table schema are already fully generic (they support any arbitrary string in `trigger_attribute` and `target_attribute`).

However, adding a new 4th attribute category to Wishboard (e.g., `activity`) would require updates at the database, business logic, and UI boundaries:

- **Database Schema**: Add new JSON-array columns to `wishes` (`desired_activities`, `creator_activities`) and `users` (`identity_activities`) tables.
- **Matching Business Logic**: Introduce a new call site to [matchesAttribute](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L226-L242) inside [isCompatible](file:///c:/Users/pltho/wishboard/src/server/routes/wishes.js#L261-L327) to validate the new category (e.g., `matchesAttribute(searcherProfile.activity, desiredActivities, 'activity', rules)`).
- **Default Seed Rules**: Update [defaultRules.js](file:///c:/Users/pltho/wishboard/src/server/defaultRules.js) to include default rule definitions for the new category.
- **Frontend / UI Layer**: Add input components, autocomplete suggestions, and visual pills/chips for the new attribute category on the registration, profile edit, and wish creation pages.

**Conclusion:** The core rule evaluation engine itself requires no changes to support arbitrary new categories; the work is purely integration-level across the persistence, API, and UI boundaries.

### 2. Multi-Domain Deployment Configuration

Currently, Wishboard is deployed with a hardcoded assumption of BDSM/queer identities in the UI labels, static suggestion lists (such as `SUGGESTED_ROLES` or `SUGGESTED_GENDERS`), and the database seeds. Deploying it for a professional conference or educational setting would require forking the frontend codebase.

To support clean multi-domain deployments without code forks, we propose introducing a **Domain Configuration Layer**:

- **Unified Schema**: Define a domain configuration schema (e.g., `domain.config.yaml` or a DB table) specifying available attribute categories, their display labels, autocomplete suggestion lists, and the default matching rule seeds.
- **API Delivery**: The server will serve this configuration via `GET /api/config`.
- **Dynamic Frontend**: The React client will read the configuration at startup and dynamically render fields, suggestions, labels, and pill colors rather than relying on hardcoded lists.
- **Dynamic Seeding**: The database will seed matching rules dynamically based on the rule seeds declared in the active domain configuration.

---

## Alternatives Considered

- **Special-casing within wishes.js**: We could hardcode an orientation check specifically for the `role` match logic (e.g., if orientation is `gay`, behave differently). This was rejected because it breaks the configuration-driven matching model, scatters matching rules across the code, and makes rules un-editable via the admin UI.
- **Recursive DB CTEs (Common Table Expressions)**: We could perform matching rule expansions directly in the database. This was rejected because we cache rules in memory to maintain synchronous performance for the matching engine, which is critical in serverless Lambda environments where DB calls are relatively expensive.

---

## Consequences

- **Pros**:
  - Eliminates unintended cross-community matches by allowing context-gated expansion/cross-match rules.
  - Keeps all matching logic centralized in the configuration-driven rule system.
  - Enables fine-grained community boundaries while keeping UI administration simple.
- **Cons**:
  - Slightly increases complexity of matching engine function signatures by threading the context profile.
  - Requires care to prevent infinite loops in recursive expansions (mitigated by passing `null` for the nested context profile).

---

## Implementation Notes

During the implementation of this ADR, we went beyond fixing the context-gated expansions. We completely eliminated hardcoded `gender`, `orientation`, and `role` references across both the frontend and backend.

- **Frontend:** Adopted a `DomainContext` system, where attribute inputs are dynamically generated from a configuration YAML file (e.g., `defaultDomain.yaml`).
- **Backend/API:** Refactored the `/api/wishes` endpoint to accept a unified `attributes` JSON payload, falling back to legacy query parameters only when necessary.
- **Infrastructure:** Updated the AWS serverless template and `wishboard` CLI to support deploying parallel stacks to multiple domains, utilizing wildcard certificates (primary `wishboards.app`, SAN `*.wishboards.app`) and isolated Turso databases to support alternate community implementations (like a conference setup vs. the default demo).
