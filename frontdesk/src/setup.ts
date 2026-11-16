import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The owner's two SETUP_DIR files, and the decision about what happens when one is missing.
 *
 * DECIDED 2026-11-16: REFUSE TO BOOT. Not "boot degraded and say so".
 *
 * These are not configuration values. `engine/bridge.ts` splices them into the prompt verbatim
 * under `## Owner tone samples` and `## Firm facts`, and the reply that prompt produces leaves
 * the customer's own mailbox, in the customer's name, to the customer's own client. A Front
 * Desk started without them does not do less — it writes in a generic voice and has no facts to
 * answer from, which is how a confident wrong answer reaches a client.
 *
 * Degrading would also be invisible. `/healthz` is liveness only (`shared/src/health.ts`
 * answers a static 200), so a degraded Front Desk reports healthy and nothing distinguishes it
 * from a working one until someone reads an outgoing reply. Against that, refusing to start is
 * noticed by the person doing the install, in seconds, with the filename in the message.
 *
 * WHAT IS STILL NOT GUARDED, and is worth knowing: nothing here can tell the customer's own
 * writing from a placeholder. The CI smoke job writes `Smoke filler. Not a real tone sample.`
 * into both files, and this module accepts it — correctly, because a non-empty file is all a
 * program can check. An install that leaves filler in place boots and sounds like filler.
 */

export type SetupInputs = { toneSamples: string; facts: string };

/** Thrown rather than exiting, so the refusal is testable. `main.ts` turns it into a fatal. */
export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetupError';
  }
}

const WHY: Record<string, string> = {
  'tone-samples.md':
    'It is the owner writing in their own voice, spliced into the prompt that answers clients.',
  'facts.md':
    'It is what the Front Desk is allowed to state as fact; without it a reply to a client is invention.',
};

export function readSetupFile(dir: string, name: string): string {
  let text: string;
  try {
    text = readFileSync(join(dir, name), 'utf8');
  } catch {
    text = '';
  }
  const trimmed = text.trim();
  if (trimmed === '') {
    // The first clause is unchanged on purpose: it is the string the runbook, the CI job's
    // comment and the smoke-job history all quote.
    throw new SetupError(
      `${name} is missing or empty in SETUP_DIR. ${WHY[name] ?? ''} ` +
        'The Front Desk refuses to start rather than answer a client without it.',
    );
  }
  return trimmed;
}

export function readSetupInputs(dir: string): SetupInputs {
  return {
    toneSamples: readSetupFile(dir, 'tone-samples.md'),
    facts: readSetupFile(dir, 'facts.md'),
  };
}
