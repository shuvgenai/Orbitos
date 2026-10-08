# One image recipe for the four ORBIT programs; APP selects which one runs.
FROM node:24.14.1-slim AS base
RUN corepack enable
WORKDIR /app

# The manifests on their own, so both installs below share this layer.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json shared/
COPY db/package.json db/
COPY api/package.json api/
COPY web/package.json web/
COPY worker/package.json worker/
COPY frontdesk/package.json frontdesk/
COPY ops/package.json ops/

# Runtime dependencies only. @prisma/client and @prisma/adapter-pg are
# dependencies of @orbit/db so they are here; the prisma CLI is a devDependency
# and is not.
FROM manifests AS deps
RUN pnpm install --frozen-lockfile --prod

# The Prisma client, generated at build time.
#
# db/src/generated is deliberately not committed: generated code in git drifts
# from the schema silently and appears in every diff. So it has to be made here,
# and generating it needs the prisma CLI, which --prod does not install. That is
# the whole reason this stage exists and installs everything.
#
# Nothing from this stage reaches the runtime image except db/, which carries its
# generated output at db/src/generated/prisma, per the generator block in
# db/prisma/schema.prisma.
FROM manifests AS generate
RUN pnpm install --frozen-lockfile
COPY db db
# prisma generate never opens a connection, but db/prisma.config.ts resolves
# env('DATABASE_URL') eagerly and throws without it. Its own comment says "CI
# sets DATABASE_URL directly", and this is that case. Port 1 is not a Postgres
# port, so if anything here ever did try to connect it would fail rather than
# reach a database. This ENV belongs to this stage only: runtime is FROM deps,
# not FROM generate, so it does not reach the shipped image.
ENV DATABASE_URL=postgresql://unused:unused@127.0.0.1:1/unused
RUN pnpm --filter @orbit/db exec prisma generate

FROM deps AS runtime
ARG APP
ENV APP=${APP} NODE_ENV=production
COPY shared shared
# db/ was missing here until 2026-10-08. api imports @orbit/db/client, which
# db/package.json maps to ./src/client.ts, so api died on ERR_MODULE_NOT_FOUND
# before it listened and had never started from this image in any environment.
# worker imports nothing from @orbit/db and was healthy throughout, which is why
# the stack looked three-quarters working. guards/image-build.test.ts fails if
# this line goes missing again.
COPY --from=generate /app/db db
COPY ${APP} ${APP}
USER node
CMD ["sh", "-c", "cd \"$APP\" && exec node --import tsx src/main.ts"]
