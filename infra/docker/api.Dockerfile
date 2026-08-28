FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/clinical-rules/package.json packages/clinical-rules/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @valve/api... build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
# Synology shares can present source directories as mode 0700. The workspace
# symlinks in apps/api/node_modules resolve here, so the runtime user must own
# the copied packages instead of depending on host directory permissions.
COPY --from=build --chown=node:node /app/packages ./packages
RUN mkdir -p /data/medical && chown -R node:node /data/medical
USER node
CMD ["node", "apps/api/dist/main.js"]
