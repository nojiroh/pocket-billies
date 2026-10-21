// UI-1: counts the raw values that break the UI rules (docs/phases/06-plan.md, game/css/tokens.css), per rule and
// file, next to the token uses that follow them. A report only: it never fails (UI-6 turns it into a gate).
//   node tools/ui-lint.mjs            # the table: each rule, raw vs token, the worst files
//   node tools/ui-lint.mjs --json     # every count per rule and file
//   node tools/ui-lint.mjs --lines    # UI-3b: every raw value: file:line, the rule, the line's text
// The rules and how they count: game/js/logic/ui-lint.js.
// Blurred surfaces per screen can't be read from the files: the smoke run logs uiBlurCount() per screen.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { UI_LINT_RULES, lintCss, lintJs, report, uiLintFindings, uiLintReads } from '../game/js/logic/ui-lint.js';

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

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (process.argv.includes('--lines'))
    for (const f of lintGameFindings()) console.log(`${f.file}:${f.line}\t${f.rule}\t${f.text}`);
  else {
    const total = lintGame();
    console.log(process.argv.includes('--json') ? JSON.stringify(total, null, 1) : report(total));
  }
}
