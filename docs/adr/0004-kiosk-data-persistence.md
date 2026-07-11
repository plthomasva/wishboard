# ADR 0004: Kiosk data persistence (bind mount vs. named volume on the Pi)

- **Status:** Proposed
- **Date:** 2026-07

## Context

The Wishboard kiosk runs on a single Raspberry Pi under **rootless Docker**, orchestrated by `docker-compose.yml` and deployed by `scripts/build-kiosk.sh`. Unlike the serverless target (Turso + no local disk, see [ADR 0002](0002-serverless-database-architecture.md)), the kiosk keeps **all** persistent state on the Pi's SD card, split across **two independent surfaces** that are easy to conflate:

- **The app `./data` bind mount** — `./data:/app/data` on the `wishboard` service. This holds **uploaded images** (`data/images/`) and, historically, the legacy `rules.yaml`. It is a bind mount so ownership maps straight to the `wishboard` host user; the image also ships a bundled `data/` (`COPY data ./data`) and chowns it to `node:node`, and the entrypoint re-chowns `/app/data` on every start to cover a freshly-mounted volume. `.gitignore` ignores `data/*` except `data/.gitkeep`, so the directory exists in-repo but carries no runtime data.
- **The `db_data` named volume** — `db_data:/var/lib/sqld` on the `db` (libsql-server) service. This backs the SQLite database itself. On the kiosk the app talks to the DB **over the network** (`DATABASE_URL=http://db:8080`), not to a local file, so `src/server/db.js` takes its remote-libSQL branch: no local `wishboard.db` is created under `/app/data` when a `DATABASE_URL` is set. **The database does not live in `./data`** — a distinction that is the root of the `--reset-rules` bug below.

Since #193/#188, matching **rules live in a `rules` table in the DB**, not in `rules.yaml`. That means rules now sit in `db_data`, while images still sit in `./data`. The two surfaces have different lifecycles, different ownership models, and different reset semantics — and several deploy-script behaviors predate the split.

Three concrete problems motivate this ADR: a **clobber bug** in the legacy-volume migration (fixed with #193), an **open ownership decision** under rootless Docker (#145), and a **destructive, misnamed `--reset-rules`** flag (#194).

## Architecture

```text
Raspberry Pi (rootless Docker, user: wishboard)
│
├── ./data  ──bind mount──▶  wishboard container  /app/data
│     (host: ~wishboard/wishboard/data)              │
│      • data/images/   (uploaded images)            ├─ image bundles data/ (COPY data ./data)
│      • rules.yaml      (legacy, now vestigial)      └─ entrypoint chown -R node:node /app/data
│                                                        app reads DATABASE_URL=http://db:8080
│                                                                    │ (Hrana/HTTP, not a file)
│                                                                    ▼
└── db_data ──named volume──▶ wishboard-db container /var/lib/sqld ──┘
      (Docker-managed)          libsql-server (sqld, uid 666)
       • wishboard.db + sqld state          ▲
         (users, wishes, wishmails,         └─ build-kiosk.sh: chown -R 666:666 /var/lib/sqld
          sessions, rules, websocket…)         after `compose up` (rootless fix, #144)

one-time legacy migration (guarded, #193):
  legacy wishboard_data volume ──cp -a /from/. /to/──▶ ./data   [only if ./data is empty]
```

Key point: **images and the DB are on separate surfaces.** `./data` is a host bind mount owned by the `wishboard` user; `db_data` is a Docker-managed named volume whose contents are owned by the `sqld` uid (666). Nothing the app writes as "the database" ever lands in `./data` on the kiosk.

## Decisions & fixes

### 1. Two surfaces, one deploy — keep them distinct

The bind mount (`./data`, images + vestigial `rules.yaml`) and the named volume (`db_data`, the SQLite database including the `rules` table) are treated as separate persistence surfaces with separate reset semantics. Conflating them is what produced #194. Any operation that means "reset the rules" or "reset the images" must target the correct surface and only that surface.

### 2. Guard the one-time legacy-volume migration (clobber bug, fixed alongside #193)

`build-kiosk.sh` migrates the old standalone `wishboard_data` named volume into the `./data` bind mount for deployments upgrading from the pre-compose single-container layout. Because the app container is named `wishboard` **even under compose**, the "legacy container present" check matched on every deploy, so the `cp -a /from/. /to/` from the stale `wishboard_data` volume ran **every time** — overwriting live data (rules edits, uploaded images) with orphaned, stale content.

It is now guarded to run **only when the bind mount has no data yet** — the copy is skipped unless `DEPLOY_RULES != reset` **and** neither `data/rules.yaml` nor `data/wishboard.db` exists:

```sh
if [[ "$DEPLOY_RULES" != "reset" ]] \
    && [ ! -f "$WISHBOARD_HOME/wishboard/data/rules.yaml" ] \
    && [ ! -f "$WISHBOARD_HOME/wishboard/data/wishboard.db" ]; then
    # first run only: migrate legacy wishboard_data → ./data
fi
```

This makes the migration a genuine one-time, first-run operation instead of a per-deploy clobber.

### 3. Rootless-Docker ownership of the DB volume — open decision (#145)

Under rootless Docker with a **named volume**, libsql-server's data landed **root-owned** while `sqld` runs as uid 666, so the daemon couldn't write (`SQLITE_READONLY` + `error persisting stats file: Permission denied`). #144 fixed this operationally: after `compose up`, `build-kiosk.sh` waits for `/var/lib/sqld` to appear and runs `chown -R 666:666`, then restarts the app so its schema init runs against a now-writable DB.

The image's own entrypoint already does `chown -R sqld:sqld` — which works on **rootful** Docker but did not stick under our rootless daemon, which is why the external chown exists. The durable shape is **not yet decided** (#145):

- **Keep the `build-kiosk.sh` chown** (status quo — proven, working, but an extra post-deploy step and an external dependency on the container's uid).
- **Switch `db_data` to a bind mount** (`./db-data:/var/lib/sqld`, mirroring the app's clean-under-rootless `./data` mount), which may sidestep the ownership problem entirely, possibly letting us drop both the chown step and the redundant `user: '0:0'`.
- **Rely on the image's own chown** if it can be made to land under rootless.

This is low-urgency (the #144 chown works); it is about the cleanest durable shape, not a live outage. Note the pinned image (`libsql-server:v0.24.33`, see `docker-compose.yml`) — a version bump may require recreating `db_data`, which interacts with whichever ownership shape is chosen.

### 4. `--reset-rules` is destructive and misnamed (#194)

`--reset-rules` maps to `DEPLOY_RULES=reset`, which today does:

```sh
$RUN_CMD volume rm wishboard_data db_data || true
sudo rm -rf $WISHBOARD_HOME/wishboard/data/* || true
```

Post-#188, this is **wrong on both counts**:

- It `rm -rf`s the entire `./data` bind mount, **deleting uploaded images** (`data/images/`) along with the now-vestigial `rules.yaml` — data the flag has no business touching.
- It does **not actually reset the rules**, because rules now live in the DB (`rules` table in `db_data`), reachable only over `http://db:8080`. Wiping the files leaves the real rules untouched.

So the flag is both destructive (images) and ineffective (rules). **Until fixed, do not pass `--reset-rules` on a kiosk deploy.** The intended fix: `--reset-rules` should clear the DB rules (e.g. `DELETE FROM rules`, so `rulesManager.seedIfEmpty` reseeds the 29 bundled defaults on next boot) and **must not** `rm -rf` the `/app/data` volume where images live.

## Consequences

- The kiosk keeps **two persistence surfaces**: `./data` (bind mount — images + vestigial `rules.yaml`) and `db_data` (named volume — the SQLite DB, including the `rules` table). Operators and scripts must target the right one; treating them as interchangeable is what caused #194.
- The legacy `wishboard_data → ./data` migration is now a **true first-run-only** step; ordinary deploys no longer risk clobbering live images or rule edits.
- The DB volume still depends on the **post-deploy `chown -R 666:666`** in `build-kiosk.sh` (#144). The durable ownership shape (chown vs. bind mount vs. image-owned) remains an **open decision (#145)** — low urgency, cleanliness not outage.
- **`--reset-rules` is currently unsafe** and must not be used on the kiosk until #194 lands; the correct behavior clears the DB `rules` table and leaves `/app/data` (images) intact.
- The serverless target is unaffected: it has no local disk, stores the DB (and rules) in Turso, and never uses either kiosk volume (see [ADR 0002](0002-serverless-database-architecture.md)).
