# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Open GitHub Issues

Enhancement and technical-debt work tracked as issues, for traceability:

### Testing & Quality

- **[#134](https://github.com/plthomasva/wishboard/issues/134)** — Add a Playwright client E2E smoke test (deferred from #121) to catch real-browser bundling/runtime breakage that jsdom can't.
  - **Pending Rendering/Layout Tests**: When E2E testing is implemented, include visual regression or explicit bounding box checks for the `.wish-card` / `.display-card` layout fiddling we did:
    - Text must wrap naturally around floated elements (`.card-top-left-actions` and `.identity-stickers`) without escaping the bottom of the inner scale wrapper.
    - Negative margins on floats interact poorly with `overflow: hidden` on their parent (clips the floats). Floats must sit purely inside the `overflow: hidden` container (no negative top margins) so they don't appear chopped off in Kiosk Mode.
    - Inline flex containers like `.identity-stickers` need `display: flex;` so their bounding box hugs the SVG graphics tightly, otherwise the parent block's `line-height` creates a huge invisible descent below the SVG images that ruins text wrapping.
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
- **[#194](https://github.com/plthomasva/wishboard/issues/194)** — Kiosk `--reset-rules` does `rm -rf` on the whole `/app/data` volume (deletes uploaded images) and no longer resets the DB-stored rules; it should clear the DB `rules` table instead. (Related: `build-kiosk.sh`'s legacy `wishboard_data → ./data` copy runs on every deploy and clobbers live data — fixed alongside #193.)

### Features & Enhancements

- **[#191](https://github.com/plthomasva/wishboard/issues/191)** — Generalize per-view WebSocket subscriptions to `wish:*` (efficiency; follow-up to the sys:log channel work in #189/#190).
- **[#206](https://github.com/plthomasva/wishboard/issues/206)** — Expand the default role rules (power-exchange, activity, pet-play, rope, etc.) with cross-match/expansion, incl. switch/versatile modeling. Follow-up to the initial role defaults added with #199.
- **Serverless WiFi Popup Toggle** — For serverless deployments, there is no local hardware AP/WiFi available. Investigate hiding the Wi-Fi connect pop-up on serverless stacks entirely, unless explicitly enabled for demonstration purposes.

## Infrastructure & DevOps

- **Automated Database Backups**
  - **Description**: Implement a backup procedure to periodically snapshot the SQLite database (and optionally user-uploaded images in S3) to prevent data loss in the event of accidental stack deletion or corruption.
  - **Environment**: Production serverless deployments.
  - **Notes**: The serverless DB is now hosted **Turso** (libSQL) — evaluate its point-in-time restore vs. scheduling periodic `turso db dump` exports to a backup S3 bucket. The Pi keeps its embedded file DB (back up the `wishboard_data` volume). User-uploaded images live in S3 either way.
