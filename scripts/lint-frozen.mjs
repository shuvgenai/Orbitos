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
//
// --fail-on-danger makes it exit 1 on react/no-danger and on nothing else.
// That rule is the one hard check the freeze does not buy out, because
// dangerouslySetInnerHTML renders whatever a job, an email or a connector
// produced with no escaping, and a frozen directory is not a safer place to do
// that than any other. Every other finding there stays a report.
//
// What that mode can and cannot see, stated plainly rather than implied:
// react/no-danger matches a JSX attribute. There are no .tsx or .jsx files in
// the seven frozen directories today and no dangerouslySetInnerHTML anywhere
// in them, so the check currently passes by having nothing to look at. It is a
// tripwire that arms on the commit that puts JSX in frozen code. It does not
// see React.createElement('div', { dangerouslySetInnerHTML }), and it does not
// see HTML built by string concatenation, which is what shared/src/body.ts
// handles.
import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { FROZEN } from '../eslint.config.js';

// fileURLToPath rather than URL.pathname: pathname keeps the leading slash
// before a Windows drive letter and leaves %20 in place of a space.
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The one rule a frozen finding is not allowed to stay a report. */
const HARD_RULE = 'react/no-danger';
const failOnDanger = process.argv.slice(2).includes('--fail-on-danger');

const eslint = new ESLint({
  cwd: REPO_ROOT,
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

if (!failOnDanger) process.exit(0);

const danger = [];
for (const report of reports) {
  for (const result of report.results) {
    for (const message of result.messages) {
      if (message.ruleId !== HARD_RULE) continue;
      const file = relative(REPO_ROOT, result.filePath).split(sep).join('/');
      danger.push(`${file}:${message.line}:${message.column}  ${message.message}`);
    }
  }
}

console.log('');
if (danger.length === 0) {
  console.log(`${HARD_RULE}: none. The freeze does not buy this rule out.`);
  process.exit(0);
}

console.error(`${HARD_RULE} in frozen code, which is not reported and left alone:`);
for (const line of danger) console.error(`  ${line}`);
console.error('');
console.error('dangerouslySetInnerHTML renders text from outside the office as markup.');
console.error('Fix it, or take it to the founder. Do not add it to the report.');
process.exit(1);
