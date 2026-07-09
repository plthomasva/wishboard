# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Open GitHub Issues

Enhancement and technical-debt work tracked as issues, for traceability:

### Testing & Quality

- **[#120](https://github.com/plthomasva/wishboard/issues/120)** — Measure and act on the Stryker mutation score (surface it, close the `WishScanner` mutation blind spot, decide a threshold).
- **[#134](https://github.com/plthomasva/wishboard/issues/134)** — Add a Playwright client E2E smoke test (deferred from #121) to catch real-browser bundling/runtime breakage that jsdom can't.
- **[#165](https://github.com/plthomasva/wishboard/issues/165)** — Un-exclude `WishScanner.tsx` from Stryker `mutate` and give it a real component test suite (split from #120; its `cardProcessor.ts` delegate is now hardened to ~80%).
- **[#164](https://github.com/plthomasva/wishboard/issues/164)** — CI: SonarQube quality gate races auto-merge — `CI Success` goes green before Sonar's server-side verdict posts, so red gates slip through. Fix by adding `sonar.qualitygate.wait=true` (not a sleep); also unblock the current red gate (2 `kiosk.js` S5443 findings) and sweep accumulated issues.

### Database & Deployment

- **[#136](https://github.com/plthomasva/wishboard/issues/136)** — Spike: validate Turso free-tier fit to resolve [ADR 0002](docs/adr/0002-serverless-database-architecture.md) (the serverless SQLite-on-EFS topology).
- **[#145](https://github.com/plthomasva/wishboard/issues/145)** — Decide the durable shape for the Pi's libSQL data volume: keep the `build-kiosk.sh` chown, switch to a bind mount, or rely on the image's own chown (rootless-Docker ownership).
- **[#158](https://github.com/plthomasva/wishboard/issues/158)** — `serverless deploy` mis-parses samconfig `parameter_overrides` (escaped quotes), which can silently tear down the custom domain (DNS + ACM cert). Parse fix plus a fail-loud guard against blanking a configured domain.

### Performance

- **[#156](https://github.com/plthomasva/wishboard/issues/156)** — Serve static assets gzip/brotli-compressed with long-lived, immutable `Cache-Control` headers on the Pi's nginx (follow-up to #140).
- **[#157](https://github.com/plthomasva/wishboard/issues/157)** — Move password hashing off the event loop (`crypto.scryptSync` → async `crypto.scrypt`) so it doesn't block under concurrency (follow-up to #140).

## Infrastructure & DevOps

- **Automated Database Backups**
  - **Description**: Implement a backup procedure to periodically snapshot the SQLite database (and optionally user-uploaded images in S3) to prevent data loss in the event of accidental stack deletion or corruption.
  - **Environment**: Production serverless deployments.
  - **Notes**: For the serverless AWS stack, we could leverage AWS Backup for the EFS file system, or schedule a Lambda function to copy the SQLite `.db` file to a dedicated backup S3 bucket on a cron schedule.

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
