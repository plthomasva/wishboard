# Changelog

## [1.4.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.3.0...wishboard-v1.4.0) (2026-06-19)


### Features

* implement advanced match criteria toggle and deactivation UI ([360550f](https://github.com/plthomasva/wishboard/commit/360550f48e652169886721e3061fd528d38bf926))
* implement advanced match criteria toggle and deactivation UI ([6a40f97](https://github.com/plthomasva/wishboard/commit/6a40f97ee84b1771f5cdc6c72a22bcb08c976cb8))


### Bug Fixes

* container start failure from missing javascript file copy ([809b3d5](https://github.com/plthomasva/wishboard/commit/809b3d5f46c483b6eace96223af025627b30dc0e))
* correct getByText test matcher for wishes count split by tags ([358603e](https://github.com/plthomasva/wishboard/commit/358603ea8eba3f72d3f624125bd8b3da2c7d8bfe))
* correct log tailing ([fa142cf](https://github.com/plthomasva/wishboard/commit/fa142cf3c2f1eb8f11761c83a3981ec8ac7575ad))
* ensure tests pass with real timers ([d167b65](https://github.com/plthomasva/wishboard/commit/d167b650814ad25cc5effc903029be0d3885295e))
* refactor users.js to fix sonarqube duplication limit ([d3552d9](https://github.com/plthomasva/wishboard/commit/d3552d94977d28a6d4a5c4193162c83f12607a67))
* resolve markdown and dockerfile linting warnings ([cc25aed](https://github.com/plthomasva/wishboard/commit/cc25aed996b733827e4e1daad6166c7584e3167c))

## [1.3.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.4...wishboard-v1.3.0) (2026-06-19)


### Features

* display app version on About page ([57320c2](https://github.com/plthomasva/wishboard/commit/57320c25a75d23e46c16cacbe1034cf03169d1d7))


### Bug Fixes

* extract PosterPage inline styles to resolve linter errors ([57320c2](https://github.com/plthomasva/wishboard/commit/57320c25a75d23e46c16cacbe1034cf03169d1d7))
* resolve sonar warnings in logger.js and WiFiQrCode.tsx ([57320c2](https://github.com/plthomasva/wishboard/commit/57320c25a75d23e46c16cacbe1034cf03169d1d7))

## [1.2.4](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.3...wishboard-v1.2.4) (2026-06-18)


### Bug Fixes

* improve documentation and add poster generator ([5d8aedc](https://github.com/plthomasva/wishboard/commit/5d8aedc3a04cea0ad36cee57e7ec4f797a06fea4))
* SonarCloud issues: cognitive complexity, accessibility, and types ([#43](https://github.com/plthomasva/wishboard/issues/43)) ([e54fa6e](https://github.com/plthomasva/wishboard/commit/e54fa6e997575547d12edd2923046b76ff84c288))

## [1.2.3](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.2...wishboard-v1.2.3) (2026-06-18)


### Bug Fixes

* remove bookworm/openbox support ([1415c54](https://github.com/plthomasva/wishboard/commit/1415c548bfdb405a7c76f2b4157b8446d73a72fd))

## [1.2.2](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.1...wishboard-v1.2.2) (2026-06-18)


### Bug Fixes

* correct socket config on remote pi ([0c973b3](https://github.com/plthomasva/wishboard/commit/0c973b37a10abb590f3cafbe83fa461fdcc32da7))
* read version from package.json instead of standalone file ([9191770](https://github.com/plthomasva/wishboard/commit/9191770491c9ad3f6315fadaf1a47e3b20dfa70f))
* use concurrently in dev mode ([12106dc](https://github.com/plthomasva/wishboard/commit/12106dc98b3ce8f6275616f8f901721877ed6d0c))

## [1.2.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.2.0...wishboard-v1.2.1) (2026-06-17)


### Bug Fixes

* dockerignore data folder and sanitize release tags ([2ab5d7f](https://github.com/plthomasva/wishboard/commit/2ab5d7fa44276f492462ad5b5613775589cdbc48))
* kiosk version update ([8352fbe](https://github.com/plthomasva/wishboard/commit/8352fbe587897be0f11a35b292291d867e1c407b))

## [1.2.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.1.0...wishboard-v1.2.0) (2026-06-17)


### Features

* isolate container within dedicated wishboard rootless docker daemon ([5735319](https://github.com/plthomasva/wishboard/commit/5735319062a7c8889c79b7fa4b411d9c1b2d6f5c))

## [1.1.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.0.0...wishboard-v1.1.0) (2026-06-17)


### Features

* migrate raspberry pi deployment scripts to use docker ([e0aafd7](https://github.com/plthomasva/wishboard/commit/e0aafd79303416090cc254150bd013d903c14fc7))


### Bug Fixes

* correctly extract tag name for docker metadata ([7bf9c21](https://github.com/plthomasva/wishboard/commit/7bf9c219c5eba60f56b9264853a8be833c6928d8))

## 1.0.0 (2026-06-17)

### 🚀 Features

* **Initial Stable Release:** First major release of Wishboard, an offline-first wish board designed for conventions and local deployment.
* **Kiosk & Display Modes:** Dedicated tablet/kiosk views for wish entry and a rotating big-screen display for active wishes.
* **Identity-Aware Matchmaking:** Advanced search system supporting explicit and implicit matching based on gender, orientation, and role.
* **Mobile-First UI & Continuity:** Touch-friendly interface with QR code integration for secure cross-device session transfers.
* **Admin Dashboard:** Built-in tools for reviewing flagged content, viewing live logs, managing users, and monitoring system metrics.
* **Raspberry Pi Deployment:** Automated deployment scripts for setting up secure, locked-down Chromium Wayland kiosks on Raspberry Pi.

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
