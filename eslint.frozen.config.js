// The frozen directories, linted. `pnpm lint` ignores them on purpose, because
// their findings are reported and never fixed, and a gate that cannot go green
// is a gate somebody switches off. This config exists so the reporting half is
// a committed command rather than something reconstructed by hand each time
// anyone wants the counts.
//
// It is not `pnpm lint`'s config and must never become it: nothing here changes
// a rule, and the only difference from eslint.config.js is which directories
// are read.
import base, { FROZEN } from './eslint.config.js';

export default base.map((block) =>
  // Only the ignores block is rewritten, and only by removing the seven frozen
  // names. reference/, landing/, archive/, node_modules, generated, dist and
  // the Playwright artefacts stay ignored, so lifting the freeze cannot
  // quietly start reporting on the prototype or on vendored code.
  block.ignores ? { ignores: block.ignores.filter((i) => !FROZEN.includes(i)) } : block,
);
