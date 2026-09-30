# One image recipe for the four ORBIT programs; APP selects which one runs.
FROM node:24.14.1-slim AS base
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
