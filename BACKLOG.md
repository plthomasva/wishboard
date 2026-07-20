# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Open GitHub Issues

Enhancement and technical-debt work tracked as issues, for traceability:

### Testing & Quality

- **[#180](https://github.com/plthomasva/wishboard/issues/180)** — Upgrade to ESLint 10 once `eslint-plugin-react` supports it (currently pinned to 9.x; Dependabot 10.x updates ignored). A weekly CI watcher (#181) pings this issue when the upstream peers unblock.
- **[#165](https://github.com/plthomasva/wishboard/issues/165)** — Un-exclude `WishScanner.tsx` from Stryker `mutate` and give it a real component test suite (split from #120; its `cardProcessor.ts` delegate is now hardened to ~80%).
- **[#261](https://github.com/plthomasva/wishboard/issues/261)** — Stryker Mutation Review: Review Stryker mutation coverage for the generalized rules engine and dynamic identity attributes to ensure logic edge cases are tested.

### Database & Deployment

- **[#239](https://github.com/plthomasva/wishboard/issues/239)** — Evaluate enabling WAL (Write-Ahead Logging) mode on local single-node deployments to prevent read operations from blocking during write bursts.

### Features & Enhancements

- **[#263](https://github.com/plthomasva/wishboard/issues/263)** — Decouple domain-specific styles from general application styles (`styles.css` containing hardcoded traits/colors to domain config/dynamic styles). _(In Progress: PR pending for Event Profiles & Theming Refactor)_
- **[#191](https://github.com/plthomasva/wishboard/issues/191)** — Generalize per-view WebSocket subscriptions to `wish:*` (efficiency; follow-up to the sys:log channel work in #189/#190).

## Infrastructure & DevOps

- **[#238](https://github.com/plthomasva/wishboard/issues/238)** — Implement automated database and media backups: periodically snapshot the SQLite database (Turso point-in-time restore vs. `turso db dump` exports) and S3 uploaded images.
- **[#262](https://github.com/plthomasva/wishboard/issues/262)** — Root Domain Redirector: Create a small redirector for the bare domain (e.g. `wishboards.app`) to either redirect to the demo deployment or present a landing page selecting among currently deployed active stacks.
