# Multi-stage Dockerfile for market-data-ingestor

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /usr/src/app

# Copy package files for workspace setup
COPY package.json package-lock.json ./
COPY apps/market-data-ingestor/package.json ./apps/market-data-ingestor/
COPY libs/contracts/package.json ./libs/contracts/
COPY libs/kafka/package.json ./libs/kafka/
COPY libs/redis/package.json ./libs/redis/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /usr/src/app

# Copy dependencies from deps stage
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json

# Copy root tsconfig
COPY tsconfig.json ./

# Copy shared libraries source
COPY libs/ ./libs/

# Copy market-data-ingestor source
COPY apps/market-data-ingestor/ ./apps/market-data-ingestor/

# Build shared libraries first
RUN npm run build --workspace libs/contracts && \
    npm run build --workspace libs/kafka && \
    npm run build --workspace libs/redis

# Build the application
RUN npm run build --workspace apps/market-data-ingestor

# Stage 3: Production
FROM node:22-alpine AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json ./
COPY apps/market-data-ingestor/package.json ./apps/market-data-ingestor/
COPY libs/contracts/package.json ./libs/contracts/
COPY libs/kafka/package.json ./libs/kafka/
COPY libs/redis/package.json ./libs/redis/

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /usr/src/app/apps/market-data-ingestor/dist ./apps/market-data-ingestor/dist
COPY --from=builder /usr/src/app/libs ./libs

# Health check for headless service (check if process is running)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD pgrep -f "node.*market-data-ingestor" || exit 1

# Start the application
CMD ["node", "apps/market-data-ingestor/dist/main.js"]
