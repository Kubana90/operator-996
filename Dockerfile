# operator-996 Dockerfile
# Multi-stage production-ready build

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

# Labels
LABEL org.opencontainers.image.source="https://github.com/Kubana90/operator-996"
LABEL org.opencontainers.image.description="operator-996 Platform"
LABEL org.opencontainers.image.licenses="MIT"

# Build arguments
ARG NODE_ENV=production
ARG BUILD_DATE
ARG VCS_REF

# Environment variables
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3000
ENV HOST=0.0.0.0

# Create non-root user
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache dumb-init curl

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./

# Create tmp directory for app
RUN mkdir -p /tmp && chown -R appuser:appgroup /tmp

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init as PID 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
