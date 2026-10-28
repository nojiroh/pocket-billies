// @ts-check
'use strict';
/* ================= UI LINT (UI track, UI-1; moved here from tools/ui-lint.mjs in UI-3b) =================
   The raw values that break the UI rules (docs/phases/06-plan.md, game/css/tokens.css), counted per rule next to
   the token uses that follow them. Patterns on comment-stripped text, not a CSS parser: treat the counts as within
   a few percent. Custom property definitions (--x: ...) are where tokens get their values, so they are not counted
   as raw. Logic only: no DOM, runs in Node (tools/ui-lint.mjs walks the files) and in the Studio. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  COLOUR: [() => COLOUR],
  JS_RULES: [() => JS_RULES],
  LENGTH: [() => LENGTH],
  UI_LINT_CEILING: [() => UI_LINT_CEILING],
  UI_LINT_EXTRA: [() => UI_LINT_EXTRA],
  UI_LINT_PAGES: [() => UI_LINT_PAGES],
  UI_LINT_RULES: [() => UI_LINT_RULES],
  blank: [() => blank],
  count: [() => count],
  // @ts-expect-error -- replaced on purpose
  declarations: [() => declarations, v => (declarations = v)],
  // @ts-expect-error -- replaced on purpose
  findingsOf: [() => findingsOf, v => (findingsOf = v)],
  folderOfPath: [() => folderOfPath],
  hairline: [() => hairline],
  // @ts-expect-error -- replaced on purpose
  joinPath: [() => joinPath, v => (joinPath = v)],
  // @ts-expect-error -- replaced on purpose
  lineAt: [() => lineAt, v => (lineAt = v)],
  lintCss: [() => lintCss],
  // @ts-expect-error -- replaced on purpose
  lintCssAll: [() => lintCssAll, v => (lintCssAll = v)],
  lintJs: [() => lintJs],
  // @ts-expect-error -- replaced on purpose
  lintJsAll: [() => lintJsAll, v => (lintJsAll = v)],
  places: [() => places],
  // @ts-expect-error -- replaced on purpose
  report: [() => report, v => (report = v)],
  stripCss: [() => stripCss],
  stripJs: [() => stripJs],
  // @ts-expect-error -- replaced on purpose
  uiLintCrawl: [() => uiLintCrawl, v => (uiLintCrawl = v)],
  // @ts-expect-error -- replaced on purpose
  uiLintFindings: [() => uiLintFindings, v => (uiLintFindings = v)],
  // @ts-expect-error -- replaced on purpose
  uiLintImports: [() => uiLintImports, v => (uiLintImports = v)],
  // @ts-expect-error -- replaced on purpose
  uiLintPageFiles: [() => uiLintPageFiles, v => (uiLintPageFiles = v)],
  // @ts-expect-error -- replaced on purpose
  uiLintRatchet: [() => uiLintRatchet, v => (uiLintRatchet = v)],
  uiLintReads: [() => uiLintReads],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
export const LENGTH = /(?<![\w.#-])-?\d*\.?\d+(?:px|rem|em)\b/g;
/* UI-9b: 0, and 1-2 px (a hairline: an edge, a nudge), are not off the space or radius scale */
export const hairline = (/** @type {string} */ len) => {
  const n = Math.abs(parseFloat(len));
  return n === 0 || (/px$/.test(len) && n <= 2);
};

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

/* UI-6: the ratchet. The most raw values each rule may have in the whole game (game CSS and JS, as lintGame counts
   them). A rise fails `npm run lint` and the Studio's Check; a fall is kept by `node tools/ui-lint.mjs --save`, which
   rewrites this block. Totals, not per file: moving a rule from one sheet to another changes nothing here.
   jsColour rose by 47 in SA-2b, on purpose: the UI icons' palette (logic/icon-block.js), art colours that moved in
   from tools/build-ui-icons.py when the SVG files became the source. */
// ceiling: start
export const UI_LINT_CEILING = {
  radius: 0,
  space: 39,
  shadow: 160,
  keyframes: 51,
  duration: 242,
  font: 10,
  colour: 576,
  important: 153,
  zindex: 59,
  blur: 24,
  jsColour: 634,
  innerHtml: 54,
  styleAttr: 41,
};
// ceiling: end

/** the rules over or under their ceiling: raw is {ruleId: count} */
export function uiLintRatchet(/** @type {Record<string, number>} */ raw, ceiling = UI_LINT_CEILING) {
  const over = [],
    under = [];
  for (const { id } of UI_LINT_RULES) {
    const n = raw[id] || 0,
      max = /** @type {Record<string, number>} */ (ceiling)[id] ?? 0;
    if (n > max) over.push({ id, raw: n, max });
    else if (n < max) under.push({ id, raw: n, max });
  }
  return { over, under };
}

export const count = (s, re) => (re ? (s.match(re) || []).length : 0);
// UI-3b: a comment becomes spaces (its line breaks kept), so a place in the stripped text is the same place in the file
export const blank = (/** @type {string} */ c) => c.replace(/[^\n]/g, ' ');
export const stripCss = (/** @type {string} */ s) => s.replace(/\/\*[\s\S]*?\*\//g, blank);
// block comments, then line comments that don't follow a ':' (keeps https://)
export const stripJs = (/** @type {string} */ s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:\\'"`])(\/\/.*)$/gm, (m, a, c) => a + blank(c));

/** declarations outside custom property definitions: [{prop, value, at}] (at: where the value starts) */
export function declarations(css) {
  const out = [];
  for (const m of css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    if (m[1].startsWith('--')) continue;
    out.push({ prop: m[1].toLowerCase(), value: m[2], at: m.index + m[0].length - m[2].length });
  }
  return out;
}

/** UI-3b: the line (from 1) of each place in a text: (at) => line */
export function lineAt(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return (/** @type {number} */ at) => {
    let lo = 0,
      hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= at) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** @typedef {{rule: string, file: string, line: number, text: string}} UiLintFinding */

/** each match of re in s: its place */
export const places = (s, re) => [...s.matchAll(re)].map(m => /** @type {number} */ (m.index));

/** one CSS file: its counts ({ruleId: {raw, token}}) and a finding for every raw value */
export function lintCssAll(text, file = '') {
  const css = stripCss(text);
  const r = Object.fromEntries(UI_LINT_RULES.map(x => [x.id, { raw: 0, token: 0 }]));
  /** @type {[string, number][]} */
  const raw = [];
  const add = (rule, at) => raw.push([rule, at]);
  // UI-6b: an @font-face block names the family it defines, so its font-family is not a raw font
  for (const { prop, value, at } of declarations(css.replace(/@font-face\s*\{[^{}]*\}/g, blank))) {
    // what's left once vars are taken out (each var as spaces, so places hold)
    const v = value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, blank);
    const lengths = () => [...v.matchAll(LENGTH)].filter(m => !hairline(m[0])).map(m => at + m.index);
    if (/radius$/.test(prop)) lengths().forEach(i => add('radius', i));
    if (/^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(prop)) lengths().forEach(i => add('space', i));
    if (prop === 'box-shadow' && !/^\s*(none|inherit|initial|unset)?\s*$/.test(v.replace(/,/g, ''))) add('shadow', at);
    if (/^(transition|animation)(-duration|-delay)?$/.test(prop))
      places(v, /\b\d*\.?\d+m?s\b/g).forEach(i => add('duration', at + i));
    if (prop === 'font-family' || prop === 'font')
      if (/['"]|\b(monospace|sans-serif|serif|cursive)\b/.test(v)) add('font', at);
    places(v, COLOUR).forEach(i => add('colour', at + i));
    if (prop === 'z-index' && /-?\d/.test(v)) add('zindex', at);
  }
  for (const x of UI_LINT_RULES) if (x.token) r[x.id].token += count(css, x.token);
  const frames = places(css, /@keyframes\s/g);
  if (file.endsWith('motion.css')) r.keyframes.token = frames.length;
  else frames.forEach(i => add('keyframes', i));
  places(css, /!important/g).forEach(i => add('important', i));
  // one per rule block that blurs (-webkit- and plain on the same rule are one surface)
  for (const b of css.matchAll(/\{[^{}]*\}/g)) {
    const m = b[0].match(/backdrop-filter\s*:(?!\s*none)/);
    if (m) add('blur', /** @type {number} */ (b.index) + /** @type {number} */ (m.index));
  }
  for (const [rule] of raw) r[rule].raw++;
  return { counts: r, found: findingsOf(text, file, raw) };
}

/** [rule, place] pairs as findings with their line and the line's text */
export function findingsOf(text, file, raw) {
  const line = lineAt(text),
    lines = text.split('\n');
  return raw
    .map(([rule, at]) => {
      const n = line(at);
      return { rule, file, line: n, text: lines[n - 1].trim().slice(0, 200) };
    })
    .sort((a, b) => a.line - b.line);
}

/** one CSS file's counts: {ruleId: {raw, token}} */
export const lintCss = (text, file = '') => lintCssAll(text, file).counts;

export const JS_RULES = /** @type {[string, RegExp][]} */ ([
  ['jsColour', /['"`(\s,:]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g],
  ['innerHtml', /\.innerHTML\s*\+?=(?!=)/g],
  ['styleAttr', /style="/g],
]);

/** one JS file: its counts and a finding for every raw value */
export function lintJsAll(text, file = '') {
  const js = stripJs(text);
  /** @type {[string, number][]} */
  const raw = JS_RULES.flatMap(([rule, re]) => places(js, re).map(i => /** @type {[string, number]} */ ([rule, i])));
  const counts = Object.fromEntries(JS_RULES.map(([rule]) => [rule, { raw: 0, token: 0 }]));
  for (const [rule] of raw) counts[rule].raw++;
  return { counts, found: findingsOf(text, file, raw) };
}

/** one JS file's counts */
export const lintJs = (text, file = '') => lintJsAll(text, file).counts;

/** UI-3b: every raw value in one file (CSS or JS, by its name), with its line: [{rule, file, line, text}] */
export function uiLintFindings(text, file) {
  return (/\.css$/.test(file) ? lintCssAll(text, file) : lintJsAll(text, file)).found;
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

/* UI-3b: the files the lint reads, found the way a browser can (the Studio has no folder listing): the pages'
   style sheets and scripts under game/, and every module they import, followed. tools/test/ui-lint.test.mjs keeps
   this list equal to what tools/ui-lint.mjs walks. */
export const UI_LINT_PAGES = ['game/index.html', 'studio/index.html', 'studio/gallery.html'];
// loaded by a URL made at run time (settings-screen.js; the Studio's logic worker, logic-client.js), so no import
// names it
export const UI_LINT_EXTRA = ['game/js/graphics-test.js', 'studio/js/logic-worker.js'];

/** a path relative to the repository: dir + a relative URL (./, ../) */
export function joinPath(dir, rel) {
  const out = dir ? dir.split('/') : [];
  for (const p of rel.split('/')) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}
export const folderOfPath = (/** @type {string} */ f) => f.slice(0, Math.max(0, f.lastIndexOf('/')));

/** the style sheets and scripts a page names (paths from the repository's root) */
export function uiLintPageFiles(page, html) {
  const out = [];
  for (const m of html.matchAll(/<(?:link\b[^>]*\brel="stylesheet"[^>]*\bhref|script\b[^>]*\bsrc)="([^"?#]+)/g))
    if (!m[1].includes('://')) out.push(joinPath(folderOfPath(page), m[1]));
  return out;
}

/** the modules a script imports (static imports and import('...') with a plain string) */
export function uiLintImports(file, text) {
  const out = [];
  for (const m of stripJs(text).matchAll(
    /\b(?:import|export)\s[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm
  )) {
    const rel = m[1] || m[2] || m[3];
    if (rel.startsWith('.')) out.push(joinPath(folderOfPath(file), rel));
  }
  return out;
}

/** does the lint read this file? (game CSS and JS; not the generated hooks.js, not the rules' own file) */
export const uiLintReads = (/** @type {string} */ f) =>
  (/^game\/css\/.+\.css$/.test(f) || /^game\/js\/.+\.js$/.test(f)) &&
  !/\/vendor\//.test(f) &&
  !f.endsWith('/hooks.js') &&
  !f.endsWith('logic/ui-lint.js') &&
  /* LD-4: the run's helper thread is on no page and draws nothing; LD-5: nor the world map's (bowl-worker.js) */
  !/\/(run|bowl)-worker(-modules)?\.js$/.test(f);

/** every file the lint reads, by following the pages: read(path) gives a file's text (fetch or fs) */
export async function uiLintCrawl(/** @type {(path: string) => Promise<string>} */ read) {
  const seen = new Set(),
    queue = [];
  const take = f => {
    if (!seen.has(f) && (f.endsWith('.css') || f.endsWith('.js'))) {
      seen.add(f);
      queue.push(f);
    }
  };
  for (const page of UI_LINT_PAGES) uiLintPageFiles(page, await read(page)).forEach(take);
  UI_LINT_EXTRA.forEach(take);
  while (queue.length) {
    const f = queue.shift();
    // the Studio's own modules are followed (they import game modules) but not read by the lint
    if (f.endsWith('.js') && (uiLintReads(f) || f.startsWith('studio/'))) uiLintImports(f, await read(f)).forEach(take);
  }
  return [...seen].filter(uiLintReads).sort();
}
