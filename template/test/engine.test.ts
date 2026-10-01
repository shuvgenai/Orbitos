import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const pinned = JSON.parse(readFileSync(new URL('../engine/pinned-versions.json', import.meta.url), 'utf8')) as {
  recordedOn: string;
  paperclip: { image: string; tag: string; digest: string };
  hermes: { image: string; tag: string; digest: string };
};

test('both engine images are pinned by digest (FLT-1, SEC-6)', () => {
  for (const name of ['paperclip', 'hermes'] as const) {
    expect(pinned[name].digest, name).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pinned[name].image, name).not.toContain('@');
    expect(pinned[name].image, name).not.toContain(':');
  }
});

test('the pinned images are the expected upstream repositories', () => {
  expect(pinned.paperclip.image).toBe('ghcr.io/paperclipai/paperclip');
  expect(pinned.hermes.image).toBe('nousresearch/hermes-agent');
});

// A moving tag would let two instances built from the same template run different code (FLT-1).
test('neither tag is a moving tag', () => {
  for (const name of ['paperclip', 'hermes'] as const) {
    expect(['latest', 'stable', 'main', 'nightly', 'beta', 'canary'], name).not.toContain(pinned[name].tag);
  }
});

test('the pinning date is recorded', () => {
  expect(pinned.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
