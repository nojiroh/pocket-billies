// @ts-check
'use strict';
/* ================= UI INSPECT (UI track, UI-3b) =================
   The string work behind the Studio's inspect (studio/js/ui-inspect.js), which reads the preview frame's style
   sheets: the variables a rule reads, a selector made matchable (its pseudo-element taken off, a shadow root's :host
   turned into a selector for the host). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  cssVarNames: [() => cssVarNames, v => (cssVarNames = v)],
  // @ts-expect-error -- replaced on purpose
  hostSelector: [() => hostSelector, v => (hostSelector = v)],
  // @ts-expect-error -- replaced on purpose
  matchableSelector: [() => matchableSelector, v => (matchableSelector = v)],
  // @ts-expect-error -- replaced on purpose
  splitSelectors: [() => splitSelectors, v => (splitSelectors = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the custom properties a declaration text reads, in order, each once (fallbacks inside var() included)
 * @param {string} text */
export function cssVarNames(text) {
  return [...new Set([...String(text).matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]))];
}

/** a selector list split at its top-level commas @param {string} sel */
export function splitSelectors(sel) {
  const out = [];
  let depth = 0,
    cur = '';
  for (const c of String(sel)) {
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === ',' && !depth) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** one selector as Element.matches takes it: its pseudo-element (::before, :after...) taken off and named
 * @param {string} sel @returns {{sel: string, pseudo: string}} */
export function matchableSelector(sel) {
  const m = String(sel).match(/::?(before|after|placeholder|marker|selection|backdrop)\s*$/i);
  const rest = m ? sel.slice(0, m.index).trim() : sel.trim();
  return { sel: rest || '*', pseudo: m ? '::' + m[1].toLowerCase() : '' };
}

/** a selector from inside a shadow root, for its host: ':host' -> '*', ':host([a])' -> '[a]'; null when it is about
 * something inside the shadow root, not the host itself @param {string} sel */
export function hostSelector(sel) {
  const { sel: s } = matchableSelector(sel);
  if (s === ':host') return '*';
  const m = s.match(/^:host\((.*)\)$/);
  return m ? m[1] : null;
}
