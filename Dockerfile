# Stage 1: Build the Vite frontend and install all dependencies
FROM --platform=$BUILDPLATFORM node:22-slim AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get --no-install-recommends install -y g++ make python3 && rm -rf /var/lib/apt/lists/*

# Install all dependencies (including devDependencies needed for Vite)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY data ./data
COPY scripts ./scripts

# Run the build script
RUN npm run build

# Stage 2: Install production dependencies natively
FROM node:22-slim AS deps
WORKDIR /app
# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get --no-install-recommends install -y g++ make python3 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Run npm ci to install production dependencies and automatically download pre-built binaries
RUN npm ci --omit=dev

# Stage 3: Create the production image
FROM node:22-slim AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
# Ensure sqlite data, logs, and rules persist to the mounted volume
ENV WISHBOARD_DB_PATH=/app/data/wishboard.db

# Copy node_modules from deps stage (has correctly built native bindings)
COPY --from=deps /app/node_modules ./node_modules

# Copy the built backend and frontend from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/src/client/src/passphrase.js ./src/client/src/passphrase.js
COPY --from=builder /app/data ./data

# Fix permissions for the data directory so the node user can write to it
RUN chown -R node:node /app/data

# Switch to non-root user
USER node

# Expose the API port
EXPOSE 3000

# Mount the volume for persistence
VOLUME ["/app/data"]

# Start the Express server
CMD ["node", "src/server/index.js"]
