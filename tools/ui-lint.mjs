// UI-1: counts the raw values that break the UI rules (docs/phases/06-plan.md, game/css/tokens.css), per rule and
// file, next to the token uses that follow them. A report only: it never fails (UI-6 turns it into a gate).
//   node tools/ui-lint.mjs            # the table: each rule, raw vs token, the worst files
//   node tools/ui-lint.mjs --json     # every count per rule and file
// The counts come from patterns on comment-stripped text, not a CSS parser: treat them as within a few percent.
// Custom property definitions (--x: ...) are where tokens get their values, so they are not counted as raw.
// Blurred surfaces per screen can't be read from the files: the smoke run logs uiBlurCount() per screen.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
const LENGTH = /(?<![\w.#-])-?\d*\.?\d+(?:px|rem|em)\b/g;

export const UI_LINT_RULES = [
  { id: 'radius', name: 'Corners on the radius tokens', token: /var\(--r-/g },
  { id: 'space', name: 'Space on the --s scale', token: /var\(--(?:s\d|gutter|pad-panel)\b/g },
  { id: 'shadow', name: 'Shadows on the depth tokens', token: /var\(--depth-/g },
  { id: 'keyframes', name: 'Keyframes in motion.css only', token: null },
  { id: 'duration', name: 'Times on the motion tokens', token: /var\(--(?:m-|stagger|toast-time)/g },
  { id: 'font', name: 'Fonts by token', token: /var\(--font-/g },
  { id: 'colour', name: 'Colours as variables (CSS rules)', token: null },
  { id: 'important', name: '!important', token: null },
  { id: 'zindex', name: 'Layers on the --z scale', token: /var\(--z-/g },
  { id: 'blur', name: 'Blurred surfaces (backdrop-filter rules)', token: null },
  { id: 'jsColour', name: 'Colours in game JS', token: null },
  { id: 'innerHtml', name: 'innerHTML writes in game JS', token: null },
  { id: 'styleAttr', name: 'style="..." strings in game JS', token: null },
];

const count = (s, re) => (re ? (s.match(re) || []).length : 0);
export const stripCss = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
// block comments, then line comments that don't follow a ':' (keeps https://)
export const stripJs = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');

/** declarations outside custom property definitions: [{prop, value}] */
function declarations(css) {
  const out = [];
  for (const m of css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    if (m[1].startsWith('--')) continue;
    out.push({ prop: m[1].toLowerCase(), value: m[2] });
  }
  return out;
}

/** one CSS file's counts: {ruleId: {raw, token}} */
export function lintCss(text, file = '') {
  const css = stripCss(text);
  const r = Object.fromEntries(UI_LINT_RULES.map(x => [x.id, { raw: 0, token: 0 }]));
  for (const { prop, value } of declarations(css)) {
    const v = value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' '); // what's left once vars are taken out
    if (/radius$/.test(prop)) r.radius.raw += (v.match(LENGTH) || []).filter(n => parseFloat(n) !== 0).length;
    if (/^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(prop))
      r.space.raw += (v.match(LENGTH) || []).filter(n => parseFloat(n) !== 0).length;
    if (prop === 'box-shadow' && !/^\s*(none|inherit|initial|unset)?\s*$/.test(v.replace(/,/g, ''))) r.shadow.raw++;
    if (/^(transition|animation)(-duration|-delay)?$/.test(prop)) r.duration.raw += count(v, /\b\d*\.?\d+m?s\b/g);
    if (prop === 'font-family' || prop === 'font')
      if (/['"]|\b(monospace|sans-serif|serif|cursive)\b/.test(v)) r.font.raw++;
    r.colour.raw += count(v, COLOUR);
    if (prop === 'z-index' && /-?\d/.test(v)) r.zindex.raw++;
  }
  for (const x of UI_LINT_RULES) if (x.token) r[x.id].token += count(css, x.token);
  const frames = count(css, /@keyframes\s/g);
  if (file.endsWith('motion.css')) r.keyframes.token = frames;
  else r.keyframes.raw = frames;
  r.important.raw = count(css, /!important/g);
  // one per rule block that blurs (-webkit- and plain on the same rule are one surface)
  r.blur.raw = (css.match(/\{[^{}]*\}/g) || []).filter(b => /backdrop-filter\s*:(?!\s*none)/.test(b)).length;
  return r;
}

/** one JS file's counts */
export function lintJs(text) {
  const js = stripJs(text);
  return {
    jsColour: { raw: count(js, /['"`(\s,:]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g), token: 0 },
    innerHtml: { raw: count(js, /\.innerHTML\s*\+?=(?!=)/g), token: 0 },
    styleAttr: { raw: count(js, /style="/g), token: 0 },
  };
}

const walk = (dir, ext) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === 'vendor' ? [] : walk(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });

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
  for (const f of walk(join(root, 'game/css'), '.css')) add(relative(root, f), lintCss(readFileSync(f, 'utf8'), f));
  for (const f of walk(join(root, 'game/js'), '.js')) {
    if (f.endsWith('hooks.js')) continue; // generated
    add(relative(root, f), lintJs(readFileSync(f, 'utf8')));
  }
  return total;
}

export function report(total) {
  const rows = UI_LINT_RULES.map(x => {
    const t = total[x.id];
    const worst = Object.entries(t.files)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([f, n]) => `${f.replace(/^game\/(css|js)\//, '')} ${n}`)
      .join(', ');
    return `| ${x.name} | ${t.raw} | ${x.token ? t.token : x.id === 'keyframes' ? `${t.token} in motion.css` : '-'} | ${worst} |`;
  });
  return ['| Rule | Raw | Token uses | Worst files |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const total = lintGame();
  console.log(process.argv.includes('--json') ? JSON.stringify(total, null, 1) : report(total));
}
