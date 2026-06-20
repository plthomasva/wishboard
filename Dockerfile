# Stage 1: Build the Vite frontend and install all dependencies
FROM node:22-slim AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get --no-install-recommends install -y g++ make python3 && rm -rf /var/lib/apt/lists/*

# Install all dependencies (including devDependencies needed for Vite)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
# Explicitly rebuild better-sqlite3 to compile native bindings securely
RUN npm rebuild better-sqlite3

# Copy the rest of the application
COPY tsconfig.json vite.config.ts eslint.config.js index.html ./
COPY src ./src
COPY data ./data
COPY scripts ./scripts

# Run the build script
RUN npm run build

# Stage 2: Install production dependencies natively
FROM node:22-slim AS deps
WORKDIR /app
# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get --no-install-recommends -y g++ make python3 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Run npm ci with --ignore-scripts and explicitly rebuild better-sqlite3
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

# Stage 3: Create the production image
FROM node:22-slim AS runner

WORKDIR /app


# Mount the volume for persistence
VOLUME ["/app/data"]

# Start the Express server
CMD ["node", "src/server/index.js"]
