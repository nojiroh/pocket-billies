'use strict';
/* ================= UI BITS ================= */
/* UI-5: the small pieces many screens draw (type and status pills, bars), moved from ui.js as they were */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { clamp } from './util.js';
import { STATUS_NAMES, TYPE_COLORS } from './game-data.js';
import { readableBg } from './logic/colors.js';
import { typeGlyphHTML } from './ui-kit.js';
/* eslint-disable no-func-assign */
expose({
  PILL_COLORS: [() => PILL_COLORS],
  hpBar: [() => hpBar, v => (hpBar = v)],
  pillColor: [() => pillColor],
  progressBarHTML: [() => progressBarHTML, v => ((progressBarHTML = v), provide({ progressBarHTML }))],
  statusBadgeHTML: [() => statusBadgeHTML],
  typeBadgeHTML: [() => typeBadgeHTML],
});
/* eslint-enable no-func-assign */
provide({ progressBarHTML });
/* to-module: end */
/* phase 06-4: the pill's colour is the type's, deepened just enough for its label to read at 4.5:1 (logic/colors.js) */
const PILL_COLORS = {};
const pillColor = t => (PILL_COLORS[t] = PILL_COLORS[t] || readableBg(TYPE_COLORS[t][0], TYPE_COLORS[t][1]));
export const typeBadgeHTML = t =>
  `<span class="chip" style="--tc:${pillColor(t)};--tf:${TYPE_COLORS[t][1]}">${typeGlyphHTML(t)}${t === 'None' ? 'Normal' : t}</span>`;
provide({ typeBadgeHTML }); /* to-module */
export const statusBadgeHTML = st => (st ? `<span class="stb st-${st}">${STATUS_NAMES[st]}</span>` : '');
provide({ statusBadgeHTML }); /* to-module */
export function progressBarHTML(p, cls = '') {
  return `<div class="pbar ${cls}"><i style="width:${clamp(p, 0, 1) * 100}%"></i></div>`;
}
export function hpBar(hp, max) {
  const p = Math.max(0, hp / max);
  return `<div class="pbar hpb ${p < 0.25 ? 'low' : p < 0.5 ? 'mid' : ''}"><i style="width:${p * 100}%"></i></div>`;
}
