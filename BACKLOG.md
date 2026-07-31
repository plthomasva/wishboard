# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Open GitHub Issues

Enhancement and technical-debt work tracked as issues, for traceability:

### Testing & Quality

- **[#180](https://github.com/plthomasva/wishboard/issues/180)** — Upgrade to ESLint 10 once `eslint-plugin-react` supports it (currently pinned to 9.x; Dependabot 10.x updates ignored). A weekly CI watcher (#181) pings this issue when the upstream peers unblock.

### Database & Deployment

- **[#270](https://github.com/plthomasva/wishboard/issues/270)** — Pin `libsql-server` to v0.24.32 due to stats file permission error (`Permission denied (os error 13)`) under Rootless Docker volume mounts. Keep open until an upstream release resolves stats file persistence.

### Features & Enhancements

## Infrastructure & DevOps

- **[#238](https://github.com/plthomasva/wishboard/issues/238)** — Implement automated database and media backups: periodically snapshot the SQLite database (Turso point-in-time restore vs. `turso db dump` exports) and S3 uploaded images.
- **[#262](https://github.com/plthomasva/wishboard/issues/262)** — Root Domain Redirector: Create a small redirector for the bare domain (e.g. `wishboards.app`) to either redirect to the demo deployment or present a landing page selecting among currently deployed active stacks.
