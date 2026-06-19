# Base setup
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies in a clean stage
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public build-time vars
ARG NEXT_PUBLIC_DEBUG_MODE
ARG NEXT_PUBLIC_SHOW_SPREADSHEET
ARG NEXT_PUBLIC_SHOW_SLACK_HUB
ENV NEXT_PUBLIC_DEBUG_MODE=$NEXT_PUBLIC_DEBUG_MODE \
    NEXT_PUBLIC_SHOW_SPREADSHEET=$NEXT_PUBLIC_SHOW_SPREADSHEET \
    NEXT_PUBLIC_SHOW_SLACK_HUB=$NEXT_PUBLIC_SHOW_SLACK_HUB

RUN npm run build

# Production runtime
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 \
    HOSTNAME=0.0.0.0

# Start Next.js standalone server
CMD ["node", "server.js"]