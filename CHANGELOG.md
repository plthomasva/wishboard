# Changelog

## [1.10.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.10.0...wishboard-v1.10.1) (2026-07-01)

### Bug Fixes

- proxy /images path in vite.config.ts for local dev mode ([77f5abf](https://github.com/plthomasva/wishboard/commit/77f5abf9c2c79e258e89d7e472026ceae189cc2a))
- render image wishes correctly without borders, padding, or OCR text fallback ([77f5abf](https://github.com/plthomasva/wishboard/commit/77f5abf9c2c79e258e89d7e472026ceae189cc2a))
- resolve OpenCV client-side loading and initialization error ([77f5abf](https://github.com/plthomasva/wishboard/commit/77f5abf9c2c79e258e89d7e472026ceae189cc2a))

## [1.10.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.9.2...wishboard-v1.10.0) (2026-07-01)

### Features

- introduce unified deployment cli and migrate oidc scripts ([#97](https://github.com/plthomasva/wishboard/issues/97)) ([8276d1b](https://github.com/plthomasva/wishboard/commit/8276d1b193abb44694d4c2cea8eeb95fe0a48a23))

## [1.9.2](https://github.com/plthomasva/wishboard/compare/wishboard-v1.9.1...wishboard-v1.9.2) (2026-07-01)

### Bug Fixes

- clean up and improve consistency of system logs ([#94](https://github.com/plthomasva/wishboard/issues/94)) ([210060d](https://github.com/plthomasva/wishboard/commit/210060de2d6c96f0beadb1d4600530522bbf552f))
- extract card processor utility and fix upload flow ([#96](https://github.com/plthomasva/wishboard/issues/96)) ([e1cace5](https://github.com/plthomasva/wishboard/commit/e1cace54eacd25992d687d7026441fcbc8b3e06f))

## [1.9.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.9.0...wishboard-v1.9.1) (2026-06-29)

### Bug Fixes

- enable deployment from GitLab runners ([#92](https://github.com/plthomasva/wishboard/issues/92)) ([e1efaff](https://github.com/plthomasva/wishboard/commit/e1efaffd9a7098ff2a5f87f4d37b71e46399d2d7))
- query API and WebSocket log groups in parallel, remove invalid filter pattern ([fbd8609](https://github.com/plthomasva/wishboard/commit/fbd860931e41bb7a4b26785c5ecc18d34a208ceb))
- seed default rules on EFS if existing rules file is empty or invalid ([#93](https://github.com/plthomasva/wishboard/issues/93)) ([6b54587](https://github.com/plthomasva/wishboard/commit/6b545870e1041b4938ca8b2061ae905f56f30caf))

## [1.9.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.8.1...wishboard-v1.9.0) (2026-06-28)

### Features

- replace express-status-monitor with native Recharts dashboards ([#89](https://github.com/plthomasva/wishboard/issues/89)) ([5b0d532](https://github.com/plthomasva/wishboard/commit/5b0d532f1c08b2a36801dee8df77214dd624d20d))

## [1.8.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.8.0...wishboard-v1.8.1) (2026-06-27)

### Bug Fixes

- isolate rules test files to prevent EBUSY locks during parallel runs ([11cf822](https://github.com/plthomasva/wishboard/commit/11cf8227df3697b1eb734c0163dd1f1d71e0ead1))

## [1.8.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.7.1...wishboard-v1.8.0) (2026-06-27)

### Features

- add AWS serverless deployment target with full functional parity ([#75](https://github.com/plthomasva/wishboard/issues/75)) ([3811772](https://github.com/plthomasva/wishboard/commit/38117725879081a124d57ebb7162777d31a7716e))

## [1.7.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.7.0...wishboard-v1.7.1) (2026-06-26)

### Bug Fixes

- address Stryker dry-run failure and IDE lint ([65c6b15](https://github.com/plthomasva/wishboard/commit/65c6b15563e26771c45f7995c8ffc418f768a2c7))
- align stryker html report output path with workflow upload path ([#74](https://github.com/plthomasva/wishboard/issues/74)) ([53437a9](https://github.com/plthomasva/wishboard/commit/53437a9b58ac53b85bc26ab52402dd2830911f77))

## [1.7.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.6.0...wishboard-v1.7.0) (2026-06-24)

### Features

- handwritten wish image uploads with client-side OCR ([#68](https://github.com/plthomasva/wishboard/issues/68)) ([2289521](https://github.com/plthomasva/wishboard/commit/228952102a6f68eb7fc9f814f1f41a933939fc3d))
- migrate application to Docker Compose and libsql database ([#71](https://github.com/plthomasva/wishboard/issues/71)) ([525ddda](https://github.com/plthomasva/wishboard/commit/525ddda089a11bf38bd722cba09e578589f80310))

### Bug Fixes

- stryker action configuration and vitest segfault ([#69](https://github.com/plthomasva/wishboard/issues/69)) ([a67f50c](https://github.com/plthomasva/wishboard/commit/a67f50c95524f7ad795e74eb603f1d9e8b1f55fc))

## [1.6.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.5.0...wishboard-v1.6.0) (2026-06-21)

### Features

- improve admin dashboard user delete modal and demo seeder ([c868942](https://github.com/plthomasva/wishboard/commit/c868942b3e8f8dce7a67e3a11ab1b71ed2801fe5))

### Bug Fixes

- conditionally render demo seeder based on runtime backend environment ([c868942](https://github.com/plthomasva/wishboard/commit/c868942b3e8f8dce7a67e3a11ab1b71ed2801fe5))
- run entrypoint as root to fix volume permissions before dropping to node user ([c868942](https://github.com/plthomasva/wishboard/commit/c868942b3e8f8dce7a67e3a11ab1b71ed2801fe5))

## [1.5.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.4.3...wishboard-v1.5.0) (2026-06-20)

### Features

- automate pull request preview image generation and cleanup using GitHub Actions ([ac03f19](https://github.com/plthomasva/wishboard/commit/ac03f19f33db1d86ec581c98a593e96f65f15ce0))

### Bug Fixes

- resolve Dockerfile security hotspots by applying explicit permissions and non-root users ([ac03f19](https://github.com/plthomasva/wishboard/commit/ac03f19f33db1d86ec581c98a593e96f65f15ce0))
- simplify negated boolean expression in AuthContext ([ac03f19](https://github.com/plthomasva/wishboard/commit/ac03f19f33db1d86ec581c98a593e96f65f15ce0))
- update delete user modal to use correct kiosk CSS classes ([ac03f19](https://github.com/plthomasva/wishboard/commit/ac03f19f33db1d86ec581c98a593e96f65f15ce0))

## [1.4.3](https://github.com/plthomasva/wishboard/compare/wishboard-v1.4.2...wishboard-v1.4.3) (2026-06-19)

### Bug Fixes

- **docker:** explicitly rebuild better-sqlite3 for security ([a9c6932](https://github.com/plthomasva/wishboard/commit/a9c69322c11df15f12f958afd01425f3dc339dd9))

## [1.4.2](https://github.com/plthomasva/wishboard/compare/wishboard-v1.4.1...wishboard-v1.4.2) (2026-06-19)

### Bug Fixes

- **docker:** support native better-sqlite3 bindings for arm64 ([42fcc6d](https://github.com/plthomasva/wishboard/commit/42fcc6da9c24f37dbd23ca03a9df6506a2ace20b))

## [1.4.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.4.0...wishboard-v1.4.1) (2026-06-19)

### Bug Fixes

- add arm64 arch and modify docker compose ([728a064](https://github.com/plthomasva/wishboard/commit/728a064f03ba663c43c489ba95e3adc91861e2e5))

## [1.4.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.3.0...wishboard-v1.4.0) (2026-06-19)

### Features

- implement advanced match criteria toggle and deactivation UI ([360550f](https://github.com/plthomasva/wishboard/commit/360550f48e652169886721e3061fd528d38bf926))
- implement advanced match criteria toggle and deactivation UI ([6a40f97](https://github.com/plthomasva/wishboard/commit/6a40f97ee84b1771f5cdc6c72a22bcb08c976cb8))

### Bug Fixes

- container start failure from missing javascript file copy ([809b3d5](https://github.com/plthomasva/wishboard/commit/809b3d5f46c483b6eace96223af025627b30dc0e))
- correct getByText test matcher for wishes count split by tags ([358603e](https://github.com/plthomasva/wishboard/commit/358603ea8eba3f72d3f624125bd8b3da2c7d8bfe))
- correct log tailing ([fa142cf](https://github.com/plthomasva/wishboard/commit/fa142cf3c2f1eb8f11761c83a3981ec8ac7575ad))
- ensure tests pass with real timers ([d167b65](https://github.com/plthomasva/wishboard/commit/d167b650814ad25cc5effc903029be0d3885295e))
- refactor users.js to fix sonarqube duplication limit ([d3552d9](https://github.com/plthomasva/wishboard/commit/d3552d94977d28a6d4a5c4193162c83f12607a67))
- resolve markdown and dockerfile linting warnings ([cc25aed](https://github.com/plthomasva/wishboard/commit/cc25aed996b733827e4e1daad6166c7584e3167c))

## [1.3.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.4...wishboard-v1.3.0) (2026-06-19)

### Features

- display app version on About page ([57320c2](https://github.com/plthomasva/wishboard/commit/57320c25a75d23e46c16cacbe1034cf03169d1d7))

### Bug Fixes

- extract PosterPage inline styles to resolve linter errors ([57320c2](https://github.com/plthomasva/wishboard/commit/57320c25a75d23e46c16cacbe1034cf03169d1d7))
- resolve sonar warnings in logger.js and WiFiQrCode.tsx ([57320c2](https://github.com/plthomasva/wishboard/commit/57320c25a75d23e46c16cacbe1034cf03169d1d7))

## [1.2.4](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.3...wishboard-v1.2.4) (2026-06-18)

### Bug Fixes

- improve documentation and add poster generator ([5d8aedc](https://github.com/plthomasva/wishboard/commit/5d8aedc3a04cea0ad36cee57e7ec4f797a06fea4))
- SonarCloud issues: cognitive complexity, accessibility, and types ([#43](https://github.com/plthomasva/wishboard/issues/43)) ([e54fa6e](https://github.com/plthomasva/wishboard/commit/e54fa6e997575547d12edd2923046b76ff84c288))

## [1.2.3](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.2...wishboard-v1.2.3) (2026-06-18)

### Bug Fixes

- remove bookworm/openbox support ([1415c54](https://github.com/plthomasva/wishboard/commit/1415c548bfdb405a7c76f2b4157b8446d73a72fd))

## [1.2.2](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.1...wishboard-v1.2.2) (2026-06-18)

### Bug Fixes

- correct socket config on remote pi ([0c973b3](https://github.com/plthomasva/wishboard/commit/0c973b37a10abb590f3cafbe83fa461fdcc32da7))
- read version from package.json instead of standalone file ([9191770](https://github.com/plthomasva/wishboard/commit/9191770491c9ad3f6315fadaf1a47e3b20dfa70f))
- use concurrently in dev mode ([12106dc](https://github.com/plthomasva/wishboard/commit/12106dc98b3ce8f6275616f8f901721877ed6d0c))

## [1.2.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.0...wishboard-v1.2.1) (2026-06-17)

### Bug Fixes

- dockerignore data folder and sanitize release tags ([2ab5d7f](https://github.com/plthomasva/wishboard/commit/2ab5d7fa44276f492462ad5b5613775589cdbc48))
- kiosk version update ([8352fbe](https://github.com/plthomasva/wishboard/commit/8352fbe587897be0f11a35b292291d867e1c407b))

## [1.2.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.1.0...wishboard-v1.2.0) (2026-06-17)

### Features

- isolate container within dedicated wishboard rootless docker daemon ([5735319](https://github.com/plthomasva/wishboard/commit/5735319062a7c8889c79b7fa4b411d9c1b2d6f5c))

## [1.1.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.0.0...wishboard-v1.1.0) (2026-06-17)

### Features

- migrate raspberry pi deployment scripts to use docker ([e0aafd7](https://github.com/plthomasva/wishboard/commit/e0aafd79303416090cc254150bd013d903c14fc7))

### Bug Fixes

- correctly extract tag name for docker metadata ([7bf9c21](https://github.com/plthomasva/wishboard/commit/7bf9c219c5eba60f56b9264853a8be833c6928d8))

## 1.0.0 (2026-06-17)

### 🚀 Features

- **Initial Stable Release:** First major release of Wishboard, an offline-first wish board designed for conventions and local deployment.
- **Kiosk & Display Modes:** Dedicated tablet/kiosk views for wish entry and a rotating big-screen display for active wishes.
- **Identity-Aware Matchmaking:** Advanced search system supporting explicit and implicit matching based on gender, orientation, and role.
- **Mobile-First UI & Continuity:** Touch-friendly interface with QR code integration for secure cross-device session transfers.
- **Admin Dashboard:** Built-in tools for reviewing flagged content, viewing live logs, managing users, and monitoring system metrics.
- **Raspberry Pi Deployment:** Automated deployment scripts for setting up secure, locked-down Chromium Wayland kiosks on Raspberry Pi.

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
