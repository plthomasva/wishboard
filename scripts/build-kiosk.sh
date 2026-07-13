#!/bin/bash
set -e

echo "=== Wishboard Raspberry Pi Container Deploy ==="

MODE="${1:-dev}"
DOMAIN_NAME="${2:-wishboard.painless-computing.com}"
DEPLOY_RULES="${3:-keep}"
APP_VERSION="${4:-latest}"

# Configure the Docker command to securely execute as the wishboard service user using their isolated rootless daemon
WISHBOARD_UID=$(id -u wishboard)
RUN_CMD="sudo -u wishboard DOCKER_HOST=unix:///run/user/$WISHBOARD_UID/docker.sock docker"

echo "Deployment Mode: $MODE, Domain: $DOMAIN_NAME, Rules: $DEPLOY_RULES, Version: $APP_VERSION"
REQUIRED_MB=800
AVAILABLE_MB=$(df -m /home | awk 'NR==2 {print $4}')
if [[ "$AVAILABLE_MB" -lt "$REQUIRED_MB" ]]; then
    echo "ERROR: Not enough disk space. Available: ${AVAILABLE_MB} MB, Required: ${REQUIRED_MB} MB" >&2
    exit 1
fi
echo "Disk space OK (${AVAILABLE_MB} MB available)."

# Determine the home directory dynamically
WISHBOARD_HOME=$(getent passwd wishboard | cut -d: -f6 || echo "/home/wishboard")

# Ensure directory exists for env file
sudo -u wishboard mkdir -p $WISHBOARD_HOME/wishboard

echo "Configuring environment variables..."
if [[ "$MODE" = "prod" || "$MODE" = "dual" ]]; then
    # Runtime env (read by the server, served via /api/config). The old VITE_* names
    # were baked at image-build time in CI, so a value written here never reached the
    # already-built client bundle — the poster/Wi-Fi popup showed the wrong domain.
    sudo -u wishboard bash -c "echo 'WISHBOARD_DOMAIN=$DOMAIN_NAME' > $WISHBOARD_HOME/wishboard/.env"
    sudo -u wishboard bash -c "echo 'WISHBOARD_AP_IP=10.42.0.1:3000' >> $WISHBOARD_HOME/wishboard/.env"
else
    sudo rm -f $WISHBOARD_HOME/wishboard/.env
    sudo -u wishboard bash -c "echo 'NODE_ENV=development' > $WISHBOARD_HOME/wishboard/.env"
fi
sudo -u wishboard bash -c "echo 'CORS_ALLOWED_ORIGINS=https://$DOMAIN_NAME,http://localhost:3000,http://localhost:5173' >> $WISHBOARD_HOME/wishboard/.env"
sudo -u wishboard bash -c "echo 'APP_VERSION=$APP_VERSION' >> $WISHBOARD_HOME/wishboard/.env"

echo "Checking for legacy standalone container..."
if $RUN_CMD ps -a --format '{{.Names}}' | grep -Eq '^wishboard$'; then
    echo "Stopping legacy wishboard container..."
    $RUN_CMD stop wishboard || true
    
    # One-time migration of the legacy wishboard_data named volume INTO the bind
    # mount — ONLY when the bind mount has no data yet. This guard is critical: the
    # container is named `wishboard` even under compose, so without it this cp -a ran
    # on every deploy and clobbered live data (rules edits, uploaded images) with the
    # stale, orphaned wishboard_data volume.
    if [[ "$DEPLOY_RULES" != "reset" ]] \
        && [[ ! -f "$WISHBOARD_HOME/wishboard/data/rules.yaml" ]] \
        && [[ ! -f "$WISHBOARD_HOME/wishboard/data/wishboard.db" ]]; then
        echo "First run: migrating legacy wishboard_data volume into the bind mount..."
        sudo -u wishboard mkdir -p $WISHBOARD_HOME/wishboard/data
        $RUN_CMD run --rm -v wishboard_data:/from -v $WISHBOARD_HOME/wishboard/data:/to alpine sh -c 'cp -a /from/. /to/ 2>/dev/null || true'
    fi

    echo "Removing legacy wishboard container..."
    $RUN_CMD rm wishboard || true
fi

# NOTE: --reset-rules (DEPLOY_RULES=reset) is handled AFTER the stack is up (see
# below). It used to `volume rm db_data` + `rm -rf data/*` here, which nuked the
# ENTIRE database (users, wishes, sessions) and DELETED UPLOADED IMAGES — far more
# than "reset rules", and it no longer even reset the DB-backed rules correctly.
# See #194 and docs/adr/0004-kiosk-data-persistence.md.

# Navigate to the application directory where docker-compose.yml is uploaded
cd $WISHBOARD_HOME/wishboard

echo "Starting/Updating services via Docker Compose..."
# We assume the user has copied docker-compose.yml to the target directory.
# If they are running this script in the repository root, it will find docker-compose.yml.
export APP_VERSION=$APP_VERSION
# Pull policy by mode:
#   prod  -> missing : events run offline; a cached image must be authoritative.
#            --pull always would REQUIRE network and fail a disconnected deploy.
#   dev/dual -> always : testing wants the freshest image for a moving tag
#            (e.g. pr-NNN / latest), which 'missing' would serve stale from cache.
PULL_POLICY="missing"
if [[ "$MODE" = "dev" || "$MODE" = "dual" ]]; then
  PULL_POLICY="always"
fi
echo "Docker image pull policy: $PULL_POLICY (mode: $MODE)"
$RUN_CMD compose --env-file .env up -d --pull "$PULL_POLICY"

# libsql-server's entrypoint starts as root, leaves /var/lib/sqld root-owned, then
# runs the sqld daemon as uid 666. Under rootless Docker sqld (666) then can't
# write its database ("SQLITE_READONLY") or its stats file ("Permission denied").
# Wait for the data dir to appear, chown it to the sqld uid, then restart the app
# so its schema init runs against a now-writable DB. See #144.
echo "Aligning libsql-server data ownership to the sqld uid (666)..."
for _ in $(seq 1 20); do
    if [[ -n "$($RUN_CMD exec -u 0 wishboard-db sh -c 'ls -A /var/lib/sqld 2>/dev/null')" ]]; then
        break
    fi
    sleep 1
done
$RUN_CMD exec -u 0 wishboard-db chown -R 666:666 /var/lib/sqld || true
$RUN_CMD compose --env-file .env restart wishboard

if [[ "$DEPLOY_RULES" = "reset" ]]; then
    # #194: reset matching rules ONLY — do not touch users, wishes, or images.
    # Rules live in the DB `rules` table (see ADR 0002/0004). Clear that table,
    # then restart the app so rulesManager.seedIfEmpty() reseeds the bundled
    # defaults on boot. Remove only the vestigial legacy rules.yaml (NOT images)
    # so the reseed uses the bundled defaults rather than a stale file.
    echo "Resetting matching rules to the bundled defaults (DB rules table)..."
    sudo rm -f $WISHBOARD_HOME/wishboard/data/rules.yaml || true
    # Wait for the app to be up, then clear the rules table via the app's own
    # libSQL client (DATABASE_URL points at the db service on the compose network).
    for _ in $(seq 1 20); do
        if $RUN_CMD exec wishboard node -e "import('@libsql/client').then(async ({ createClient }) => { const c = createClient({ url: process.env.DATABASE_URL }); await c.execute('DELETE FROM rules'); process.exit(0); }).catch(() => process.exit(1))"; then
            echo "Rules table cleared."
            break
        fi
        sleep 1
    done
    $RUN_CMD compose --env-file .env restart wishboard
fi

echo "Restarting Display Manager..."
sudo systemctl restart lightdm || true

echo "Deployment complete! Wishboard container and Display Manager have been restarted."
exit 0
