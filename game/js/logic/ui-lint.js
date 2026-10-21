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
  LENGTH: [() => LENGTH],
  UI_LINT_RULES: [() => UI_LINT_RULES],
  count: [() => count],
  // @ts-expect-error -- replaced on purpose
  declarations: [() => declarations, v => (declarations = v)],
  // @ts-expect-error -- replaced on purpose
  lintCss: [() => lintCss, v => (lintCss = v)],
  // @ts-expect-error -- replaced on purpose
  lintJs: [() => lintJs, v => (lintJs = v)],
  // @ts-expect-error -- replaced on purpose
  report: [() => report, v => (report = v)],
  stripCss: [() => stripCss],
  stripJs: [() => stripJs],
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
export const stripCss = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
// block comments, then line comments that don't follow a ':' (keeps https://)
export const stripJs = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');

/** declarations outside custom property definitions: [{prop, value}] */
export function declarations(css) {
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
