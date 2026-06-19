# Stage 1: Build the Vite frontend and install all dependencies
FROM node:22-slim AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install all dependencies (including devDependencies needed for Vite)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
# Explicitly rebuild better-sqlite3 to compile native bindings securely
RUN npm rebuild better-sqlite3

# Copy the rest of the application
COPY . .

# Run the build script
RUN npm run build

# Stage 2: Install production dependencies natively
FROM node:22-slim AS deps
WORKDIR /app
# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Run npm ci with --ignore-scripts and explicitly rebuild better-sqlite3
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

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

# Expose the API port
EXPOSE 3000

# Mount the volume for persistence
VOLUME ["/app/data"]

# Start the Express server
CMD ["node", "src/server/index.js"]
