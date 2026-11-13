# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
ARG CADDY_IMAGE=caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0
FROM ${NODE_IMAGE} AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

FROM manifests AS dependencies
RUN --mount=type=secret,id=proxy_ca \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --cache=/tmp/npm-cache

FROM dependencies AS build
COPY --chown=node:node . .
ARG VCS_REF=development
ENV APP_REVISION=${VCS_REF}
RUN npm run typecheck && npm run build && \
    node -e 'require("fs").writeFileSync("apps/client/dist/version.json",JSON.stringify({revision:process.env.APP_REVISION}))'

FROM manifests AS production-dependencies
RUN --mount=type=secret,id=proxy_ca \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --workspace=@netcity/server --include-workspace-root --cache=/tmp/npm-cache

FROM ${NODE_IMAGE} AS server
WORKDIR /app
ARG VCS_REF=development
ENV NODE_ENV=production APP_REVISION=${VCS_REF}
LABEL org.opencontainers.image.source="https://github.com/Phantomkka/ural_it" \
      org.opencontainers.image.revision=${VCS_REF}
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=node:node /app/apps/server/src ./apps/server/src
COPY --from=build --chown=node:node /app/apps/server/migrations ./apps/server/migrations
COPY --from=build --chown=node:node /app/packages/shared ./packages/shared
COPY --from=build --chown=node:node /app/scripts/db-migrate.mts ./scripts/db-migrate.mts
COPY --chown=node:node deploy/bootstrap.mjs ./deploy/bootstrap.mjs
RUN chmod -R a+rX /app
USER node
EXPOSE 2567
CMD ["node", "--import", "tsx", "deploy/bootstrap.mjs"]

FROM ${CADDY_IMAGE} AS client
ARG VCS_REF=development
LABEL org.opencontainers.image.source="https://github.com/Phantomkka/ural_it" \
      org.opencontainers.image.revision=${VCS_REF}
COPY --from=build /app/apps/client/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
