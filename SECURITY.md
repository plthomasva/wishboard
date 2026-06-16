# Security Policy

## Supported Versions
Only the latest branch of Wishboard is actively supported with security updates.

## Reporting a Vulnerability
Please use GitHub Security Advisories to privately report any vulnerabilities.

## Known Audit Exceptions

During regular `npm audit` checks, you may encounter warnings regarding dependencies in `express-status-monitor`. We have explicitly chosen **not** to downgrade or force-upgrade this package.

### Why we do not downgrade `express-status-monitor`
Running `npm audit fix --force` will destructively downgrade `express-status-monitor` from version `1.3.x` to `1.2.x`. This downgrade can re-introduce older bugs and break compatibility with the current Express application.

### Why we do not use NPM overrides for its dependencies
The vulnerabilities typically stem from its internal use of `axios` and `socket.io@2.x`.
- Forcing `socket.io` to `4.x` via `package.json` overrides breaks the dashboard because the pre-compiled frontend client bundled with `express-status-monitor` specifically expects a v2 WebSocket connection. 

### Why these vulnerabilities are safe to ignore in our implementation
The reported vulnerabilities are completely mitigated by our architectural implementation:
1. **`axios` (SSRF & Prototype Pollution)**: `express-status-monitor` only utilizes Axios if external "Health Checks" are configured. Wishboard initializes the monitor with `{ path: '' }` and configures no external health checks. Consequently, the Axios code paths are entirely unreachable dead code in our environment.
2. **`socket.io`, `engine.io`, `cookie`**: These vulnerabilities only affect the WebSocket server. Wishboard explicitly isolates the entire metrics dashboard and its websocket endpoint behind a strict `requireAdmin` authentication wall and a one-time "metrics ticket" system. Unauthenticated users cannot establish the socket connection required to attempt the cookie parser or DoS exploits.

### What conditions are necessary to resolve these findings?
To fully clear these audit warnings without breaking the dashboard, we must wait for the maintainers of `express-status-monitor` to release a new version (e.g., `2.0.0`) that natively upgrades its internal WebSocket engine to `socket.io@4.x` and updates `axios` to `^1.7.0`. Once that modernized version is published, we can safely bump `express-status-monitor` and cleanly clear the warnings.
