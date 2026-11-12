# syntax=docker/dockerfile:1

# Base image deviation from the plan: node:18-alpine cannot run Next.js 16
# (Next.js requires Node >= 20). node:22-alpine is the equivalent supported base.

# --- deps: install all dependencies (including devDependencies, which
# `next build` needs for its toolchain) into a cacheable layer.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the Next.js application with standalone output.
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The Prisma client is generated, not checked in, and `npm ci` does not
# generate it: the client is produced from prisma/schema.prisma, so the
# build needs it before `next build` type-checks the repositories.
RUN npx prisma generate
RUN npm run build

# --- runner: minimal production image containing only the standalone server.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
