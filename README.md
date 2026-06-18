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

## Wish metadata and search

- Users may register with identity metadata, including gender, orientation, and role.
- Wishes can include creator identity metadata and desired fulfiller targets.
- **Explicit Match Overrides**: If a user specifies a desired trait (e.g. a specific gender), it strictly overrides implicit rules.
- **Implicit Rules**: If desired traits are left blank, the system relies on the creator's orientation. For example, a straight user implicitly matches only with binary opposite genders.
- Search uses logged-in profile attributes by default when available.
- Logged-in users can temporarily disable profile matching to perform broad keyword searches.
- Anonymous searchers may provide temporary gender/orientation/role values for a one-off compatibility query.

## User Interface

- The web interface is **mobile-first** and features large tap targets suitable for kiosk touchscreens. Identity fields use tap-friendly autocompletion suggestion pills.
- The UI is **self-documenting**: users can tap the inline info toggle (`ⓘ`) next to input fields to read conversational, non-intrusive help text explaining how matchmaking and attributes work.
- **Cross-device continuity**: To support users switching from kiosks to phones, the system generates QR codes encoding deep links. Anonymous wish creators can scan a QR code to securely manage their specific wish on their phone, and registered users can scan a QR code from their account page to instantly auto-login via a session token URL.
- **Anonymous Wish Claiming**: Registered users can adopt previously anonymous wishes into their account using the wish ID and passphrase.

## Remote access

- The production server listens on all network interfaces by default, so remote developers can access the app if the host is reachable on port `3000`.
- Use `http://<host>:3000/` to open the live preview.
- For cloud or tunneling-based development, expose port `3000` securely and point collaborators to the same URL.

## Raspberry Pi Kiosk Deployment

Wishboard includes automation to deploy the application as a secure, full-screen kiosk on a Raspberry Pi.

**Requirements:**

- **OS**: Raspberry Pi OS based on **Debian 13 (Trixie)** or newer. The setup relies on the `labwc` Wayland compositor, which is the new default standard replacing X11/Mutter.
- **Network**: The Pi must be reachable via SSH.

For a full step-by-step walkthrough on how to set up SSL certificates, custom domains, and configure environment variables on a fresh Pi, please see the [**Deployment Guide**](docs/DEPLOYMENT_GUIDE.md).

**Deployment:**
Run the appropriate orchestrator script for your operating system from the project directory. You can deploy in three networking modes:
- `prod`: The Pi acts as an isolated Wi-Fi Hotspot and redirects all DNS queries for the domain to itself. (Standard offline mode).
- `dual`: The Pi maintains its internet connection via `wlan0` but creates a virtual `ap0` Hotspot for local access. Useful for debugging or setting up.
- `dev`: The Pi simply connects to an existing Wi-Fi network. You access it using its assigned IP address on that network.

**For Windows (PowerShell):**

```powershell
.\scripts\deploy-kiosk.ps1 -AdminUsername pi -HostName raspberrypi.local
```

**For macOS / Linux (Bash):**

```bash
./scripts/deploy-kiosk.sh pi raspberrypi.local
```

**What the script does:**

- Disables TTY autologin for the `pi` user to secure physical access (`Ctrl-Alt-F1`).
- Creates a dedicated locked-down `wishboard` user.
- Configures `LightDM` to auto-login the `wishboard` user.
- Configures `labwc` to automatically launch Chromium in incognito kiosk mode pointed at `http://localhost:3000`.
- Pulls the latest pre-built Docker image from the GitHub Container Registry.
- Deploys the application inside an isolated Rootless Docker container for maximum security.

**Kiosk Shortcuts:**

- To cleanly exit the Wayland kiosk and drop back to the standard LightDM graphical login screen, press `Ctrl-Alt-Q`.

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
