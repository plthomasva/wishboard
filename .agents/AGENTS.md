# Project Style Guidelines & Conventions

This document outlines the core coding conventions, architectural patterns, environment rules, and testing guidelines for the **Wishboard** project. All autonomous agents and developers working on this project should adhere to these principles.

---

## 1. Project Context & Stack

* **Description:** A private, disconnected wish board for conventions running on local hardware (e.g., Raspberry Pi 4) or deployed via an AWS serverless stack (Lambda + API Gateway + SQLite on EFS + CloudFront + S3).
* **Backend:** Node.js (ES modules), Express, SQLite (`libsql` or native sqlite3), WebSockets (using `socket.io` for standard and AWS API Gateway for serverless).
* **Frontend:** React, TypeScript, Vite.
* **Database:** SQLite. Remote database migrations are handled via custom local-to-remote migration scripts.

---

## 2. Coding & Syntax Conventions

* **Global Accessors:** In TypeScript files, always prefer `globalThis` over `window`, `self`, or `global` to align with SonarQube quality gate conventions and maintain environment-agnostic execution.
* **Conventional Commits:** Always use conventional commit structures (e.g., `feat:`, `fix:`, `refactor:`, `test:`, `docs:`) for git commits and Pull Request titles. These are used to generate release change logs automatically.

---

## 3. Architecture & Matching Engine Rules

* **Configuration-Driven Rules:** Do not hardcode gender, orientation, or role matching logic inside the backend code. The matchmaking system utilizes a dynamic rule system defined in `data/rules.yaml`.
* **Rule Types:**
  1. `enrichment`: Implicitly adds a target attribute if the trigger matches (e.g., adding `woman` if orientation is `lesbian`).
  2. `acceptance`: Overrides matching to automatically accept a broad set of targets (e.g., pan/queer orientations matching all genders).
  3. `expansion`: Synonyms and variants mapping (e.g., expanding `enby`, `non-binary` to `nonbinary`).
  4. `cross_match`: Bidirectional matches between complementary roles.
* **Extending Matching Logic:** To add support for new identities or matching terms, modify the rules in `data/rules.yaml` rather than introducing custom parsing helpers in `src/server/routes/wishes.js`.

---

## 4. Testing & Quality Gates

* **Coverage Threshold:** SonarQube applies an **80% test coverage threshold** specifically to **new code** introduced on branches. Ensure any code changes are accompanied by robust unit test coverage.
* **PR Verification:** When checking Pull Request status, use the SonarQube MCP or SonarCloud dashboard to check for test failures, duplicate code blocks, or security hotspots rather than relying solely on local test suite runs.
* **Testing Command:**
  * To run the test suite:

    ```powershell
    npm test
    ```

  * To run tests in watch mode:

    ```powershell
    npm run test:watch
    ```
