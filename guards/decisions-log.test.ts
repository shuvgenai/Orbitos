// Every decision in docs/decisions.md says why.
//
// Spec section 8's last row asks for an entry per decision, with its reason.
// Nothing checked it, and the log is 46 entries long, so "somebody will notice"
// had already stopped being true.
//
// This guard checks shape, never content. It cannot tell a reason from a
// sentence that looks like one, and it is not trying to: what it prevents is an
// entry landing with no reason at all, which is the failure that actually
// happens when a task is being finished in a hurry.
//
// Four openers are accepted, not one. Reason, Why and Result cover a decision,
// an explanation and a measurement. Superseded covers the fourth kind of entry
// this log holds: a pointer left behind so that a reader of an older commit
// finds the correction. A pointer has no reason of its own, and a Reason line
// added to one would be filler written to satisfy this file, which is the exact
// failure mode a shape guard invites.
//
// A superseded entry carries one extra obligation, because a pointer that
// points nowhere is worse than no pointer: it must name the date of the entry
// that replaces it, and this log must hold a heading with that date (founder
// decision, 2026-10-08).
import { expect, test } from 'vitest';
import { readRepoFile } from './lib/walk.ts';

const LOG = 'docs/decisions.md';

/** The four ways an entry may open its explanation. Bold, as every entry writes them. */
const OPENERS = ['**Reason', '**Why', '**Result', '**Superseded'];

/** An ISO date, which is how every heading in this log names itself. */
const ISO = /\d{4}-\d{2}-\d{2}/g;

/** A fenced block, and an inline code span. Both are quotation, not this entry's words. */
const FENCED = /```[\s\S]*?```/g;
const INLINE = /`[^`]*`/g;

/**
 * An entry's body with its quotations removed.
 *
 * Both tests read this rather than the raw body, and the first version of this
 * guard did not, which is how it failed on the very entry that documents it.
 * That entry quotes the four opener names and quotes a probe that pointed at
 * 2027-01-01, so a raw scan read it as a superseded entry pointing at a date
 * with no heading. The rule is now what it always meant: an entry's own words
 * explain it, and a quoted log, command or opener name is evidence inside it.
 *
 * It also stops an entry satisfying the opener rule by quoting an opener in a
 * code span, and stops a timestamp inside pasted output being read as a pointer
 * to another entry.
 */
const prose = (body: string) => body.replace(FENCED, '').replace(INLINE, '');

type Entry = { readonly heading: string; readonly date: string | undefined; readonly prose: string };

/**
 * The log split into entries at its `## ` headings.
 *
 * `##` exactly, not `###`: a sub-heading inside an entry is part of that entry,
 * and treating one as a new entry would ask a section for its own reason line.
 */
function entries(): readonly Entry[] {
  const lines = readRepoFile(LOG).split('\n');
  const starts = lines.flatMap((line, i) => (line.startsWith('## ') ? [i] : []));

  return starts.map((start, n) => {
    const end = starts[n + 1] ?? lines.length;
    const heading = lines[start] ?? '';
    return {
      heading,
      date: heading.match(ISO)?.[0],
      prose: prose(lines.slice(start + 1, end).join('\n')),
    };
  });
}

test('the guard is reading a log, not an empty file', () => {
  // Every assertion below passes vacuously over zero entries, and a heading
  // style change or a move of this file would produce exactly that. 46 entries
  // existed when this was written, so 40 is a floor that cannot be reached by
  // accident.
  expect(entries().length).toBeGreaterThanOrEqual(40);
});

test('every entry says why, in one of the four accepted ways', () => {
  const silent = entries()
    .filter((entry) => !OPENERS.some((opener) => entry.prose.includes(opener)))
    .map((entry) => entry.heading);

  expect(silent, `add one of ${OPENERS.join(', ')} to each of these`).toEqual([]);
});

test('a superseded entry names the dated entry that replaces it, and that entry exists', () => {
  const all = entries();
  const dates = new Set(all.flatMap((entry) => (entry.date === undefined ? [] : [entry.date])));
  const broken: string[] = [];

  for (const entry of all) {
    if (!entry.prose.includes('**Superseded')) continue;

    // Any date in the entry's own words, not only the one on the Superseded
    // line. An entry may explain itself in more than one sentence, and the
    // obligation is that the replacement is named, not that it is named first.
    const named = [...entry.prose.matchAll(ISO)].map((m) => m[0]).filter((d) => d !== entry.date);

    if (named.length === 0) {
      broken.push(`${entry.heading} names no replacement date`);
      continue;
    }
    for (const date of named) {
      if (!dates.has(date)) broken.push(`${entry.heading} points at ${date}, which has no heading in this log`);
    }
  }

  expect(broken).toEqual([]);
});
