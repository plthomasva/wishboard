#!/bin/bash
set -e

# Default parameters
ADMIN_USERNAME="pi"
HOST_NAME="raspberrypi.local"

# Parse arguments (e.g., ./deploy-kiosk.sh pi 192.168.1.100)
if [ -n "$1" ]; then
    ADMIN_USERNAME="$1"
fi
if [ -n "$2" ]; then
    HOST_NAME="$2"
fi

echo -e "\033[1;36mStarting Wishboard Kiosk Deployment to ${ADMIN_USERNAME}@${HOST_NAME}...\033[0m"

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
ssh "${ADMIN_USERNAME}@${HOST_NAME}" "sed -i 's/\r$//' /tmp/setup-kiosk.sh && sudo bash /tmp/setup-kiosk.sh"

echo -e "\033[1;33m4. Extracting codebase and building...\033[0m"
# Execute the remote build script
ssh "${ADMIN_USERNAME}@${HOST_NAME}" "sed -i 's/\r$//' /tmp/build-kiosk.sh && sudo bash /tmp/build-kiosk.sh"

echo -e "\033[1;32mDeployment complete! The Pi is now rebooting into Kiosk mode.\033[0m"

# Cleanup local archive
rm -f wishboard.tar.gz
