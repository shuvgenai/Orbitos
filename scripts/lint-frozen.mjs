// Reports the lint findings inside the seven frozen directories, per directory.
//
// `pnpm lint` ignores those directories, because findings there are reported
// and never fixed: a lint fix in frozen code needs the founder's explicit
// approval, case by case, and never as part of another task. That left the
// counts in docs/decisions.md with no command behind them, measured once by
// hand and stale from the next commit onward. This is that command.
//
// It reports and exits 0. It never fixes anything: ESLint is constructed
// without `fix`, and outputFixes is never called, so there is no path through
// this file that writes to a frozen directory.
import { ESLint } from 'eslint';
import { FROZEN } from '../eslint.config.js';

const REPO_ROOT = new URL('../', import.meta.url);

const eslint = new ESLint({
  cwd: new URL('.', REPO_ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  overrideConfigFile: 'eslint.frozen.config.js',
  // Said out loud rather than left to the default, because it is the one
  // property of this script that matters most.
  fix: false,
  // A frozen directory that holds no linted file reports zero rather than
  // throwing, so removing a package does not look like a tooling fault.
  errorOnUnmatchedPattern: false,
});

/** `frontdesk/` as ESLint wants it, and as the report prints it. */
const asDir = (frozen) => frozen.replace(/\/$/, '');

async function report(frozen) {
  const results = await eslint.lintFiles([asDir(frozen)]);
  const rules = new Map();
  let errors = 0;
  let warnings = 0;
  let files = 0;

  for (const result of results) {
    if (!result.errorCount && !result.warningCount) continue;
    files += 1;
    errors += result.errorCount;
    warnings += result.warningCount;
    for (const message of result.messages) {
      const rule = message.ruleId ?? 'parse-error';
      rules.set(rule, (rules.get(rule) ?? 0) + 1);
    }
  }

  const breakdown = [...rules]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([rule, count]) => `${rule} ${count}`)
    .join(', ');

  return { dir: asDir(frozen), errors, warnings, files, breakdown, results };
}

const reports = [];
for (const frozen of FROZEN) reports.push(await report(frozen));

const width = Math.max(...reports.map((r) => r.dir.length), 'directory'.length);
const pad = (text) => String(text).padEnd(width);

console.log('Lint findings in the frozen directories. Reported, never fixed.');
console.log('A fix here needs the founder’s explicit approval, case by case.');
console.log('');
console.log(`${pad('directory')}  errors  warnings  files  rules`);
for (const r of reports) {
  console.log(
    `${pad(r.dir)}  ${String(r.errors).padStart(6)}  ${String(r.warnings).padStart(8)}  ${String(r.files).padStart(5)}  ${r.breakdown}`,
  );
}

const errors = reports.reduce((sum, r) => sum + r.errors, 0);
const warnings = reports.reduce((sum, r) => sum + r.warnings, 0);
console.log('');
console.log(`${pad('total')}  ${String(errors).padStart(6)}  ${String(warnings).padStart(8)}`);
