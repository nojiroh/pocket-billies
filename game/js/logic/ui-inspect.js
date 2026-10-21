// @ts-check
'use strict';
/* ================= UI INSPECT (UI track, UI-3b) =================
   The string and colour work behind the Studio's inspect and overlays (studio/js/ui-inspect.js, ui-overlays.js),
   which read the preview frame's style sheets and boxes: the variables a rule reads, a selector made matchable (its
   pseudo-element taken off, a shadow root's :host turned into a selector for the host), and the overlays' rules (a
   tap target under 44 px, text under its contrast on the layers behind it, glass stacked more than two deep). Logic
   only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { contrastRatio, hexRgb, rgbHex } from './colors.js';
/* eslint-disable no-func-assign */
expose({
  COLOUR_IN: [() => COLOUR_IN],
  UI_BLUR_BUDGET: [() => UI_BLUR_BUDGET],
  UI_GLASS_STACK: [() => UI_GLASS_STACK],
  UI_TAP_MIN: [() => UI_TAP_MIN],
  // @ts-expect-error -- replaced on purpose
  backgroundLayerColours: [() => backgroundLayerColours, v => (backgroundLayerColours = v)],
  // @ts-expect-error -- replaced on purpose
  blendOver: [() => blendOver, v => (blendOver = v)],
  // @ts-expect-error -- replaced on purpose
  cssVarNames: [() => cssVarNames, v => (cssVarNames = v)],
  // @ts-expect-error -- replaced on purpose
  gradientColoursUnder: [() => gradientColoursUnder, v => (gradientColoursUnder = v)],
  // @ts-expect-error -- replaced on purpose
  hostSelector: [() => hostSelector, v => (hostSelector = v)],
  // @ts-expect-error -- replaced on purpose
  matchableSelector: [() => matchableSelector, v => (matchableSelector = v)],
  // @ts-expect-error -- replaced on purpose
  parseCssColour: [() => parseCssColour, v => (parseCssColour = v)],
  parseCssColours: [() => parseCssColours],
  // @ts-expect-error -- replaced on purpose
  parseLinearGradient: [() => parseLinearGradient, v => (parseLinearGradient = v)],
  rgb3: [() => rgb3],
  // @ts-expect-error -- replaced on purpose
  splitSelectors: [() => splitSelectors, v => (splitSelectors = v)],
  uiGlassTooDeep: [() => uiGlassTooDeep],
  // @ts-expect-error -- replaced on purpose
  uiLayeredContrast: [() => uiLayeredContrast, v => (uiLayeredContrast = v)],
  uiTapTooSmall: [() => uiTapTooSmall],
  uiTextMin: [() => uiTextMin],
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

/* ---- the overlays (UI-3b): tap targets, contrast, glass ---- */
/** three channels from a function of the channel's index @param {(i: number) => number} f */
export const rgb3 = f => /** @type {[number, number, number]} */ ([f(0), f(1), f(2)]);
/** a tap target's smallest side (WCAG 2.5.5, Apple and Material's 44 px) */
export const UI_TAP_MIN = 44;
/** glass layers on top of each other that are still fine (ui-track.md: more than two is an overlay) */
export const UI_GLASS_STACK = 2;
/** blurred surfaces a screen may have (ui-track.md, the blur budget) */
export const UI_BLUR_BUDGET = 3;

/** is a box too small to tap? (either side under the minimum; an empty box is not a target)
 * @param {{width: number, height: number}} r */
export const uiTapTooSmall = r => r.width > 0 && r.height > 0 && (r.width < UI_TAP_MIN || r.height < UI_TAP_MIN);

/** a CSS colour as #rrggbb and its alpha (0..1), from rgb()/rgba(), color(srgb ...) or hex; null when it can't be
 * read @param {string} c @returns {{hex: string, a: number} | null} */
export function parseCssColour(c) {
  const s = String(c || '').trim(),
    alpha = (/** @type {string | undefined} */ x) => (x == null ? 1 : x.endsWith('%') ? parseFloat(x) / 100 : +x),
    hex2 = (/** @type {number} */ n) =>
      Math.round(Math.min(255, Math.max(0, n)))
        .toString(16)
        .padStart(2, '0');
  let m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (m) return { hex: '#' + [m[1], m[2], m[3]].map(x => hex2(+x)).join(''), a: alpha(m[4]) };
  m = s.match(/^color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (m) return { hex: '#' + [m[1], m[2], m[3]].map(x => hex2(+x * 255)).join(''), a: alpha(m[4]) };
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return { hex: '#' + m[1].toLowerCase(), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  return null;
}
export const COLOUR_IN = /rgba?\([^()]*\)|color\(\s*srgb[^()]*\)|#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/gi;
/** every colour in a value (a gradient's stops) @param {string} v */
export const parseCssColours = v =>
  /** @type {{hex: string, a: number}[]} */ (
    (String(v || '').match(COLOUR_IN) || []).map(parseCssColour).filter(Boolean)
  );

/** a linear-gradient() as its angle (deg, 180 = top to bottom) and stops ({c, at}: at a fraction, px or null);
 * null for anything else @param {string} v */
export function parseLinearGradient(v) {
  const m = String(v || '')
    .trim()
    .match(/^(?:repeating-)?linear-gradient\((.*)\)$/i);
  if (!m || /^repeating/i.test(v.trim())) return null;
  const parts = splitSelectors(m[1]);
  let angle = 180;
  const sides = { top: 0, right: 90, bottom: 180, left: 270 };
  if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(/** @type {string} */ (parts.shift()));
  else if (/^-?[\d.]+turn$/.test(parts[0])) angle = parseFloat(/** @type {string} */ (parts.shift())) * 360;
  else if (/^to /.test(parts[0])) {
    const w = /** @type {string} */ (parts.shift()).slice(3).split(/\s+/);
    if (w.length === 1) angle = sides[/** @type {keyof typeof sides} */ (w[0])] ?? 180;
    else return null; // a corner: leave it to the stops
  }
  /** @type {{c: {hex: string, a: number}, at: number | null, px: boolean}[]} */
  const stops = [];
  for (const p of parts) {
    const c = (p.match(COLOUR_IN) || [])[0],
      col = c && parseCssColour(c);
    if (!col) continue;
    const pos = p
      .replace(/** @type {string} */ (c), '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!pos.length) stops.push({ c: col, at: null, px: false });
    for (const x of pos) stops.push({ c: col, at: parseFloat(x) / (x.endsWith('%') ? 100 : 1), px: x.endsWith('px') });
  }
  return stops.length ? { angle, stops } : null;
}

/** the colours a linear gradient has under a part of its box: box {w, h}; area {x0, y0, x1, y1} inside it
 * @param {{angle: number, stops: {c: {hex: string, a: number}, at: number | null, px: boolean}[]}} g
 * @param {{w: number, h: number}} box @param {{x0: number, y0: number, x1: number, y1: number}} area */
export function gradientColoursUnder(g, box, area) {
  const th = (g.angle * Math.PI) / 180,
    dx = Math.sin(th),
    dy = -Math.cos(th),
    L = Math.abs(box.w * dx) + Math.abs(box.h * dy) || 1,
    t = (/** @type {number} */ x, /** @type {number} */ y) => ((x - box.w / 2) * dx + (y - box.h / 2) * dy) / L + 0.5;
  // where each stop sits on the line (0..1): px over the line's length, missing ones spread between their neighbours
  const at = g.stops.map(s => (s.at == null ? null : s.px ? s.at / L : s.at));
  if (at[0] == null) at[0] = 0;
  if (at[at.length - 1] == null) at[at.length - 1] = 1;
  for (let i = 1; i < at.length; i++) {
    const prev = /** @type {number} */ (at[i - 1]);
    if (at[i] == null) {
      let j = i;
      while (at[j] == null) j++;
      const next = /** @type {number} */ (at[j]);
      for (let k = i; k < j; k++) at[k] = prev + ((next - prev) * (k - i + 1)) / (j - i + 1);
    }
    at[i] = Math.max(/** @type {number} */ (at[i]), prev);
  }
  const ts = [t(area.x0, area.y0), t(area.x1, area.y0), t(area.x0, area.y1), t(area.x1, area.y1)],
    lo = Math.min(...ts),
    hi = Math.max(...ts),
    pos = /** @type {number[]} */ (at);
  /** the colour at a place on the line */
  const colourAt = (/** @type {number} */ x) => {
    if (x <= pos[0]) return g.stops[0].c;
    for (let i = 1; i < pos.length; i++)
      if (x <= pos[i]) {
        const a = g.stops[i - 1].c,
          b = g.stops[i].c,
          f = pos[i] > pos[i - 1] ? (x - pos[i - 1]) / (pos[i] - pos[i - 1]) : 1,
          ra = hexRgb(a.hex),
          rb = hexRgb(b.hex);
        return { hex: rgbHex(rgb3(k => Math.round(ra[k] + (rb[k] - ra[k]) * f))), a: a.a + (b.a - a.a) * f };
      }
    return g.stops[g.stops.length - 1].c;
  };
  return [colourAt(lo), colourAt(hi), ...g.stops.filter((s, i) => pos[i] > lo && pos[i] < hi).map(s => s.c)];
}

/** one background layer (a background-image entry) as the colours under an area: a linear gradient where the area
 * is, another gradient by every stop, none ([]) for none, null for an image (can't tell)
 * @param {string} layer @param {{w: number, h: number}} box @param {{x0: number, y0: number, x1: number, y1: number}} area */
export function backgroundLayerColours(layer, box, area) {
  const v = String(layer || '').trim();
  if (!v || v === 'none') return [];
  if (/url\(|image-set\(|element\(|cross-fade\(/i.test(v)) return null;
  const g = parseLinearGradient(v);
  return g ? gradientColoursUnder(g, box, area) : parseCssColours(v);
}

/** one colour laid over another; the result is as opaque as the two together
 * @param {{hex: string, a: number}} top @param {{hex: string, a: number}} below */
export function blendOver(top, below) {
  const a = top.a + below.a * (1 - top.a);
  if (!a) return { hex: below.hex, a: 0 };
  const t = hexRgb(top.hex),
    b = hexRgb(below.hex);
  return {
    hex: rgbHex(rgb3(i => Math.round((t[i] * top.a + b[i] * below.a * (1 - top.a)) / a))),
    a,
  };
}

/** a text colour's contrast on what is behind it: layers from the nearest down, each a list of colours (one for a
 * plain fill, a gradient's stops), stopping at the first opaque one; the worst ratio over every stop, or null when
 * nothing opaque is reached (an image, or glass over nothing known)
 * @param {{hex: string, a: number}} fg @param {{hex: string, a: number}[][]} layers */
export function uiLayeredContrast(fg, layers) {
  /** @type {{hex: string, a: number}[]} */
  let bgs = [{ hex: '#000000', a: 0 }];
  for (const L of layers) {
    if (!L.length) continue;
    // what is above so far goes over each colour of this layer (the stops of a gradient give several)
    bgs = bgs.flatMap(top => L.map(c => blendOver(top, c)));
    if (bgs.every(b => b.a >= 0.999)) {
      let worst = Infinity;
      for (const b of bgs) {
        const f = hexRgb(fg.hex),
          k = hexRgb(b.hex),
          under = rgbHex(rgb3(i => Math.round(f[i] * fg.a + k[i] * (1 - fg.a))));
        worst = Math.min(worst, contrastRatio(under, b.hex));
      }
      return Math.round(worst * 100) / 100;
    }
  }
  return null;
}

/** the minimum a text needs (WCAG AA: 4.5:1, or 3:1 for large text: 24 px, or 18.66 px bold)
 * @param {number} px @param {number} weight */
export const uiTextMin = (px, weight) => (px >= 24 || (px >= 18.66 && weight >= 700) ? 3 : 4.5);

/** glass stacked too deep: depth counts the blurred surface itself and those under it @param {number} depth */
export const uiGlassTooDeep = depth => depth > UI_GLASS_STACK;
