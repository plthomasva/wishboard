# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Infrastructure & DevOps

- **Automated Database Backups**
  - **Description**: Implement a backup procedure to periodically snapshot the SQLite database (and optionally user-uploaded images in S3) to prevent data loss in the event of accidental stack deletion or corruption.
  - **Environment**: Production serverless deployments.
  - **Notes**: For the serverless AWS stack, we could leverage AWS Backup for the EFS file system, or schedule a Lambda function to copy the SQLite `.db` file to a dedicated backup S3 bucket on a cron schedule.

## Unified CLI Migration Roadmap

The GitHub Actions OIDC Setup/Destroy scripts have been migrated to the unified Node.js CLI under `src/cli/`. The remaining scripts are planned to be ported in subsequent iterations:

### Phase 1: Build & DB Utilities
- **`wishboard build download-fonts`**
  - **Source**: `scripts/download-fonts.js`
  - **Status**: Pending migration.
- **`wishboard db reset-password <username> [new_passphrase]`**
  - **Source**: `scripts/reset-password.js`
  - **Status**: Pending migration.

### Phase 2: Serverless Operations
- **`wishboard serverless deploy`**
  - **Source**: `scripts/deploy-serverless.ps1` & `scripts/deploy-serverless.sh`
  - **Status**: Pending migration.
- **`wishboard serverless destroy`**
  - **Source**: `scripts/destroy-serverless.ps1` & `scripts/destroy-serverless.sh`
  - **Status**: Pending migration.

### Phase 3: Kiosk Operations
- **`wishboard kiosk deploy`**
  - **Source**: `scripts/deploy-kiosk.ps1` & `scripts/deploy-kiosk.sh`
  - **Status**: Pending migration.
- **`wishboard kiosk setup`**
  - **Source**: `scripts/setup-kiosk.sh`
  - **Status**: Pending migration.
- **`wishboard kiosk run`**
  - **Source**: `scripts/build-kiosk.sh`
  - **Status**: Pending migration.

