import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SetupError, readSetupInputs } from './setup.ts';

/**
 * SETUP_DIR holds the owner's two files, and this suite exists because of what they ARE.
 *
 * They are not configuration. `engine/bridge.ts` splices them into the prompt verbatim, under
 * `## Owner tone samples` and `## Firm facts`, and the reply that prompt produces goes to the
 * customer's own client, from the customer's own mailbox, in the customer's name.
 *
 * So the decision is REFUSE TO BOOT, and these cases are what stop it being quietly relaxed
 * into "boot degraded". Booting without them would be invisible: `/healthz` is liveness only
 * (`shared/src/health.ts` answers a static 200), so a Front Desk with no tone samples and no
 * firm facts reports healthy while answering clients in a generic voice with invented facts.
 * A service that refuses to start is noticed by the person doing the install, in seconds. A
 * degraded one is noticed by a client who got a wrong answer.
 */
function dir(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'orbit-setup-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(d, name), body);
  return d;
}

const BOTH = { 'tone-samples.md': '  Warm, brief, no exclamation marks.\n', 'facts.md': 'We close at 5.\n' };

describe('the owner setup files', () => {
  it('reads both and trims them', () => {
    expect(readSetupInputs(dir(BOTH))).toEqual({
      toneSamples: 'Warm, brief, no exclamation marks.',
      facts: 'We close at 5.',
    });
  });

  it.each(['tone-samples.md', 'facts.md'])('refuses to boot when %s is absent', (missing) => {
    const files = { ...BOTH };
    delete (files as Record<string, string>)[missing];
    expect(() => readSetupInputs(dir(files))).toThrow(SetupError);
    expect(() => readSetupInputs(dir(files))).toThrow(new RegExp(missing.replace('.', '\\.')));
  });

  it.each(['', '   \n\t\n'])('refuses to boot on a file that is empty or whitespace (%j)', (body) => {
    // An empty file satisfies the bind mount and not the program. That is exactly how the CI
    // smoke job failed: the directory existed, so the mount worked, and frontdesk still died.
    expect(() => readSetupInputs(dir({ ...BOTH, 'facts.md': body }))).toThrow(SetupError);
  });

  it('says what the file is for, not just that it is missing', () => {
    // The old message was `facts.md is missing or empty in SETUP_DIR` and nothing else, which
    // tells an installer the filename and not what to put in it.
    let message = '';
    try {
      readSetupInputs(dir({ 'tone-samples.md': 'x' }));
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('facts.md is missing or empty in SETUP_DIR');
    expect(message).toMatch(/prompt|voice|client/i);
  });
});
