# Multi-stage Docker build for FarmTally User Role Management System
# Optimized for production deployment on 147.93.153.247

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S farmtally -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy database files separately (since TypeScript doesn't copy .sql files)
COPY --chown=farmtally:nodejs src/database/ ./dist/database/

# Copy any additional configuration files if needed
COPY --chown=farmtally:nodejs .env.example ./.env.example

# Create necessary directories and set permissions
RUN mkdir -p /app/logs && \
    chown -R farmtally:nodejs /app

# Switch to non-root user
USER farmtally

# Expose port (default 3000, can be overridden)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["node", "dist/server.js"]