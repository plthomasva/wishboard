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

- `npm run dev` — start Vite development server for the client
- `npm run build` — produce production assets in `dist/`
- `npm start` — build and launch the Express server
- `npm test` — run the test suite
- `npm run test:coverage` — run tests with coverage reporting

## Wish metadata and search

- Users may register with identity metadata, including gender, orientation, and role.
- Wishes can include creator identity metadata and desired fulfiller targets.
- Search uses logged-in profile attributes by default when available.
- Logged-in users can temporarily disable profile matching to perform broad keyword searches.
- Anonymous searchers may provide temporary gender/orientation/role values for a one-off compatibility query.

## Remote access

- The production server listens on all network interfaces by default, so remote developers can access the app if the host is reachable on port `3000`.
- Use `http://<host>:3000/#/remote` to open the combined live preview with both kiosk and main display.
- For cloud or tunneling-based development, expose port `3000` securely and point collaborators to the same URL.

## Notes

- The system is designed for a private Wi-Fi network and on-device deployment.
- The admin interface is protected by an admin account created automatically on first run.
- The admin panel includes a demo seeder to populate users and wishes for development or testing.
- Set `WISHBOARD_ADMIN_USERNAME` and `WISHBOARD_ADMIN_SECRET` in the environment to customize the default admin credentials.
