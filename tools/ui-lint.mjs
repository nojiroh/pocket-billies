// UI-1: counts the raw values that break the UI rules (docs/phases/06-plan.md, game/css/tokens.css), per rule and
// file, next to the token uses that follow them. UI-6: a gate (the ratchet, UI_LINT_CEILING in game/js/logic/ui-lint.js).
//   node tools/ui-lint.mjs            # the table: each rule, raw vs token, the worst files
//   node tools/ui-lint.mjs --check    # UI-6: exit 1 when a rule has more raw values than its ceiling (npm run lint)
//   node tools/ui-lint.mjs --save     # UI-6: lower the ceilings to today's counts (never raises one)
//   node tools/ui-lint.mjs --json     # every count per rule and file
//   node tools/ui-lint.mjs --lines    # UI-3b: every raw value: file:line, the rule, the line's text
// The rules and how they count: game/js/logic/ui-lint.js.
// Blurred surfaces per screen can't be read from the files: the smoke run logs uiBlurCount() per screen.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  UI_LINT_CEILING,
  UI_LINT_RULES,
  lintCss,
  lintJs,
  report,
  uiLintFindings,
  uiLintRatchet,
  uiLintReads,
} from '../game/js/logic/ui-lint.js';

// UI-3b: the rules and the counting are in game/js/logic/ui-lint.js (the Studio runs them too)
export { UI_LINT_RULES, lintCss, lintJs, report, stripCss, stripJs, uiLintFindings } from '../game/js/logic/ui-lint.js';

const ROOT = join(import.meta.dirname, '..');

const walk = (dir, ext) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === 'vendor' ? [] : walk(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });

/** the files the lint reads, relative to root (the Studio reads the same list from the game page: UI-3b) */
export function lintFiles(root = ROOT) {
  return [...walk(join(root, 'game/css'), '.css'), ...walk(join(root, 'game/js'), '.js')]
    .map(f => relative(root, f))
    .filter(uiLintReads);
}

/** UI-3b: every raw value in the game, with its file and line */
export const lintGameFindings = (root = ROOT) =>
  lintFiles(root).flatMap(f => uiLintFindings(readFileSync(join(root, f), 'utf8'), f));

/** the whole game: {ruleId: {raw, token, files: {file: raw}}} */
export function lintGame(root = ROOT) {
  const total = Object.fromEntries(UI_LINT_RULES.map(x => [x.id, { raw: 0, token: 0, files: {} }]));
  const add = (file, counts) => {
    for (const [id, c] of Object.entries(counts)) {
      total[id].raw += c.raw;
      total[id].token += c.token;
      if (c.raw) total[id].files[file] = (total[id].files[file] || 0) + c.raw;
    }
  };
  for (const f of lintFiles(root)) {
    const text = readFileSync(join(root, f), 'utf8');
    add(f, f.endsWith('.css') ? lintCss(text, f) : lintJs(text, f));
  }
  return total;
}

/** UI-6: write lowered ceilings into game/js/logic/ui-lint.js (a rule over its ceiling keeps the old number) */
export function saveCeiling(raw, root = ROOT) {
  const file = join(root, 'game/js/logic/ui-lint.js');
  const next = Object.fromEntries(
    UI_LINT_RULES.map(({ id }) => [id, Math.min(raw[id] || 0, UI_LINT_CEILING[id] ?? 0)])
  );
  const body = Object.entries(next)
    .map(([id, n]) => `  ${id}: ${n},`)
    .join('\n');
  const text = readFileSync(file, 'utf8').replace(
    /(\/\/ ceiling: start\n)[\s\S]*?(\/\/ ceiling: end)/,
    `$1export const UI_LINT_CEILING = {\n${body}\n};\n$2`
  );
  writeFileSync(file, text);
  return next;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (process.argv.includes('--check') || process.argv.includes('--save')) {
    const raw = Object.fromEntries(Object.entries(lintGame()).map(([id, t]) => [id, t.raw]));
    const { over, under } = uiLintRatchet(raw);
    const name = id => UI_LINT_RULES.find(r => r.id === id).name.toLowerCase();
    for (const o of over) console.log(`ui-lint: ${name(o.id)}: ${o.raw} raw values, the ceiling is ${o.max}`);
    if (process.argv.includes('--save')) {
      saveCeiling(raw);
      console.log(`ui-lint: ceilings saved (${under.length} lowered)`);
    } else if (under.length)
      console.log(`ui-lint: ${under.map(u => `${name(u.id)} ${u.max} -> ${u.raw}`).join(', ')}: keep it with --save`);
    if (over.length) process.exit(1);
    if (!under.length) console.log('ui-lint: every rule at its ceiling');
  } else if (process.argv.includes('--lines'))
    for (const f of lintGameFindings()) console.log(`${f.file}:${f.line}\t${f.rule}\t${f.text}`);
  else {
    const total = lintGame();
    console.log(process.argv.includes('--json') ? JSON.stringify(total, null, 1) : report(total));
  }
}
