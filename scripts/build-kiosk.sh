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
if [[ "$MODE" = "prod" ]]; then
    sudo -u wishboard bash -c "echo 'VITE_WISHBOARD_DOMAIN=$DOMAIN_NAME' > $WISHBOARD_HOME/wishboard/.env"
    sudo -u wishboard bash -c "echo 'VITE_WISHBOARD_AP_IP=10.42.0.1' >> $WISHBOARD_HOME/wishboard/.env"
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
    
    if [[ "$DEPLOY_RULES" != "reset" ]]; then
        echo "Migrating legacy data to new bind mount..."
        sudo -u wishboard mkdir -p $WISHBOARD_HOME/wishboard/data
        $RUN_CMD run --rm -v wishboard_data:/from -v $WISHBOARD_HOME/wishboard/data:/to alpine sh -c 'cp -a /from/. /to/ 2>/dev/null || true'
    fi

    echo "Removing legacy wishboard container..."
    $RUN_CMD rm wishboard || true
fi

if [[ "$DEPLOY_RULES" = "reset" ]]; then
    echo "Resetting container volume and local data..."
    $RUN_CMD volume rm wishboard_data db_data || true
    sudo rm -rf $WISHBOARD_HOME/wishboard/data/* || true
fi

# Navigate to the application directory where docker-compose.yml is uploaded
cd $WISHBOARD_HOME/wishboard

echo "Starting/Updating services via Docker Compose..."
# We assume the user has copied docker-compose.yml to the target directory.
# If they are running this script in the repository root, it will find docker-compose.yml.
export APP_VERSION=$APP_VERSION
$RUN_CMD compose --env-file .env up -d --pull always

echo "Restarting Display Manager..."
sudo systemctl restart lightdm || true

echo "Deployment complete! Wishboard container and Display Manager have been restarted."
exit 0
