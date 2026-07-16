# Changelog

## [1.17.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.16.1...wishboard-v1.17.0) (2026-07-16)


### Features

* add reset-rules support for serverless and kiosk deployments ([#235](https://github.com/plthomasva/wishboard/issues/235)) ([c01cfac](https://github.com/plthomasva/wishboard/commit/c01cfacee2b740965056635cb82a3de49a7a6bd7))
* **aws:** adopt S3 account-regional namespaces and automate bucket migration ([#237](https://github.com/plthomasva/wishboard/issues/237)) ([537359d](https://github.com/plthomasva/wishboard/commit/537359decca5a464da6ad7669d70408728498047))

## [1.16.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.16.0...wishboard-v1.16.1) (2026-07-14)


### Bug Fixes

* **aws:** grant SSM parameter read permission to GitHub OIDC role ([#226](https://github.com/plthomasva/wishboard/issues/226)) ([84145f2](https://github.com/plthomasva/wishboard/commit/84145f28fed87607fc17770b98b0812fbc01bb51))
* expand default role rules ([#233](https://github.com/plthomasva/wishboard/issues/233)) ([3d68e7b](https://github.com/plthomasva/wishboard/commit/3d68e7b2efcc8551c31cddd773b73e4db24b5697))
* wrap loadWishes and loadHiddenWishes in useCallback to resolve stale-closure risk ([#231](https://github.com/plthomasva/wishboard/issues/231)) ([8a2af08](https://github.com/plthomasva/wishboard/commit/8a2af085aaece151cde356feabae168fd259e1bc))


### Performance Improvements

* compress and cache static assets on Pi Nginx and S3 ([#229](https://github.com/plthomasva/wishboard/issues/229)) ([6dce355](https://github.com/plthomasva/wishboard/commit/6dce3550a8c930d4b7115211e039fb5df4ac269b))

## [1.16.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.15.1...wishboard-v1.16.0) (2026-07-13)


### Features

* migrate SVG icons to Noto emoji font and optimize card layouts ([453b53e](https://github.com/plthomasva/wishboard/commit/453b53ebe90ecd9f111ae52843fd49469bb56c53))
* superimpose card action overlays, add unread wishmail badges, and mask passphrase inputs ([453b53e](https://github.com/plthomasva/wishboard/commit/453b53ebe90ecd9f111ae52843fd49469bb56c53))


### Bug Fixes

* resolve kiosk and serverless visual popup/URL bugs ([#221](https://github.com/plthomasva/wishboard/issues/221)) ([ddfa5e5](https://github.com/plthomasva/wishboard/commit/ddfa5e50092554f0045add730d6f5445b6ee0a76)), closes [#196](https://github.com/plthomasva/wishboard/issues/196) [#197](https://github.com/plthomasva/wishboard/issues/197)


### Performance Improvements

* move password hashing off the event loop ([#157](https://github.com/plthomasva/wishboard/issues/157)) ([#223](https://github.com/plthomasva/wishboard/issues/223)) ([f6e299e](https://github.com/plthomasva/wishboard/commit/f6e299ec46d84b0e98aea8da90a9655dff511f73))

## [1.15.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.15.0...wishboard-v1.15.1) (2026-07-12)


### Miscellaneous Chores

* force release v1.15.1 ([#215](https://github.com/plthomasva/wishboard/issues/215)) ([393f4ca](https://github.com/plthomasva/wishboard/commit/393f4ca69a218323ffc85cf5349413b3f16bc76f))

## [1.15.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.14.1...wishboard-v1.15.0) (2026-07-12)


### Features

* implement CLI token, wish exclusions, SVG kiosk icons & suggestion flags ([#212](https://github.com/plthomasva/wishboard/issues/212)) ([57e7ff3](https://github.com/plthomasva/wishboard/commit/57e7ff37a29c19f2c9a82037c72f332c05629cc1))


### Bug Fixes

* **cli:** redact secrets from --dry-run echo + shell-lint (S8689) ([#210](https://github.com/plthomasva/wishboard/issues/210)) ([7da4c2c](https://github.com/plthomasva/wishboard/commit/7da4c2cab7d10c2f6bf48629c66f09d8fbc63af8))

## [1.14.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.14.0...wishboard-v1.14.1) (2026-07-11)


### Bug Fixes

* **kiosk:** --reset-rules resets only the DB rules, not images/whole DB ([#194](https://github.com/plthomasva/wishboard/issues/194)) ([#204](https://github.com/plthomasva/wishboard/issues/204)) ([fcb5e63](https://github.com/plthomasva/wishboard/commit/fcb5e6327e83634269a70c3eb9172fc56eb22d2d))
* **kiosk:** resolve poster + Wi-Fi popup domain at runtime, not build time ([#202](https://github.com/plthomasva/wishboard/issues/202)) ([0ad074c](https://github.com/plthomasva/wishboard/commit/0ad074ce45867151983b72b933257481a5d2ea77))
* **matching:** unspecified orientation must not match everyone ([#199](https://github.com/plthomasva/wishboard/issues/199)) ([#203](https://github.com/plthomasva/wishboard/issues/203)) ([e4acccf](https://github.com/plthomasva/wishboard/commit/e4acccf15075ffb8e7073cc866349a5e79a89ac6))

## [1.14.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.13.0...wishboard-v1.14.0) (2026-07-11)


### Features

* **realtime:** admin-only, subscribed sys:log WebSocket channel ([#189](https://github.com/plthomasva/wishboard/issues/189)) ([#190](https://github.com/plthomasva/wishboard/issues/190)) ([3378575](https://github.com/plthomasva/wishboard/commit/33785754a1d3e074dd6122b59ce706ad1b695226))
* **rules:** store matching rules in the DB, seeded from bundled defaults ([#188](https://github.com/plthomasva/wishboard/issues/188)) ([#193](https://github.com/plthomasva/wishboard/issues/193)) ([9218bea](https://github.com/plthomasva/wishboard/commit/9218beab96c56a3ea0a97d2c6bf773d5c4a1c65b))


### Bug Fixes

* **admin-ui:** surface admin load failures + drop dead sessions to login ([#184](https://github.com/plthomasva/wishboard/issues/184)) ([a302faa](https://github.com/plthomasva/wishboard/commit/a302faa849ab5daeb84be46deea41bc8de81a6e4))

## [1.13.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.12.2...wishboard-v1.13.0) (2026-07-11)


### Features

* **serverless:** migrate DB to Turso, remove VPC/EFS, fix real-time ([#136](https://github.com/plthomasva/wishboard/issues/136)) ([#187](https://github.com/plthomasva/wishboard/issues/187)) ([d15b256](https://github.com/plthomasva/wishboard/commit/d15b256d609e3610930afa8546a4147f37af8602))


### Bug Fixes

* **admin:** 401 for dead sessions, block self-delete, no-store admin responses ([#183](https://github.com/plthomasva/wishboard/issues/183)) ([883970e](https://github.com/plthomasva/wishboard/commit/883970e4778323538b84fcf247b4dac668e683a8))
* **kiosk:** repair dual-mode Wi-Fi AP (ap0 missing, unmanaged, channel-unpinned) ([#172](https://github.com/plthomasva/wishboard/issues/172)) ([fc96e93](https://github.com/plthomasva/wishboard/commit/fc96e9388ff4ea3288cc3ebfc0dc3a29231a5c42))
* **realtime:** stop the sys:log broadcast feedback loop + fail-fast PostToConnection ([#186](https://github.com/plthomasva/wishboard/issues/186)) ([a74fcaa](https://github.com/plthomasva/wishboard/commit/a74fcaa1b159c884ec824409d37fa31ed35bb597))
* **serverless:** make WebSocket real-time work through CloudFront (websocket-mgr was never invoked) ([#185](https://github.com/plthomasva/wishboard/issues/185)) ([13feb8e](https://github.com/plthomasva/wishboard/commit/13feb8ea589c4a93a3b6aedf5c3e8b923b3ea010))
* **sonar:** green the quality gate and enforce it in CI ([#164](https://github.com/plthomasva/wishboard/issues/164)) ([#182](https://github.com/plthomasva/wishboard/issues/182)) ([5d06375](https://github.com/plthomasva/wishboard/commit/5d06375d051bb70be4d1fe6f610b310664ef5ab5))

## [1.12.2](https://github.com/plthomasva/wishboard/compare/wishboard-v1.12.1...wishboard-v1.12.2) (2026-07-09)


### Bug Fixes

* **client:** add a pinned-wish-card favicon ([#170](https://github.com/plthomasva/wishboard/issues/170)) ([3dd2bd9](https://github.com/plthomasva/wishboard/commit/3dd2bd9d1990cc0930b135b5fd8269f7414ae67e))
* **serverless:** parse escaped-quote samconfig overrides; guard blank domain ([#160](https://github.com/plthomasva/wishboard/issues/160)) ([51141f6](https://github.com/plthomasva/wishboard/commit/51141f6cfd86573dce033cd62db93355a2fdf860))

## [1.12.1](https://github.com/plthomasva/wishboard/compare/wishboard-v1.12.0...wishboard-v1.12.1) (2026-07-08)


### Bug Fixes

* **kiosk:** make the Pi container DB deployment work (pin sqld, offline pulls, remote-PRAGMA crash) ([#144](https://github.com/plthomasva/wishboard/issues/144)) ([36fdbd3](https://github.com/plthomasva/wishboard/commit/36fdbd360bfdfd08cd3253cb669db50b3b047348))


### Performance Improvements

* lazy-load opencv/cardProcessor so it isn't fetched on page load ([#141](https://github.com/plthomasva/wishboard/issues/141)) ([138391c](https://github.com/plthomasva/wishboard/commit/138391c2c2c77524db624548c48a782d6e8e6ac2)), closes [#140](https://github.com/plthomasva/wishboard/issues/140)

## [1.12.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.11.0...wishboard-v1.12.0) (2026-07-08)


### Features

* graceful JSON error handling for API writes + friendly client retry ([#138](https://github.com/plthomasva/wishboard/issues/138)) ([ae8bcdf](https://github.com/plthomasva/wishboard/commit/ae8bcdf7066846bf6cab9181b00b8b87681a8513))
* migrate kiosk commands to unified wishboard CLI ([#139](https://github.com/plthomasva/wishboard/issues/139)) ([9baf478](https://github.com/plthomasva/wishboard/commit/9baf478035cef4efca8fc605d28a66630b7426e6))


### Bug Fixes

* **db:** set busy_timeout + guard against WAL on EFS; ADR for serverless DB ([#135](https://github.com/plthomasva/wishboard/issues/135)) ([fe9ea90](https://github.com/plthomasva/wishboard/commit/fe9ea90f6d426bef009cadd6fafe30bd1e2d5ac9))

## [1.11.0](https://github.com/plthomasva/wishboard/compare/wishboard-v1.10.1...wishboard-v1.11.0) (2026-07-02)


### Features

* enforce lint, type-check, format, and secret scanning in CI ([#101](https://github.com/plthomasva/wishboard/issues/101)) ([e1b607e](https://github.com/plthomasva/wishboard/commit/e1b607e6d213cf21cb538129499495f3036a52c2))
* migrate serverless deploy/destroy to unified wishboard CLI ([#118](https://github.com/plthomasva/wishboard/issues/118)) ([1b08d0a](https://github.com/plthomasva/wishboard/commit/1b08d0a0c00ed49c4d01003c4498d13707be91d0))


### Bug Fixes

* **deps:** override qs to ^6.15.2 to resolve DoS advisory ([#103](https://github.com/plthomasva/wishboard/issues/103)) ([932696d](https://github.com/plthomasva/wishboard/commit/932696d3636782b8515874dec0916c6d1f0b22a9))
* make husky prepare cross-platform (Windows cmd has no 'true') ([#117](https://github.com/plthomasva/wishboard/issues/117)) ([0679570](https://github.com/plthomasva/wishboard/commit/06795708f09addf7a47e547b3c8dc5521f700c6e))

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
