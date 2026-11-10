# One image recipe for the four ORBIT programs; APP selects which one runs.
# Digest-pinned 2026-11-09; see VERSIONS.md. A tag alone lets two builds of the same commit
# produce different software.
FROM node:24.14.1-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json shared/
COPY db/package.json db/
COPY api/package.json api/
COPY web/package.json web/
COPY worker/package.json worker/
COPY frontdesk/package.json frontdesk/
COPY ops/package.json ops/
RUN pnpm install --frozen-lockfile --prod

FROM deps AS runtime
ARG APP
ENV APP=${APP} NODE_ENV=production
COPY shared shared
COPY ${APP} ${APP}
USER node
CMD ["sh", "-c", "cd \"$APP\" && exec node --import tsx src/main.ts"]
