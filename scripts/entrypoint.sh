#!/bin/sh
set -e

# Fix permissions on the data directory for the node user
# This handles the case where Docker mounts a new volume as root
chown -R node:node /app/data

# If the command starts with 'node', run it as the node user
if [ "$1" = 'node' ]; then
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

# Otherwise, run the command as root (useful for debugging, bash, etc)
exec "$@"
