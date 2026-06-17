# Stage 1: Build the Vite frontend and install all dependencies
FROM node:22-slim AS builder

WORKDIR /app

# Install all dependencies (including devDependencies needed for Vite)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Run the build script (which also runs the prebuild font downloader)
RUN npm run build

# Stage 2: Create the production image
FROM node:22-slim AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
# Ensure sqlite data, logs, and rules persist to the mounted volume
ENV WISHBOARD_DB_PATH=/app/data/wishboard.db

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the built backend and frontend from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server

# Expose the API port
EXPOSE 3000

# Mount the volume for persistence
VOLUME ["/app/data"]

# Start the Express server
CMD ["node", "src/server/index.js"]
