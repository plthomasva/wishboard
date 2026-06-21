# Wishboard

Offline wish board for conventions, built to run on a Raspberry Pi or similar local device.

## Goals

- Run entirely disconnected from the Internet
- Provide tablet/kiosk views for wish entry and search
- Provide a rotating big-screen display of active wishes
- Support admin review and removal of flagged content
- Use a lightweight local database and open source stack
- Support identity-aware search compatibility for wishes and users

## Architecture

- Backend: Node.js + Express
- Database: SQLite (local file under `data/`)
- Frontend: React + Vite
- Offline Hosting: static assets served locally by Express

## Project structure

- `src/server/` — backend API and static file serving
- `src/client/` — React app for kiosk, search, admin and display
- `data/` — local SQLite database file storage

## Getting started

### Using Docker (Recommended)

You can run Wishboard using the pre-built Docker container published to the GitHub Container Registry:

```bash
docker run -d \
  -p 3000:3000 \
  -v wishboard_data:/app/data \
  --name wishboard \
  ghcr.io/plthomasva/wishboard:latest
```

Alternatively, if you prefer `docker-compose`, a `docker-compose.yml` file is provided in the repository.

### Local Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the client and start the server:

   ```bash
   npm start
   ```

3. Open a browser to `http://localhost:3000`

## Development

- `npm run dev` — start Vite development server for the client and the Express backend concurrently with hot-reloading
- `npm run build` — produce production assets in `dist/`
- `npm start` — build and launch the Express server
- `npm test` — run the test suite
- `npm run test:coverage` — run tests with coverage reporting

## Documentation

Detailed guides and documentation can be found in the `docs/` directory:

- [**Deployment Guide**](docs/DEPLOYMENT_GUIDE.md) - Instructions for securely deploying Wishboard as a locked-down offline Wi-Fi kiosk on a Raspberry Pi.
- [**Matching Rules**](docs/MATCHING_RULES.md) - A deep dive into how the matchmaking engine implicitly maps, expands, and cross-matches user identities.
- [**Mutation Testing**](docs/MUTATION_TESTING.md) - Details on how we use Stryker to guarantee robust unit testing, and how to view the daily automated reports.

## User Interface

- The web interface is **mobile-first** and features large tap targets suitable for kiosk touchscreens. Identity fields use tap-friendly autocompletion suggestion pills.
- The UI is **self-documenting**: users can tap the inline info toggle (`ⓘ`) next to input fields to read conversational, non-intrusive help text explaining how matchmaking and attributes work.
- **Cross-device continuity**: To support users switching from kiosks to phones, the system generates QR codes encoding deep links. Anonymous wish creators can scan a QR code to securely manage their specific wish on their phone, and registered users can scan a QR code from their account page to instantly auto-login via a session token URL.
- **Anonymous Wish Claiming**: Registered users can adopt previously anonymous wishes into their account using the wish ID and passphrase.

## Remote access

- The production server listens on all network interfaces by default, so remote developers can access the app if the host is reachable on port `3000`.
- Use `http://<host>:3000/` to open the live preview.
- For cloud or tunneling-based development, expose port `3000` securely and point collaborators to the same URL.

## Contributing & Releases

Wishboard uses `release-please` and GitHub Actions to automatically manage semantic versioning and changelogs.

- To cut a new release, merge a Pull Request into `main` using Conventional Commits (e.g., `feat: added poster`, `fix: proxy error`).
- A Release PR will automatically be opened. Merging that PR will publish a new Docker image to `ghcr.io`.

## Administration & Monitoring

- **Admin Account**: An admin account is created automatically on first run. Default credentials can be customized via `WISHBOARD_ADMIN_USERNAME` and `WISHBOARD_ADMIN_SECRET` environment variables.
- **Log Viewer**: Application logs and web requests are recorded to rotating files in `data/logs`. Admins can view a live-tailing log feed directly within the Admin Dashboard.
- **System Metrics**: Admins have access to a real-time system metrics dashboard securely protected by a one-time ticket system.
- **Demo Seeder**: The admin panel includes a demo seeder to populate users and wishes for development or testing.

## Notes

- The system is designed for a private Wi-Fi network and on-device deployment.
