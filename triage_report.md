# Wishboard Triage Report

Based on a review of `BACKLOG.md`, the `docs/adr/` directory, and the open GitHub issues, here is a summary of the current landscape to help us prioritize our next task.

## 1. Pending ADRs

All four documented ADRs are currently **Accepted** and implemented, with one minor follow-up:

- **ADR-0004 (Kiosk Data Persistence)**: The core implementation is complete, but [Issue #145] remains as a follow-up to evaluate switching the Pi's Docker volume from a named volume with manual `chown` to a bind mount.

## 2. High-Priority Bugs & Functional Gaps

These items directly impact the user experience or current system correctness:

- **[#199] Matching Over-Matches**: A bug where straight users are seeing lesbian wishes. Requires tightening the acceptance/expansion rules and adding regression tests. _(Listed in BACKLOG, though no active issue returned in the recent API call, may be closed or tracked differently)._
- **[#197] Kiosk Wi-Fi Popup URL**: The join popup shows the local IP `http://<local-ip>:3000` instead of the DNS-masqueraded `https://...` domain.
- **[#196] Event Poster URL**: The poster displays the default domain instead of the actual runtime domain (e.g., `demo.wishboards.app`).
- **Serverless WiFi Popup Toggle**: (No issue number) Serverless deployments don't have local AP hardware, so the Wi-Fi connect popup should be disabled entirely by default.

## 3. Tech Debt & Refactoring (Quality Gates)

These issues improve the maintainability and testability of the codebase:

- **[#209] Reduce Serverless Deploy Cognitive Complexity**: SonarCloud flagged `serverless.js:~300` as CRITICAL for maintainability. Refactoring the deploy function into smaller steps will resolve this.
- **[#169] Refactor `runSamDeploy`**: Injectable sleep to allow testing the retry loop without real 5s waits.
- **[#168] & [#165] Mutation Testing Gaps**: Harden `demoSeeder.js` and `WishScanner.tsx` against Stryker mutation tests to hit the ~80% target.
- **[#134] Playwright E2E Test**: Implement a basic smoke test to catch runtime/bundling breakages that `jsdom` misses.

## 4. Performance & Infrastructure

- **[#157] Async Password Hashing**: Move `crypto.scryptSync` off the event loop to prevent blocking during concurrent logins.
- **[#156] Pi Nginx Compression**: Serve static assets with gzip/brotli and long-lived cache headers.
- **[#162] S3 Account-Regional Namespaces**: Drop the hand-coded AWS Account ID from bucket names in favor of squat-proof account-regional namespaces.
- **Automated Database Backups**: (From Backlog) Implement periodic Turso dumps to S3 for serverless setups.

## 5. Features & Enhancements

- **[#217] New Rule Type**: Add new rule type for wish/user creation. _(Just opened yesterday)._
- **[#206] Expand Default Roles**: Expand cross-matching/expansion rules for power-exchange/activity roles (e.g., top/bottom/switch).
- **[#191] Granular WebSocket Subscriptions**: Move from a global `wish:*` firehose to per-view topic subscriptions for efficiency.

---

### Suggested Next Priorities

Given the state of the project, I'd recommend tackling one of the following next:

1. **The Bug Fixes (#196, #197, or the Serverless WiFi Popup Toggle)**: These directly affect the visual polish and correctness of what users see when interacting with the board. We previously discussed the Serverless WiFi Popup toggle right before the CLI work.
2. **Cognitive Complexity (#209)**: If we want to clear the SonarCloud critical warning on the `serverless.js` deployment script.
3. **Async Password Hashing (#157)**: A relatively straightforward architectural win that improves the responsiveness of the Node.js event loop under load.

What looks most valuable to tackle next?
