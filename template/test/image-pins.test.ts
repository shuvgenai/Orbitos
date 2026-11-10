import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';

// Every image this repo names must be pinned by digest, in both compose files and in both
// Dockerfiles. A tag alone means two deployments of the same commit can run different
// software, which is FLT-1; `pgvector/pgvector:pg16`, `redis:7-alpine` and
// `node:24.14.1-slim` were all floating until 2026-11-09, and nothing failed when they were.
// That is what this file is for: the rule is now a failing test, not a note in a review.
const DIGEST = /@sha256:[0-9a-f]{64}$/;

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const composeFiles = {
  'compose.dev.yml': parse(read('../../compose.dev.yml'), { merge: true }),
  'template/compose.yml': parse(read('../compose.yml'), { merge: true }),
} as Record<string, { services: Record<string, { image?: string }> }>;

test('every compose image is pinned by digest (FLT-1)', () => {
  let seen = 0;
  for (const [file, doc] of Object.entries(composeFiles)) {
    for (const [name, svc] of Object.entries(doc.services)) {
      if (!svc.image) continue; // built from source, covered by the Dockerfile tests below
      seen += 1;
      expect(svc.image, `${file} → ${name}`).toMatch(DIGEST);
      // A digest with no tag is reproducible but unreadable: nobody can tell what it is.
      expect(svc.image, `${file} → ${name} should keep its tag for readability`).toMatch(
        /^[^\s@]+:[^\s@]+@sha256:/,
      );
    }
  }
  expect(seen, 'no compose service declared an image — the test is not looking at anything').toBeGreaterThan(0);
});

// The dev stack and the instance stack must not drift apart: a bug reproduced on one has to
// mean something on the other.
test('the dev stack and the instance stack pin the same Postgres and Redis', () => {
  const dev = composeFiles['compose.dev.yml']!.services;
  const inst = composeFiles['template/compose.yml']!.services;
  expect(inst.postgres!.image).toBe(dev.postgres!.image);
  expect(inst.redis!.image).toBe(dev.redis!.image);
});

test('no compose image uses a moving tag', () => {
  for (const [file, doc] of Object.entries(composeFiles)) {
    for (const [name, svc] of Object.entries(doc.services)) {
      if (!svc.image) continue;
      const tag = svc.image.split('@')[0]!.split(':').pop();
      expect(['latest', 'stable', 'main', 'nightly', 'beta', 'canary'], `${file} → ${name}`).not.toContain(tag);
    }
  }
});

// A FROM may be: a digest-pinned reference, an earlier stage in the same file, `scratch`, or a
// build argument. The build-arg case is checked separately below, where the values live.
const dockerfiles = {
  Dockerfile: read('../../Dockerfile'),
  'template/engine/Dockerfile': read('../engine/Dockerfile'),
};

test('every external Dockerfile base is pinned by digest, a build arg, or an earlier stage', () => {
  for (const [file, text] of Object.entries(dockerfiles)) {
    const stages = new Set<string>();
    let froms = 0;
    for (const line of text.split(/\r?\n/)) {
      const m = /^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?\s*$/i.exec(line.trim());
      if (!m) continue;
      froms += 1;
      const [, ref, stage] = m;
      const ok = DIGEST.test(ref!) || stages.has(ref!) || ref === 'scratch' || /^\$\{?[A-Z_][A-Z0-9_]*\}?$/.test(ref!);
      expect(ok, `${file}: FROM ${ref} is neither digest-pinned, a build arg, nor an earlier stage`).toBe(true);
      if (stage) stages.add(stage);
    }
    expect(froms, `${file} has no FROM line — the test is not reading what it thinks`).toBeGreaterThan(0);
  }
});

// The engine's refs are supplied as build arguments, so the Dockerfile cannot carry a digest.
// CI is where those values are written down in this repo, and a floating value there would
// defeat the ARG indirection entirely.
test('the engine refs CI passes are digest-pinned', () => {
  const ci = read('../../.github/workflows/ci.yml');
  const refs = [...ci.matchAll(/^\s*(PAPERCLIP_REF|HERMES_REF):\s*(\S+)\s*$/gm)];
  expect(refs.length, 'neither engine ref was found in ci.yml').toBeGreaterThan(0);
  for (const [, name, value] of refs) expect(value, name).toMatch(DIGEST);
});
