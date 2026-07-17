# Wishboard Triage Report & Action Plan

This report provides an updated assessment of the open backlog items in `BACKLOG.md` and active GitHub issues.

## 1. Recently Resolved & Cleaned Up

The following items from the previous triage run have been successfully resolved, verified, and merged:

- **[#145] Switch libSQL Volume to Bind Mount:** Switched database named volume to host bind mount, aligned UID/GID namespaces under rootless Docker, and deleted the legacy wait-and-chown loops.
- **[#209] Reduce Serverless Deploy Cognitive Complexity:** Refactored `serverless.js` deployment script blocks and resolved SonarCloud complexity flags.
- **[#169] Refactor runSamDeploy retry loop:** Added mockable sleep injections to allow robust testing of the deployment retry logic.
- **[#247] Cache static fonts during serverless deploy:** Excluded fonts from the root `no-cache` sync and configured dedicated S3 sync caching (`public, max-age=31536000`).
- **[#217] Exclusion rule type for write-time conflict prevention:** Implemented the `exclusion` rule type end-to-end: `getExclusionConflicts()` logic in `wishes.js`, write-time validation on `POST /api/wishes`, `POST /api/users/register`, and `PUT /api/users/me`, a public `POST /api/rules/check-conflicts` API, debounced inline UI warnings in `AttributeInput`, `EnterWishPage`, and `AccountPage`, and seeded two default exclusion rules (`excl_gay_straight`, `excl_lesbian_man`). Documented in `docs/MATCHING_RULES.md` § 5.

---

## 2. Active Backlog Triage

Here is the triage of the 5 active issues currently tracked in the backlog and GitHub, evaluated by **Impact**, **Level of Effort (LOE)**, and **Priority**:

| Issue    | Title                              | Impact     | LOE        | Priority | Rationale / Recommendation                                                                                                                                              |
| :------- | :--------------------------------- | :--------- | :--------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#232** | Context-gated matching expansions  | **High**   | **High**   | **P1**   | **(Recommended Next)** Crucial for cross-community vocabulary handling (e.g. separating BDSM terms from general role expansions). Requires matching engine refactoring. |
| **#191** | Per-view WebSocket subscriptions   | **Medium** | **Medium** | **P2**   | Generalizes socket channel filtering so that idle admin pages don't receive the raw `wish:*` firehose. Good network optimization.                                       |
| **#238** | Automated database/media backups   | **High**   | **Medium** | **P2**   | Critical for operational resilience, especially for serverless Turso/S3. Low priority for local dev setups.                                                             |
| **#165** | `WishScanner.tsx` Stryker mutation | **Low**    | **High**   | **P3**   | Requires heavy mocking of OpenCV, Canvas 2D contexts, and rAF loops. High testing debt but low functional impact.                                                       |
| **#180** | Upgrade to ESLint 10               | **Low**    | **Low**    | **P3**   | **Blocked** upstream by `eslint-plugin-react` compatibility and `typescript-eslint` TS 7 peer dependencies. Pinned for now.                                             |

---

## 3. Recommended Next Phase Action Plan

### **P1 Phase (Immediate Focus)**

1. **Context-Gated Expansion Rules (#232):** Refine semantic matching accuracy by scoping expansion rules to specific contexts (e.g. BDSM role terms not bleeding into general orientation expansions). Requires matching engine refactoring.

### **P2 Phase (Optimization & Infrastructure)**

1. **WebSocket Subscriptions (#191):** Clean up connection channels so idle admin pages don't receive the raw `wish:*` firehose.
2. **Backups (#238):** Establish standard database exports for serverless Turso/S3.
