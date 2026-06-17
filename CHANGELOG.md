# Changelog

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
