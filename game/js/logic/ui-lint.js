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
  UI_LINT_RULES: [() => UI_LINT_RULES],
  blank: [() => blank],
  count: [() => count],
  // @ts-expect-error -- replaced on purpose
  declarations: [() => declarations, v => (declarations = v)],
  // @ts-expect-error -- replaced on purpose
  findingsOf: [() => findingsOf, v => (findingsOf = v)],
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
  uiLintFindings: [() => uiLintFindings, v => (uiLintFindings = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
export const LENGTH = /(?<![\w.#-])-?\d*\.?\d+(?:px|rem|em)\b/g;

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
  for (const { prop, value, at } of declarations(css)) {
    // what's left once vars are taken out (each var as spaces, so places hold)
    const v = value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, blank);
    const lengths = () => [...v.matchAll(LENGTH)].filter(m => parseFloat(m[0]) !== 0).map(m => at + m.index);
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
