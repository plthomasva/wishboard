# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Open GitHub Issues

Enhancement and technical-debt work tracked as issues, for traceability:

### Testing & Quality

- **[#180](https://github.com/plthomasva/wishboard/issues/180)** — Upgrade to ESLint 10 once `eslint-plugin-react` supports it (currently pinned to 9.x; Dependabot 10.x updates ignored). A weekly CI watcher (#181) pings this issue when the upstream peers unblock.
- **[#165](https://github.com/plthomasva/wishboard/issues/165)** — Un-exclude `WishScanner.tsx` from Stryker `mutate` and give it a real component test suite (split from #120; its `cardProcessor.ts` delegate is now hardened to ~80%).
- **[#169](https://github.com/plthomasva/wishboard/issues/169)** — Refactor `runSamDeploy` to accept an injectable sleep so the retry-loop mutants can be tested without real 5s waits (split from #120 / #132).

### Database & Deployment

- **[#145](https://github.com/plthomasva/wishboard/issues/145)** — Decide the durable shape for the Pi's libSQL data volume: keep the `build-kiosk.sh` chown, switch to a bind mount, or rely on the image's own chown (rootless-Docker ownership).
- **[#162](https://github.com/plthomasva/wishboard/issues/162)** — Adopt S3 account-regional namespaces for buckets (squat-proof names; drops the hand-coded `${AWS::AccountId}` scheme). Surfaced during the #158 custom-domain incident.

### Performance

- **[#156](https://github.com/plthomasva/wishboard/issues/156)** — Serve static assets gzip/brotli-compressed with long-lived, immutable `Cache-Control` headers on the Pi's nginx (follow-up to #140).

### Features & Enhancements

- **[#191](https://github.com/plthomasva/wishboard/issues/191)** — Generalize per-view WebSocket subscriptions to `wish:*` (efficiency; follow-up to the sys:log channel work in #189/#190).
- **[#206](https://github.com/plthomasva/wishboard/issues/206)** — Expand the default role rules (power-exchange, activity, pet-play, rope, etc.) with cross-match/expansion, incl. switch/versatile modeling. Follow-up to the initial role defaults added with #199.
- **[#217](https://github.com/plthomasva/wishboard/issues/217)** — Add new rule type for wish creation and user creation.

## Infrastructure & DevOps

- **Automated Database Backups**
  - **Description**: Implement a backup procedure to periodically snapshot the SQLite database (and optionally user-uploaded images in S3) to prevent data loss in the event of accidental stack deletion or corruption.
  - **Environment**: Production serverless deployments.
  - **Notes**: The serverless DB is now hosted **Turso** (libSQL) — evaluate its point-in-time restore vs. scheduling periodic `turso db dump` exports to a backup S3 bucket. The Pi keeps its embedded file DB (back up the `wishboard_data` volume). User-uploaded images live in S3 either way.
