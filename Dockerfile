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

# The Prisma client is generated, not committed: `db/prisma/schema.prisma` writes it to
# `db/src/generated/prisma` and `.dockerignore` excludes `**/generated`, so it cannot be
# copied in from the host even when it exists there. It has to be generated inside the build,
# which needs the `prisma` CLI — a devDependency, absent from the `--prod` install above — so
# this stage installs with dev dependencies and nothing but the generated output is carried
# forward. `prisma.config.ts` reads `env("DATABASE_URL")`, hence the placeholder: `generate`
# never connects, it only has to parse.
FROM base AS dbgen
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json shared/
COPY db/package.json db/
COPY api/package.json api/
COPY web/package.json web/
COPY worker/package.json worker/
COPY frontdesk/package.json frontdesk/
COPY ops/package.json ops/
RUN pnpm install --frozen-lockfile
COPY db db
# `shared` as well, because this stage is also the only image that can PROVISION an instance:
# `ops/seed-instance.mjs` needs `@orbit/shared/token-crypto` to encrypt the refresh token, and
# both `api` and `frontdesk` refuse to start without the GmailConnection row it creates. The
# runtime images do not get this stage's dev dependencies, only the generated client below.
COPY shared shared
RUN DATABASE_URL=postgresql://unused:unused@127.0.0.1:5432/unused \
    pnpm --filter @orbit/db exec prisma generate

FROM deps AS runtime
ARG APP
ENV APP=${APP} NODE_ENV=production
COPY shared shared
# `api` and `frontdesk` import `@orbit/db`, whose exports map resolves to `./src/*.ts`, so
# the package's source has to be in the image. It was not, and both services had been
# crash-looping on
#   Cannot find module '/app/<app>/node_modules/@orbit/db/src/client.ts'
# since the frontdesk services landed — the compose smoke job caught it and nobody read the
# job. `shared` has the same shape and works only because it has always been copied here.
#
# TODO: `web` and `worker` do not import `@orbit/db` and should not carry it. Scoping that
# needs per-app runtime stages and a `target:` on each service in `template/compose.yml`,
# because COPY cannot be conditional. Deliberately deferred: this is the authorised stopgap,
# not the answer. Removing the deep import instead was costed and rejected — see TODOS.md,
# "Stop shipping `db` into the `web` and `worker` images", which records why.
COPY --from=dbgen /app/db db
COPY ${APP} ${APP}
USER node
CMD ["sh", "-c", "cd \"$APP\" && exec node --import tsx src/main.ts"]
