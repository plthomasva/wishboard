# Wishboard Triage Report & Action Plan

This report provides an updated assessment of the open backlog items in `BACKLOG.md` and active GitHub issues.

## 1. Recently Resolved & Cleaned Up

The following items from the previous triage run have been successfully resolved, verified, and merged:

- **[#145] Switch libSQL Volume to Bind Mount:** Switched database named volume to host bind mount, aligned UID/GID namespaces under rootless Docker, and deleted the legacy wait-and-chown loops.
- **[#209] Reduce Serverless Deploy Cognitive Complexity:** Refactored `serverless.js` deployment script blocks and resolved SonarCloud complexity flags.
- **[#169] Refactor runSamDeploy retry loop:** Added mockable sleep injections to allow robust testing of the deployment retry logic.
- **[#247] Cache static fonts during serverless deploy:** Excluded fonts from the root `no-cache` sync and configured dedicated S3 sync caching (`public, max-age=31536000`).

---

## 2. Active Backlog Triage

Here is the triage of the 7 active issues currently tracked in the backlog and GitHub, evaluated by **Impact**, **Level of Effort (LOE)**, and **Priority**:

| Issue    | Title                                    | Impact     | LOE        | Priority | Rationale / Recommendation                                                                                                                                                                                |
| :------- | :--------------------------------------- | :--------- | :--------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#217** | Add new rule type for wish/user creation | **High**   | **Medium** | **P1**   | **(Recommended Next)** Prevents contradictory states (e.g. `orientation: [gay, straight]`, `gender: man + orientation: lesbian`) at registration and wish creation. Directly protects matching integrity. |
| **#239** | Evaluate enabling WAL mode locally       | **Medium** | **Low**    | **P1**   | Allows concurrent reads (searches, display updates) to execute without being blocked by wish writes. Very low effort, high return.                                                                        |
| **#232** | Context-gated matching expansions        | **High**   | **High**   | **P2**   | Crucial for cross-community vocabulary handling (e.g. separating BDSM terms from general role expansions). Requires matching engine refactoring.                                                          |
| **#191** | Per-view WebSocket subscriptions         | **Medium** | **Medium** | **P2**   | Generalizes socket channel filtering so that idle admin pages don't receive the raw `wish:*` firehose. Good network optimization.                                                                         |
| **#238** | Automated database/media backups         | **High**   | **Medium** | **P2**   | Critical for operational resilience, especially for serverless Turso/S3. Low priority for local dev setups.                                                                                               |
| **#165** | `WishScanner.tsx` Stryker mutation       | **Low**    | **High**   | **P3**   | Requires heavy mocking of OpenCV, Canvas 2D contexts, and rAF loops. High testing debt but low functional impact.                                                                                         |
| **#180** | Upgrade to ESLint 10                     | **Low**    | **Low**    | **P3**   | **Blocked** upstream by `eslint-plugin-react` compatibility and `typescript-eslint` TS 7 peer dependencies. Pinned for now.                                                                               |

---

## 3. Recommended Next Phase Action Plan

### **P1 Phase (Immediate Focus)**

1. **Enable SQLite WAL Mode (#239):**
   - Introduce an environment flag `WISHBOARD_DB_WAL=1`.
   - Modify `src/server/db.js` to execute `PRAGMA journal_mode=WAL` on initialization only if WAL is enabled.
   - Add checks to prevent WAL execution on serverless Turso targets.
2. **Implement Conflict Rules (#217):**
   - Add support for `exclusion` rules in the matching/rules schema.
   - Implement backend write-time validation in `POST /api/wishes` and `/api/users/profile`.
   - Wire up UI inline warnings in `AttributeInput` to flag conflicts before submission.

### **P2 Phase (Optimization & Engine Refinement)**

3. **WebSocket Subscriptions (#191):** Clean up connection channels.
4. **Context-Gated Expansion Rules (#232):** Refine semantic matching accuracy.
5. **Backups (#238):** Establish standard database exports.
