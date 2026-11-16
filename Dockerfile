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
# The path prefix the app is published under, e.g. `/darthub`. Empty (the
# default) means the app is served from the root.
ARG BASE_PATH=""
# `next.config.ts` reads BASE_PATH when it loads the config, so the value has
# to be in the environment of the build — an ARG on its own is invisible to
# `next build`. The same ENV then applies to the prefix gate below, so the
# build and the gate cannot disagree about the prefix.
ENV BASE_PATH=${BASE_PATH}
# The Prisma client is generated, not checked in, and `npm ci` does not
# generate it: the client is produced from prisma/schema.prisma, so the
# build needs it before `next build` type-checks the repositories.
RUN npx prisma generate
RUN npm run build
# The asset URLs have to carry the prefix the app is published under. A build
# without it hands out URLs the proxy does not serve, and the page arrives
# unstyled and unhydrated — so the build fails here rather than at runtime.
#
# The gate reads the prefix from `process.env.BASE_PATH` and inherits it from
# the ENV above. That inheritance is the whole point: without it the gate
# checks against `/_next/` and can never fail — a disarmed guard that lets the
# broken image through. So a prefixed build that loses its prefix has to fail
# the image build here, not the live site.
RUN node scripts/check-asset-prefix.mjs

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
