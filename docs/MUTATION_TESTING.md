# Mutation Testing with Stryker

Wishboard uses [Stryker](https://stryker-mutator.io/) to perform **mutation testing** on both the frontend and backend codebase. Mutation testing helps us guarantee the robustness of our unit and integration tests by automatically inserting small logic bugs (mutants) into the codebase and verifying that our test suite catches them.

## Daily Automated Run

Stryker can take several hours to evaluate the entire project because it runs the complete test suite thousands of times (once for every generated mutant). 

To avoid slowing down local development and Pull Requests, we have configured a GitHub Actions workflow (`.github/workflows/stryker.yml`) to automatically run the full suite every night at midnight UTC.

### Viewing the Daily Report

The GitHub Action automatically hosts the interactive HTML report natively on GitHub Pages. 

You can view the latest mutation testing report here:
> **[Wishboard Daily Mutation Report](https://plthomasva.github.io/wishboard/)**

This interactive dashboard allows you to click through the directory structure, view exactly which lines of code were mutated, and see which mutants "survived" (meaning a logic operator was changed, but the tests still passed).

## Running Stryker Locally

If you are working on a specific feature or file and want to see how robust your tests are before committing, you can run Stryker locally on a targeted subset of the codebase.

1. **Build the Application First**: Stryker tests our frontend production bundle routing, so you must always ensure the `dist/` directory is built and up to date before running it.
   ```bash
   npm run build
   ```

2. **Run Stryker on a Specific File**: We highly recommend running Stryker on specific files using the `-m` (mutate) flag to save time.
   ```bash
   npx stryker run -m src/server/db.js
   ```

3. **Run Stryker on a Directory**:
   ```bash
   npx stryker run -m src/server/routes
   ```

4. **View Local Results**: Once complete, Stryker will generate a local HTML report in `reports/mutation/html/index.html` which you can open in your browser.

## Configuration

Stryker is configured via `stryker.config.json`. We use a custom Vite configuration (`stryker.vite.config.ts`) during the Stryker test runs to exclude `src/server/index.test.js`, as it performs sandbox manipulations that interfere with Stryker's concurrent test execution environment.
