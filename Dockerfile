# Stage 1: Build the NestJS application
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

# pnpm-workspace.yaml carries the build-script approvals (allowBuilds); without
# it pnpm treats an unapproved build script as a hard error in a TTY-less build.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --strict-peer-dependencies=false

COPY . .
RUN pnpm build

# Drop dev dependencies so only runtime deps get copied into the final image.
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm prune --prod

# Stage 2: Run it (non-root)
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

# All config comes from the environment (ConfigMap + Secret in the cluster).
# Note there is deliberately no .env in this image; see .dockerignore.
USER node
EXPOSE 8080

CMD ["node", "dist/main"]
