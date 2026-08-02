# Contributing to `@wishboards/matching-engine`

Thank you for your interest in contributing to `@wishboards/matching-engine`!

## Development & Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/wishboards/matching-engine.git
   cd matching-engine
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Run tests & type check**:
   ```bash
   npm test            # Run unit tests via Vitest
   npm run type-check   # Type check with tsc
   npm run build        # Build ESM + .d.ts files
   ```

## Pull Request Guidelines

1. **Conventional Commits**: Commit messages and PR titles should use Conventional Commits format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
2. **Unit Tests**: Ensure all existing tests pass and add unit test coverage for any new rule evaluation cases or matching behavior.
3. **Zero Dependencies**: `@wishboards/matching-engine` is designed to have zero runtime dependencies. Do not add external npm packages to `dependencies`.

## License

By contributing, you agree that your contributions will be licensed under the package's [CC BY-NC 4.0 License](LICENSE).
