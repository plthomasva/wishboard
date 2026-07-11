# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Open GitHub Issues

Enhancement and technical-debt work tracked as issues, for traceability:

### Testing & Quality

- **[#134](https://github.com/plthomasva/wishboard/issues/134)** — Add a Playwright client E2E smoke test (deferred from #121) to catch real-browser bundling/runtime breakage that jsdom can't.
- **[#180](https://github.com/plthomasva/wishboard/issues/180)** — Upgrade to ESLint 10 once `eslint-plugin-react` supports it (currently pinned to 9.x; Dependabot 10.x updates ignored). A weekly CI watcher (#181) pings this issue when the upstream peers unblock.
- **[#165](https://github.com/plthomasva/wishboard/issues/165)** — Un-exclude `WishScanner.tsx` from Stryker `mutate` and give it a real component test suite (split from #120; its `cardProcessor.ts` delegate is now hardened to ~80%).
- **[#168](https://github.com/plthomasva/wishboard/issues/168)** — Harden `demoSeeder.js` mutation coverage (240 LOC behind a single happy-path assertion, ~24%; split from #120).
- **[#169](https://github.com/plthomasva/wishboard/issues/169)** — Refactor `runSamDeploy` to accept an injectable sleep so the retry-loop mutants can be tested without real 5s waits (split from #120 / #132).

### Database & Deployment

- **[#145](https://github.com/plthomasva/wishboard/issues/145)** — Decide the durable shape for the Pi's libSQL data volume: keep the `build-kiosk.sh` chown, switch to a bind mount, or rely on the image's own chown (rootless-Docker ownership).
- **[#162](https://github.com/plthomasva/wishboard/issues/162)** — Adopt S3 account-regional namespaces for buckets (squat-proof names; drops the hand-coded `${AWS::AccountId}` scheme). Surfaced during the #158 custom-domain incident.

### Performance

- **[#156](https://github.com/plthomasva/wishboard/issues/156)** — Serve static assets gzip/brotli-compressed with long-lived, immutable `Cache-Control` headers on the Pi's nginx (follow-up to #140).
- **[#157](https://github.com/plthomasva/wishboard/issues/157)** — Move password hashing off the event loop (`crypto.scryptSync` → async `crypto.scrypt`) so it doesn't block under concurrency (follow-up to #140).

### Bugs

- **[#199](https://github.com/plthomasva/wishboard/issues/199)** — Matching over-matches: a "straight man" user was shown a "lesbian woman" wish. Tighten the acceptance/expansion rules and add regression tests for orientation/gender pairings.
- **[#196](https://github.com/plthomasva/wishboard/issues/196)** — Event poster shows the default domain (`wishboard.painless-computing.com`) instead of the runtime domain (e.g. on `demo.wishboards.app`).
- **[#197](https://github.com/plthomasva/wishboard/issues/197)** — Kiosk Wi-Fi join popup shows `http://<local-ip>:3000` instead of the https DNS-masqueraded domain.
- **[#198](https://github.com/plthomasva/wishboard/issues/198)** — Kiosk emoji decorations (e.g. 👤) render as blank rectangles — missing emoji font in the kiosk browser.
- **[#194](https://github.com/plthomasva/wishboard/issues/194)** — Kiosk `--reset-rules` does `rm -rf` on the whole `/app/data` volume (deletes uploaded images) and no longer resets the DB-stored rules; it should clear the DB `rules` table instead. (Related: `build-kiosk.sh`'s legacy `wishboard_data → ./data` copy runs on every deploy and clobbers live data — fixed alongside #193.)

### Features & Enhancements

- **[#200](https://github.com/plthomasva/wishboard/issues/200)** — Let a user exclude a wish from their future searches (not-interested / hide). Server-side per-user for logged-in users; open design question for anonymous scoping (localStorage vs anon-session).
- **[#191](https://github.com/plthomasva/wishboard/issues/191)** — Generalize per-view WebSocket subscriptions to `wish:*` (efficiency; follow-up to the sys:log channel work in #189/#190).
- **[#195](https://github.com/plthomasva/wishboard/issues/195)** — Add a `wishboard auth token` CLI helper to mint/print an admin bearer token for scripting/verification.

## Infrastructure & DevOps

- **Automated Database Backups**
  - **Description**: Implement a backup procedure to periodically snapshot the SQLite database (and optionally user-uploaded images in S3) to prevent data loss in the event of accidental stack deletion or corruption.
  - **Environment**: Production serverless deployments.
  - **Notes**: The serverless DB is now hosted **Turso** (libSQL) — evaluate its point-in-time restore vs. scheduling periodic `turso db dump` exports to a backup S3 bucket. The Pi keeps its embedded file DB (back up the `wishboard_data` volume). User-uploaded images live in S3 either way.

## Unified CLI Migration Roadmap

The GitHub Actions OIDC Setup/Destroy scripts and the AWS serverless deploy/destroy
scripts have been migrated to the unified Node.js CLI under `src/cli/`. The remaining
scripts are planned to be ported in subsequent iterations:

### Phase 1: Build & DB Utilities

- **`wishboard build download-fonts`**
  - **Source**: `scripts/download-fonts.js`
  - **Status**: Pending migration.
- **`wishboard db reset-password <username> [new_passphrase]`**
  - **Source**: `scripts/reset-password.js`
  - **Status**: Pending migration.

### Phase 2: Serverless Operations ✅

- **`wishboard serverless deploy`**
  - **Source**: `scripts/deploy-serverless.ps1` & `scripts/deploy-serverless.sh`
  - **Status**: Migrated to `src/cli/commands/serverless.js`; legacy scripts removed.
- **`wishboard serverless destroy`**
  - **Source**: `scripts/destroy-serverless.ps1` & `scripts/destroy-serverless.sh`
  - **Status**: Migrated to `src/cli/commands/serverless.js`; legacy scripts removed.

### Phase 3: Kiosk Operations ✅

- **`wishboard kiosk deploy`**
  - **Source**: `scripts/deploy-kiosk.ps1` & `scripts/deploy-kiosk.sh`
  - **Status**: Migrated to `src/cli/commands/kiosk.js` (cross-platform SSH/scp orchestration); legacy `.ps1`/`.sh` pair removed.
- **`wishboard kiosk setup`**
  - **Source**: `scripts/setup-kiosk.sh`
  - **Status**: Migrated — CLI wrapper runs the Pi-only bash script, which stays as the system-admin source of truth (apt/systemd/rootless-docker/hotspot; no Windows twin to unify).
- **`wishboard kiosk run`**
  - **Source**: `scripts/build-kiosk.sh`
  - **Status**: Migrated — CLI wrapper runs the Pi-only bash script (kept as source of truth).
