# Multi-stage Dockerfile for position-api

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /usr/src/app

# Copy package files for workspace setup
COPY package.json package-lock.json ./
COPY apps/position-api/package.json ./apps/position-api/
COPY libs/contracts/package.json ./libs/contracts/
COPY libs/kafka/package.json ./libs/kafka/
COPY libs/redis/package.json ./libs/redis/
COPY libs/pg/package.json ./libs/pg/

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

# Copy position-api source
COPY apps/position-api/ ./apps/position-api/

# Build shared libraries first
RUN npm run build --workspace libs/contracts && \
    npm run build --workspace libs/kafka && \
    npm run build --workspace libs/redis && \
    npm run build --workspace libs/pg

# Build the application
RUN npm run build --workspace apps/position-api

# Stage 3: Production
FROM node:22-alpine AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json ./
COPY apps/position-api/package.json ./apps/position-api/
COPY libs/contracts/package.json ./libs/contracts/
COPY libs/kafka/package.json ./libs/kafka/
COPY libs/redis/package.json ./libs/redis/
COPY libs/pg/package.json ./libs/pg/

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /usr/src/app/apps/position-api/dist ./apps/position-api/dist
COPY --from=builder /usr/src/app/libs ./libs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "apps/position-api/dist/main.js"]
