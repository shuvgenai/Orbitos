// The image contains every workspace the programs import, and no generated code
// is committed.
//
// api/src/auth.ts imports `@orbit/db/client`, which db/package.json maps to
// ./src/client.ts. The Dockerfile copied shared/ and the app directory and never
// copied db/, so that file was absent from the image and api died on
// ERR_MODULE_NOT_FOUND before it listened. It had never started from this image
// in any environment, and four other compose-smoke failures hid it: the job
// never got far enough to read api's log.
//
// worker was healthy the whole time, which is the detail that makes this worth a
// guard rather than a comment. worker imports nothing from @orbit/db, so the
// stack looked three-quarters working while api could not load its own code.
//
// Copying db/ is not enough on its own. The Prisma client is generated, it is
// deliberately NOT committed, and the runtime install is --prod, so the Prisma
// CLI is not there to generate it. The fix is a build stage that installs
// everything and generates; this guard pins the parts of that which are
// checkable from the repository.
import { expect, test } from 'vitest';
import { readRepoFile, trackedFiles } from './lib/walk.ts';

const DOCKERFILE = 'Dockerfile';

/** The workspaces a program can import at runtime, so the image has to carry them. */
const IMPORTED_WORKSPACES = ['shared', 'db'] as const;

/** A `COPY <src> <dest>` line, with any `--from` flag. */
const COPY = /^COPY\s+(?:--from=\S+\s+)?(.+)$/gm;

/** Every COPY line's arguments, as written. */
function copyLines(): readonly string[] {
  return [...readRepoFile(DOCKERFILE).matchAll(COPY)].map((m) => (m[1] ?? '').trim());
}

test('the image copies every workspace a program imports at runtime', () => {
  const copies = copyLines();

  // A manifest-only copy does not count. `COPY db/package.json db/` is what the
  // dependency install needs, and it is exactly what made this bug invisible:
  // the string "db" appeared in the Dockerfile while none of db's source did.
  const sourceCopied = (workspace: string) =>
    copies.some(
      (line) => new RegExp(String.raw`(^|\s|/)${workspace}(/)?(\s|$)`).test(line) && !line.includes('.json'),
    );

  const missing = IMPORTED_WORKSPACES.filter((workspace) => !sourceCopied(workspace));

  expect(missing, 'a program importing one of these fails with ERR_MODULE_NOT_FOUND').toEqual([]);
});

test('the generated Prisma client is not committed', () => {
  // Generated code in git drifts from the schema silently and shows up in every
  // diff. It belongs in the image, built there, which is why the Dockerfile
  // generates it rather than copying it out of a checkout.
  const generated = trackedFiles().filter((file) => file.startsWith('db/src/generated/'));

  expect(generated, 'generated code belongs in the image, not in git').toEqual([]);
});

test('the Dockerfile generates the Prisma client rather than hoping it exists', () => {
  // The pairing the two rules above imply. db/ reaching the image is useless if
  // db/src/generated is neither committed nor generated, and the runtime install
  // is --prod, so the CLI that generates it has to live in a stage that installs
  // more than --prod.
  const text = readRepoFile(DOCKERFILE);

  expect(text, 'the image needs a prisma generate step').toMatch(/prisma generate/);
  expect(text, 'prisma generate needs a stage that installs more than --prod').toMatch(
    /pnpm install --frozen-lockfile\s*$/m,
  );
});

test('the guard is reading a Dockerfile, not an empty file', () => {
  // Every assertion above passes vacuously if the COPY scan finds nothing, which
  // a rename of the file would cause. There were eight COPY lines when this was
  // written.
  expect(copyLines().length).toBeGreaterThanOrEqual(8);
});
