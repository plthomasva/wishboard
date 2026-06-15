#!/bin/bash
set -e

ADMIN_USERNAME="${1:-pi}"
HOST_NAME="${2:-raspberrypi.local}"
MODE="${3:-dev}"
DOMAIN_NAME="${4:-wishboard.painless-computing.com}"

if [[ ! "$MODE" =~ ^(prod|dev|dual)$ ]]; then
    echo "Error: Mode must be 'prod', 'dev', or 'dual'" >&2
    echo "Usage: ./scripts/deploy-kiosk.sh [user] [host] [mode] [domain]" >&2
    exit 1
fi

echo -e "\033[1;36mStarting Wishboard Kiosk Deployment to ${ADMIN_USERNAME}@${HOST_NAME} (Mode: ${MODE})...\033[0m"

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo -e "\033[1;33m1. Creating code archive using tar...\033[0m"
tar -czf wishboard.tar.gz --exclude=node_modules --exclude=.git --exclude=dist --exclude=data --exclude=wishboard.tar.gz .

echo -e "\033[1;33m2. Uploading setup script, build script, and code archive...\033[0m"
scp scripts/setup-kiosk.sh "${ADMIN_USERNAME}@${HOST_NAME}:/tmp/setup-kiosk.sh"
scp scripts/build-kiosk.sh "${ADMIN_USERNAME}@${HOST_NAME}:/tmp/build-kiosk.sh"
scp wishboard.tar.gz "${ADMIN_USERNAME}@${HOST_NAME}:/tmp/wishboard.tar.gz"

echo -e "\033[1;33m3. Executing setup script (creating user and configs)...\033[0m"
# Ensure line endings don't break bash execution by stripping \r using sed
ssh "${ADMIN_USERNAME}@${HOST_NAME}" "sed -i 's/\r$//' /tmp/setup-kiosk.sh && sudo bash /tmp/setup-kiosk.sh ${MODE} ${DOMAIN_NAME}"

echo -e "\033[1;33m4. Extracting codebase and building...\033[0m"
# Execute the remote build script
ssh "${ADMIN_USERNAME}@${HOST_NAME}" "sed -i 's/\r$//' /tmp/build-kiosk.sh && sudo bash /tmp/build-kiosk.sh ${MODE} ${DOMAIN_NAME}"

echo -e "\033[1;32mDeployment complete! Services restarted.\033[0m"

# Cleanup local archive
rm -f wishboard.tar.gz
