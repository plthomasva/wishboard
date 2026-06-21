#!/bin/bash
set -e

ADMIN_USERNAME="${1:-pi}"
HOST_NAME="${2:-raspberrypi.local}"
MODE="${3:-dev}"
DOMAIN_NAME="${4:-wishboard.painless-computing.com}"
DEPLOY_RULES="${5:-keep}" # Pass 'reset' to reset rules volume

if [[ ! "$MODE" =~ ^(prod|dev|dual)$ ]]; then
    echo "Error: Mode must be 'prod', 'dev', or 'dual'" >&2
    echo "Usage: ./scripts/deploy-kiosk.sh [user] [host] [mode] [domain] [reset_rules] [version]" >&2
    exit 1
fi

APP_VERSION="${6:-}"
if [[ -z "$APP_VERSION" ]] && [[ -f "package.json" ]]; then
    APP_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "latest")
fi
if [[ -z "$APP_VERSION" ]]; then
    APP_VERSION="latest"
fi

echo -e "\033[1;36mStarting Wishboard Kiosk Docker Deployment to ${ADMIN_USERNAME}@${HOST_NAME} (Mode: ${MODE}, Version: ${APP_VERSION})...\033[0m"

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo -e "\033[1;33m1. Uploading setup script, build script, and docker-compose.yml...\033[0m"
scp scripts/setup-kiosk.sh "${ADMIN_USERNAME}@${HOST_NAME}:/tmp/setup-kiosk.sh"
scp scripts/build-kiosk.sh "${ADMIN_USERNAME}@${HOST_NAME}:/tmp/build-kiosk.sh"

# Ensure the target directory exists on the Pi for docker-compose.yml
ssh "${ADMIN_USERNAME}@${HOST_NAME}" "mkdir -p /home/wishboard/wishboard"
scp docker-compose.yml "${ADMIN_USERNAME}@${HOST_NAME}:/home/wishboard/wishboard/docker-compose.yml"

echo -e "\033[1;33m2. Executing setup script (creating user, configuring Docker and kiosk)...\033[0m"
# Ensure line endings don't break bash execution by stripping \r using sed
ssh "${ADMIN_USERNAME}@${HOST_NAME}" "sed -i 's/\r$//' /tmp/setup-kiosk.sh && sudo bash /tmp/setup-kiosk.sh ${MODE} ${DOMAIN_NAME}"

echo -e "\033[1;33m3. Deploying Docker container...\033[0m"
# Execute the remote deployment script
ssh "${ADMIN_USERNAME}@${HOST_NAME}" "sed -i 's/\r$//' /tmp/build-kiosk.sh && sudo bash /tmp/build-kiosk.sh ${MODE} ${DOMAIN_NAME} ${DEPLOY_RULES} ${APP_VERSION}"

echo -e "\033[1;32mDeployment complete! Container started.\033[0m"
