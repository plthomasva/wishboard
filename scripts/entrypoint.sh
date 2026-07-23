#!/bin/sh
set -e

# Fix permissions on the data directory for the node user (skipping db/ which is managed by sqld)
find /app/data -mindepth 1 -maxdepth 1 ! -name 'db' -exec chown -R node:node {} + 2>/dev/null || true

# If the command starts with 'node', run it as the node user
if [ "$1" = 'node' ]; then
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

# Otherwise, run the command as root (useful for debugging, bash, etc)
exec "$@"
