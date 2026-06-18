# Changelog

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
