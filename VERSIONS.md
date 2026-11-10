# Pinned images — the web half

Recorded: **2026-11-09**

Every image this repo names is pinned to a tag **and** an index digest, so two builds of the
same commit run the same software. Nothing here uses `latest`, `stable` or a bare tag.

`template/test/image-pins.test.ts` enforces it: it fails on a compose image without a digest,
on a `FROM` that is neither digest-pinned nor a build arg nor an earlier stage, on a moving
tag, on the dev and instance stacks drifting apart, and on a floating engine ref in
`.github/workflows/ci.yml`. The test is proven to fail — unpinning Redis in `compose.dev.yml`
turns two of its five assertions red.

| Image | Tag | Digest | Where it is set |
|---|---|---|---|
| Postgres + pgvector | `pg16` | `sha256:0dd3149a06e4579a0d70d8fef9945636cd514005e7237deb27f9b67886f8dc4f` | `compose.dev.yml`, `template/compose.yml` |
| Redis | `7-alpine` | `sha256:c5d34a98396a4775e223c74e929162c35c5a2182901ba26b50ade939941ce14b` | `compose.dev.yml`, `template/compose.yml` |
| Node (the four programs' base) | `24.14.1-slim` | `sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c` | `Dockerfile` |

All three are OCI image **index** digests, so they stay multi-architecture: the same
reference works on an `amd64` server and an `arm64` laptop.

**These digests were resolved from the registry on 2026-11-09, not from a local copy.** None
of the three images was present on this machine, so there is no "the build we have been
running" to pin to — the first build after this change is the first build at these digests.
If a stack that was known good is later found to differ, this row is why.

## This file does not record the engine

The Paperclip + Hermes engine is pinned in the **infra repo** — `infra/VERSIONS.md` in
`orbitos-infra` — which is canonical: it is what runs, what the migrations were applied
against, and what the restore drill proved.

This repo also carries `template/engine/pinned-versions.json`, a 2026-09-30 record that
**disagrees** with infra's (a different Paperclip digest, and Hermes as a Docker Hub image
rather than a commit built from source), and `.github/workflows/ci.yml` lines 37-38 repeat
those same values a third time.

**Decided 2026-11-10 (FD-35 in `orbitos-infra` `governing/founder-decisions.md`): this stack
will consume infra's built image**, and the second and third copies go with that port.
**The interim, which is binding until then: this repo's engine is a declared dev harness,
and `pinned-versions.json` STAYS.** It is a build input, not a version record —
`pnpm stack:up`, `docs/runbooks/slice-1-local.md` and the CI smoke job all require the two
refs it supplies, so deleting it early breaks them. "Decided" is not permission to tidy it
now; the port is the thing that removes it. Tracked in `TODOS.md`.

## Upgrading one of these

1. Change **one** pin at a time, tag *and* digest together.
2. Resolve the digest from the registry rather than copying a tag:
   `docker buildx imagetools inspect <image>:<tag> --format '{{.Manifest.Digest}}'`
3. Keep `compose.dev.yml` and `template/compose.yml` on the same digest — the test fails
   otherwise, which is the point: a bug reproduced on the dev stack has to mean something on
   the instance stack.
4. Add a row to the history below, then `pnpm test:unit` and `pnpm db:up`.

## History

| Date | Change |
|---|---|
| 2026-11-09 | First pins. `pgvector/pgvector:pg16`, `redis:7-alpine` and `node:24.14.1-slim` were floating tags in `compose.dev.yml`, `template/compose.yml` and `Dockerfile`; all three now carry index digests, and `template/test/image-pins.test.ts` was added so they cannot float again. Item 5 of the 2026-11-07 audit. |
