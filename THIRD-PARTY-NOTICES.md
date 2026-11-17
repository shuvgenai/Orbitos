# Third-party notices

This repository holds the OrbitCrew per-instance stack — the Front Desk, api, web and
worker programs, the ORBIT schema, and `template/compose.yml`, which is what a customer
actually deploys. It packages two MIT-licensed upstream projects and a set of permissively
licensed infrastructure images. No upstream source is vendored here, edited in place, or
carried as a patch.

**The pins here are NOT the same as the infra repository's.** That repository builds its own
engine from a later Paperclip release and a Hermes *source* commit; this one consumes
published images recorded in `template/engine/pinned-versions.json`. The disagreement is
known and recorded as FD-35 in the infra repo's `governing/founder-decisions.md`; closing it
is an open item in `TODOS.md`. Until it is closed, **these are the pins that ship from here**
and this file describes them, not the other set.

`template/engine/Dockerfile` applies **no brand overlay**, so both upstream licence files
pass through into the built image untouched by construction rather than by a skip rule.

---

## Paperclip

- **Role:** the Orchestrator. Presented to customers as "OrbitCrew Orchestrator".
- **Obtained as:** `ghcr.io/paperclipai/paperclip:sha-d554c47@sha256:a02ac35ac41df911af477422ea0e781cf41d2b2c600c66f0a5ac9d8c63f52c2c`
- **Pin recorded:** 2026-09-30, in `template/engine/pinned-versions.json`
- **Licence:** MIT, `Copyright (c) 2025 Paperclip AI`. Licence text ships inside the image at
  `/app/LICENSE`.
- **Note:** `hermes_local`, the adapter that lets the Orchestrator run an agent as a
  subprocess, is built into Paperclip and ships under this same licence. There is no separate
  adapter component to license, and it is not named to customers.

## Hermes Agent

- **Role:** the agent runtime. Presented to customers as "OrbitCrew Agents".
- **Obtained as:** `nousresearch/hermes-agent:v2026.9.24@sha256:fca358f12efd65bfaaca05884166f15c0e2788375ca30d77061ac1ebc96452b7`
- **Pin recorded:** 2026-09-30, in `template/engine/pinned-versions.json`
- **Licence:** MIT, `Copyright (c) 2025 Nous Research`. Licence text ships inside the image
  under `/opt/hermes`.
- **Upstream source:** https://github.com/NousResearch/hermes-agent

The full MIT text, identical for both projects, is reproduced in the infra repository's
`THIRD-PARTY-NOTICES.md` and ships inside the built images. MIT's only condition is that the
copyright notice and the permission notice travel with every copy; both do.

---

## Infrastructure images in `template/compose.yml`

| service | pinned image | licence |
|---|---|---|
| postgres | `pgvector/pgvector:pg16@sha256:0dd3149a06e4579a0d70d8fef9945636cd514005e7237deb27f9b67886f8dc4f` | PostgreSQL License (PostgreSQL); PostgreSQL License (pgvector) |
| redis | `redis:7-alpine@sha256:c5d34a98396a4775e223c74e929162c35c5a2182901ba26b50ade939941ce14b` | BSD-3-Clause |

Both digests are asserted by `template/test/image-pins.test.ts`, which walks
`.github/workflows` and `.github/actions` and fails on any unpinned or tag-only reference.

## The base operating system layer

The engine image is Debian-based, inherited from the pinned Paperclip image. A Debian base
carries system packages under a range of licences including **GPL and LGPL** — `bash`, `git`,
`glibc` and `coreutils` among them. Their notices ship at `/usr/share/doc/*/copyright`, which
is Debian's own convention and how those obligations are normally met, and nothing in this
build removes that directory.

**This binds only if the built image itself is distributed.** If OrbitCrew ships as a recipe
the customer builds on their own machine, the customer pulls these bases themselves and
OrbitCrew redistributes none of them. Either way, do not describe the image as wholly
permissively licensed.

## Application dependencies

The programs in this repository depend on React, Radix UI, TanStack Query, react-hook-form,
Zod and Prisma, all permissively licensed (MIT or Apache-2.0), plus the Inter typeface via
`@fontsource-variable/inter` under the **SIL Open Font License 1.1**. Their licence files are
redistributed inside `node_modules` in the built program images rather than being summarised
here.

OrbitCrew's dependency rule is permissive-only — Apache-2.0, MIT, BSD-2, BSD-3, ISC, PSF-2.0,
PostgreSQL, OFL. No AGPL, no copyleft, no source-available licences.

## What this notice does not cover

- A per-dependency SBOM. Generate one from the built images if a buyer's procurement asks.
- Trademarks. MIT grants copyright permissions and says nothing about marks. OrbitCrew
  removes upstream's marks from customer-facing surfaces rather than using them.
- Model provider terms. The engine calls Anthropic's API with a key the **customer** supplies;
  no provider credential ships with OrbitCrew.
