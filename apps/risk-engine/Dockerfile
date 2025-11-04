# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY libs/contracts/package*.json ./libs/contracts/
COPY libs/kafka/package*.json ./libs/kafka/
COPY libs/redis/package*.json ./libs/redis/
COPY apps/risk-engine/package*.json ./apps/risk-engine/

# Install dependencies
RUN npm install

# Copy source code
COPY libs/ ./libs/
COPY apps/risk-engine/ ./apps/risk-engine/
COPY tsconfig.json ./

# Build libraries
RUN cd libs/contracts && npm run build
RUN cd libs/kafka && npm run build
RUN cd libs/redis && npm run build

# Build risk-engine
RUN cd apps/risk-engine && npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY libs/contracts/package*.json ./libs/contracts/
COPY libs/kafka/package*.json ./libs/kafka/
COPY libs/redis/package*.json ./libs/redis/
COPY apps/risk-engine/package*.json ./apps/risk-engine/

# Install production dependencies only
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/libs/contracts/dist ./libs/contracts/dist
COPY --from=builder /app/libs/kafka/dist ./libs/kafka/dist
COPY --from=builder /app/libs/redis/dist ./libs/redis/dist
COPY --from=builder /app/apps/risk-engine/dist ./apps/risk-engine/dist

# Set working directory to risk-engine
WORKDIR /app/apps/risk-engine

# Run the application
CMD ["node", "dist/main.js"]
