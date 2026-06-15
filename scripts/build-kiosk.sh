#!/bin/bash
set -e

echo "=== Wishboard Raspberry Pi Build & Deploy ==="

MODE="${1:-dev}"
DOMAIN_NAME="${2:-wishboard.painless-computing.com}"

echo "Deployment Mode: $MODE, Domain: $DOMAIN_NAME"
REQUIRED_MB=800
AVAILABLE_MB=$(df -m /home | awk 'NR==2 {print $4}')
if [[ "$AVAILABLE_MB" -lt "$REQUIRED_MB" ]]; then
    echo "ERROR: Not enough disk space. Available: ${AVAILABLE_MB} MB, Required: ${REQUIRED_MB} MB" >&2
    exit 1
fi
echo "Disk space OK (${AVAILABLE_MB} MB available)."

echo "Stopping service if it is already running..."
sudo systemctl stop wishboard.service || true

echo "Extracting code archive..."
# Make archive readable by wishboard user
chgrp wishboard /tmp/wishboard.tar.gz
chmod g+r /tmp/wishboard.tar.gz
sudo -u wishboard tar -xzf /tmp/wishboard.tar.gz -C /home/wishboard/wishboard
cd /home/wishboard/wishboard

echo "Installing NPM dependencies..."
sudo -u wishboard bash -c 'cd /home/wishboard/wishboard && npm install'

echo "Configuring environment variables..."
if [[ "$MODE" = "prod" ]] || [[ "$MODE" = "dual" ]]; then
    sudo -u wishboard bash -c "echo 'VITE_WISHBOARD_DOMAIN=$DOMAIN_NAME' > /home/wishboard/wishboard/.env"
    sudo -u wishboard bash -c "echo 'VITE_WISHBOARD_AP_IP=10.42.0.1' >> /home/wishboard/wishboard/.env"
else
    sudo rm -f /home/wishboard/wishboard/.env
fi

echo "Building application..."
sudo -u wishboard bash -c 'cd /home/wishboard/wishboard && npm run build'

echo "Removing dev dependencies to save space..."
sudo -u wishboard bash -c 'cd /home/wishboard/wishboard && npm prune --omit=dev'

echo "Cleaning up archive..."
rm -f /tmp/wishboard.tar.gz

echo "Restarting services..."
sudo systemctl restart wishboard.service || true
sudo systemctl restart lightdm || true

echo "Deployment complete! Wishboard and Display Manager have been restarted."
exit 0
