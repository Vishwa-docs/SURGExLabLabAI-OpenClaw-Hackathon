FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY demo/ ./demo/
COPY scripts/ ./scripts/
COPY data/first_speaker_wins_model/ ./data/first_speaker_wins_model/

# Build
RUN npx tsc

# ── Production image ──
FROM node:22-alpine

WORKDIR /app

# Install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data/first_speaker_wins_model ./data/first_speaker_wins_model

# Create data directory for SQLite
RUN mkdir -p ./data && chown -R node:node ./data

# Non-root user
USER node

# Env defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV DASHBOARD_PORT=3001
ENV DB_PATH=./data/ridhwan.db

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/src/index.js"]
