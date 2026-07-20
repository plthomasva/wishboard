# Wishboard Triage Report & Action Plan

This report provides an updated assessment of the open backlog items in `BACKLOG.md` and active GitHub issues.

## 1. Recently Resolved & Cleaned Up

The following items from the previous triage run have been successfully resolved, verified, and merged:

- **[#145] Switch libSQL Volume to Bind Mount:** Switched database named volume to host bind mount, aligned UID/GID namespaces under rootless Docker, and deleted the legacy wait-and-chown loops.
- **[#209] Reduce Serverless Deploy Cognitive Complexity:** Refactored `serverless.js` deployment script blocks and resolved SonarCloud complexity flags.
- **[#169] Refactor runSamDeploy retry loop:** Added mockable sleep injections to allow robust testing of the deployment retry logic.
- **[#247] Cache static fonts during serverless deploy:** Excluded fonts from the root `no-cache` sync and configured dedicated S3 sync caching (`public, max-age=31536000`).
- **[#217] Exclusion rule type for write-time conflict prevention:** Implemented the `exclusion` rule type end-to-end: `getExclusionConflicts()` logic in `wishes.js`, write-time validation on `POST /api/wishes`, `POST /api/users/register`, and `PUT /api/users/me`, a public `POST /api/rules/check-conflicts` API, debounced inline UI warnings in `AttributeInput`, `EnterWishPage`, and `AccountPage`, and seeded two default exclusion rules (`excl_gay_straight`, `excl_lesbian_man`). Documented in `docs/MATCHING_RULES.md` § 5.
- **[#232] Context-gated matching expansions (ADR 0005):** Fully implemented ADR 0005 by generalizing the rules engine, completely refactoring the UI to use dynamic `DomainContext` attribute configurations instead of hardcoded traits, and updating the AWS serverless CLI to support deploying parallel stacks to multiple domains with wildcard certificates.
- **[#264] Legacy Attribute Fallback Removal & Test Suite Modernization:** Completely removed legacy identity attribute fallbacks (`getIdentityAttributes`) and deprecated columns (`creator_genders`, `desired_genders`, etc.) from backend routes. Refactored 40+ unit/integration test files to use the unified `attributes` JSON payload format. Updated E2E Playwright smoke tests (`tests/e2e/smoke.spec.ts`) to target dynamic attribute input IDs (`#search-gender`, `#search-orientation`, `#search-role`), resolved all ESLint warnings, and verified SonarQube Quality Gate compliance.

---

## 2. Active Backlog Triage

Here is the triage of the 7 active issues currently tracked in the backlog and GitHub, evaluated by **Impact**, **Level of Effort (LOE)**, and **Priority**:

| Issue    | Title                              | Impact     | LOE        | Priority | Rationale / Recommendation                                                                                                                                          |
| :------- | :--------------------------------- | :--------- | :--------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#262** | Root Domain Redirector             | **High**   | **Low**    | **P1**   | Create a small redirector for the bare domain to either redirect to the demo deployment or present a landing page selecting among currently deployed active stacks. |
| **#263** | Decouple domain-specific styles    | **Medium** | **Medium** | **P2**   | Decouple hardcoded domain traits/colors in `styles.css` into domain configuration / CSS variables to achieve complete visual domain portability.                    |
| **#191** | Per-view WebSocket subscriptions   | **Medium** | **Medium** | **P2**   | Generalizes socket channel filtering so that idle admin pages don't receive the raw `wish:*` firehose. Good network optimization.                                   |
| **#238** | Automated database/media backups   | **High**   | **Medium** | **P2**   | Critical for operational resilience, especially for serverless Turso/S3. Low priority for local dev setups.                                                         |
| **#165** | `WishScanner.tsx` Stryker mutation | **Low**    | **High**   | **P3**   | Requires heavy mocking of OpenCV, Canvas 2D contexts, and rAF loops. High testing debt but low functional impact.                                                   |
| **#261** | Stryker Mutation Review            | **Low**    | **Medium** | **P3**   | Review Stryker mutation coverage for the generalized rules engine and dynamic identity attributes to ensure logic edge cases are tested.                            |
| **#180** | Upgrade to ESLint 10               | **Low**    | **Low**    | **P3**   | **Blocked** upstream by `eslint-plugin-react` compatibility and `typescript-eslint` TS 7 peer dependencies. Pinned for now.                                         |

---

## 3. Recommended Next Phase Action Plan

### **P1 Phase (Immediate Focus)**

1. **Root Domain Redirector (#262):** Create a small redirector for the bare domain (e.g. `wishboards.app`) to either redirect to the demo deployment or present a landing page selecting among currently deployed active stacks.

### **P2 Phase (Optimization & Domain Portability)**

1. **Decouple Domain Styles (#263):** Extract domain-specific styling from `styles.css` into configuration-driven CSS variables.
2. **WebSocket Subscriptions (#191):** Clean up connection channels so idle admin pages don't receive the raw `wish:*` firehose.
3. **Backups (#238):** Establish standard database exports for serverless Turso/S3.
