// @ts-check
'use strict';
/* ================= UI THEME (UI-1) =================
   game/data/uiTheme.json as one style sheet: the colour roles, the glass, the cut sizes and the fonts (UI-3 adds the
   depths, the drop shadows, the spacing scale, the text sizes and the motion; their defaults are tokens.css's). The page writes
   it into <style id="ui-theme"> after every stylesheet (theme-sheet.js), with the same three selectors the CSS uses
   (light on :root, dark from the system unless Settings says light, dark from Settings), so Settings' theme switch
   keeps working. Each role also sets the older variable names the screens still read (--text, --bg, --panel-s,
   --g-solid, --gold, --red, --ok...), so the palette reaches every rule that uses a variable; raw colours in the rules
   stay until UI-5/6. Without the data the page keeps tokens.css and the older sheets as they are. Logic only: no
   DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { contrastRatio, hexRgb, luminance, rgbHex } from './colors.js';
import {
  UI_SIGNALS,
  UI_SIGNAL_MIN,
  UI_SIGNAL_SETS,
  oklab,
  oklabDistance,
  signalSetColours,
  signalVars,
} from './signals.js';
import { styleVarsCss } from './style-dials.js';
/* eslint-disable no-func-assign */
expose({
  RING: [() => RING],
  UI_CONTRAST: [() => UI_CONTRAST],
  UI_DERIVED: [() => UI_DERIVED],
  UI_FONTS: [() => UI_FONTS],
  UI_FROM_SIGNALS: [() => UI_FROM_SIGNALS],
  UI_ROLES: [() => UI_ROLES],
  UI_SCREENS: [() => UI_SCREENS],
  UI_SHAPE_DEFAULTS: [() => UI_SHAPE_DEFAULTS],
  UI_SHAPE_FAMILIES: [() => UI_SHAPE_FAMILIES],
  UI_TYPE_SIZES: [() => UI_TYPE_SIZES],
  bubbleTail: [() => bubbleTail],
  coord: [() => coord],
  // @ts-expect-error -- replaced on purpose
  cornerTL: [() => cornerTL, v => (cornerTL = v)],
  // @ts-expect-error -- replaced on purpose
  cssColour: [() => cssColour, v => (cssColour = v)],
  // @ts-expect-error -- replaced on purpose
  mergeLook: [() => mergeLook, v => (mergeLook = v)],
  // @ts-expect-error -- replaced on purpose
  modeVars: [() => modeVars, v => (modeVars = v)],
  // @ts-expect-error -- replaced on purpose
  overrideCss: [() => overrideCss, v => (overrideCss = v)],
  // @ts-expect-error -- replaced on purpose
  paletteFor: [() => paletteFor, v => (paletteFor = v)],
  plain: [() => plain],
  ptsText: [() => ptsText],
  roleVar: [() => roleVar],
  roundTo2: [() => roundTo2],
  screenLook: [() => screenLook],
  screenSel: [() => screenSel],
  // @ts-expect-error -- replaced on purpose
  shapeDecls: [() => shapeDecls, v => (shapeDecls = v)],
  // @ts-expect-error -- replaced on purpose
  shapeLines: [() => shapeLines, v => (shapeLines = v)],
  // @ts-expect-error -- replaced on purpose
  shapePoints: [() => shapePoints, v => (shapePoints = v)],
  // @ts-expect-error -- replaced on purpose
  shapeVars: [() => shapeVars, v => (shapeVars = v)],
  // @ts-expect-error -- replaced on purpose
  sharedVars: [() => sharedVars, v => (sharedVars = v)],
  // @ts-expect-error -- replaced on purpose
  solidOver: [() => solidOver, v => (solidOver = v)],
  // @ts-expect-error -- replaced on purpose
  uiPalettes: [() => uiPalettes, v => (uiPalettes = v)],
  uiPlayerLook: [() => uiPlayerLook],
  uiRatio: [() => uiRatio],
  // @ts-expect-error -- replaced on purpose
  uiSignalProblems: [() => uiSignalProblems, v => (uiSignalProblems = v)],
  // @ts-expect-error -- replaced on purpose
  uiThemeContrast: [() => uiThemeContrast, v => (uiThemeContrast = v)],
  // @ts-expect-error -- replaced on purpose
  uiThemeCss: [() => uiThemeCss, v => (uiThemeCss = v)],
  // @ts-expect-error -- replaced on purpose
  uiThemeLook: [() => uiThemeLook, v => (uiThemeLook = v)],
  withAlpha: [() => withAlpha],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the roles a palette names, and the older variables each one also sets */
export const UI_ROLES = {
  ground: ['--bg'],
  surface: ['--panel-s', '--g-solid'],
  text: ['--text'],
  text2: ['--text2'],
  line: ['--line'],
  primary: ['--ok'],
  goldA: ['--gold-a'],
  goldB: ['--gold-b', '--gold'],
  danger: ['--red'],
  hpOk: [],
  hpMid: [],
  hpLow: [],
  mapGrass: [],
  mapWater: [],
};
/** goldA -> --c-gold-a */
export const roleVar = (/** @type {string} */ r) => '--c-' + r.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

/** #rrggbb or #rrggbbaa (or #rgb) as a CSS colour; an alpha byte becomes rgba() so older browsers read it
 * @param {string} hex */
export function cssColour(hex) {
  const h = String(hex).replace('#', '');
  if (h.length !== 8) return '#' + h.toLowerCase();
  const [r, g, b] = hexRgb('#' + h.slice(0, 6));
  return `rgba(${r}, ${g}, ${b}, ${+(parseInt(h.slice(6), 16) / 255).toFixed(3)})`;
}
/** @param {string} hex @param {number} a */
export const withAlpha = (hex, a) => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const plain = (/** @type {any} */ v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** b laid over a: objects merge key by key at every depth, anything else (numbers, colours, lists) is replaced
 * @param {any} a @param {any} b @returns {any} */
export function mergeLook(a, b) {
  if (!plain(a) || !plain(b)) return b === undefined ? a : b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = plain(out[k]) && plain(v) ? mergeLook(out[k], v) : v;
  return out;
}

/** the look to use: the defaults, with a preset laid over them (a preset names only what it changes)
 * @param {any} theme uiTheme.json @param {string} [preset] */
export function uiThemeLook(theme, preset) {
  const base = (theme && theme.defaults) || {};
  const over = (preset && theme && theme.presets && theme.presets[preset]) || {};
  const look = mergeLook(base, over);
  delete look.name;
  delete look.player;
  return look;
}

/** what a palette may leave to the colour code, and the family each comes from (UI-11 danger; UI-12 the HP bars) */
export const UI_FROM_SIGNALS = { danger: 'bad', hpOk: 'good', hpMid: 'caution', hpLow: 'bad' };
/** UI-11: a side's palette with what it leaves to the colour code filled in from that side's text shades: danger and
 * HP under a quarter are the red family, HP under half amber, healthy HP teal (UI-12)
 * @param {Record<string, string>} pal @param {any} look @param {'light' | 'dark' | string} side */
export function paletteFor(pal, look, side) {
  const sh = ((look && look.signals) || {})[side] || {};
  let out = pal;
  for (const [role, id] of Object.entries(UI_FROM_SIGNALS)) if (!pal[role] && sh[id]) out = { ...out, [role]: sh[id] };
  return out;
}
/** UI-12: the palettes players pick in Settings: the defaults (id '') and each preset marked `player`, as [id, name]
 * @param {any} theme uiTheme.json @returns {[string, string][]} */
export function uiPalettes(theme) {
  if (!theme || !theme.defaults) return [];
  const out = /** @type {[string, string][]} */ ([['', theme.defaults.name || 'Default']]);
  for (const [id, p] of Object.entries(theme.presets || {}))
    if (p && /** @type {any} */ (p).player) out.push([id, /** @type {any} */ (p).name || id]);
  return out;
}
/** UI-12: a look players can have: the defaults, or a preset marked `player` @param {any} theme @param {string} where */
export const uiPlayerLook = (theme, where) =>
  !where.startsWith('preset:') || !!((theme.presets || {})[where.slice(7)] || {}).player;
/** one mode's declarations @param {Record<string, string>} pal @param {any} look @param {'light' | 'dark'} mode */
export function modeVars(pal, look, mode) {
  pal = paletteFor(pal, look, mode);
  const out = [];
  for (const [role, olds] of Object.entries(UI_ROLES)) {
    if (!pal[role]) continue;
    const c = cssColour(pal[role]);
    out.push(`${roleVar(role)}: ${c};`, ...olds.map(v => `${v}: ${c};`));
  }
  if (pal.hpOk) out.push(`--c-hp-ok-hi: color-mix(in srgb, ${cssColour(pal.hpOk)} 55%, #ffffff);`);
  if (pal.hpMid) out.push(`--c-hp-mid-hi: color-mix(in srgb, ${cssColour(pal.hpMid)} 55%, #ffffff);`);
  if (pal.hpLow) out.push(`--c-hp-low-hi: color-mix(in srgb, ${cssColour(pal.hpLow)} 55%, #ffffff);`);
  const s = (look.surface || {})[mode] || {},
    tint = s.shadowTint === 'text' ? pal.text : s.shadowTint;
  if (pal.surface && s.glass != null) out.push(`--g-bg: ${withAlpha(pal.surface.slice(0, 7), s.glass)};`);
  if (s.highlight != null) out.push(`--g-in: inset 0 1px 0 rgba(255, 255, 255, ${s.highlight});`);
  if (s.edgeHi != null) out.push(`--edge-hi: rgba(255, 255, 255, ${s.edgeHi});`);
  if (tint && /^#/.test(tint)) {
    const t = (/** @type {number} */ a) => withAlpha(tint.slice(0, 7), a);
    // UI-2: the shadow colour the angular parts' drop shadows read, and the edge line's dark side
    out.push(`--c-shadow: ${cssColour(tint.slice(0, 7))};`);
    if (s.edgeLo != null) out.push(`--edge-lo: ${t(s.edgeLo)};`);
    // UI-3: the glass panels' raised and floating box shadows, per side (the depth group)
    const d = (look.depth || {})[mode] || {};
    if (d.raisedY != null)
      out.push(`--g-sh: 0 ${d.raisedY}px ${d.raisedBlur}px -10px ${t(d.raisedAlpha)}, 0 2px 6px ${t(d.raisedNear)};`);
    if (d.floatY != null)
      out.push(`--g-sh2: 0 ${d.floatY}px ${d.floatBlur}px -10px ${t(d.floatAlpha)}, 0 3px 8px ${t(d.floatNear)};`);
  }
  return out;
}

/** the text sizes as tokens.css has them: clamp(min px, rem + vw, max px) */
export const UI_TYPE_SIZES = {
  caption: [12, 0.7, 0.3, 13],
  body: [15, 0.85, 0.3, 16],
  title: [20, 1, 1.2, 24],
  screen: [28, 1.4, 1.6, 34],
};

/** what doesn't change between light and dark @param {any} look */
export function sharedVars(look) {
  const out = [];
  const s = look.surface || {},
    sh = look.shape || {},
    ty = look.type || {};
  if (s.blur != null) out.push(`--g-blur: blur(${s.blur}px) saturate(${s.saturate ?? 1});`);
  if (sh.cutSm != null) out.push(`--cut-sm: ${sh.cutSm}px;`);
  if (sh.cutMd != null) out.push(`--cut-md: ${sh.cutMd}px;`);
  if (sh.cutLg != null) out.push(`--cut-lg: ${sh.cutLg}px;`);
  if (sh.slant != null) out.push(`--slant: ${sh.slant}deg;`);
  if (look.shape) out.push(...shapeDecls(sh));
  // UI-3: the angular parts' drop shadows, in each side's shadow colour
  const dr = look.drop || {},
    mix = (/** @type {number} */ a) => `color-mix(in srgb, var(--c-shadow) ${roundTo2(a * 100)}%, transparent)`;
  if (dr.raisedY != null)
    out.push(
      `--drop-raised: drop-shadow(0 ${dr.raisedY}px ${dr.raisedBlur}px ${mix(dr.raisedAlpha)}) drop-shadow(0 1px 2px ${mix(dr.raisedNear)});`
    );
  if (dr.floatY != null)
    out.push(
      `--drop-float: drop-shadow(0 ${dr.floatY}px ${dr.floatBlur}px ${mix(dr.floatAlpha)}) drop-shadow(0 2px 4px ${mix(dr.floatNear)});`
    );
  // UI-3: the spacing scale
  for (const [k, v] of Object.entries(look.space || {})) if (typeof v === 'number') out.push(`--${k}: ${v}px;`);
  if (ty.voice) out.push(`--font-voice: '${ty.voice}', ui-monospace, monospace;`);
  if (ty.prose) out.push(`--font-prose: '${ty.prose}', ui-sans-serif, system-ui, sans-serif;`);
  // UI-3: the text sizes times the scale, long text's line height
  if (ty.scale != null)
    for (const [k, [lo, rem, vw, hi]] of Object.entries(UI_TYPE_SIZES)) {
      const x = (/** @type {number} */ n) => roundTo2(n * ty.scale);
      out.push(`--fs-${k}: clamp(${x(lo)}px, ${x(rem)}rem + ${x(vw)}vw, ${x(hi)}px);`);
    }
  if (ty.lineHeight != null) out.push(`--lh-prose: ${ty.lineHeight};`);
  // UI-3: the three speeds, the stagger and the eases
  const mo = look.motion || {};
  for (const [k, v] of /** @type {const} */ ([
    ['fast', '--m-fast'],
    ['base', '--m-base'],
    ['slow', '--m-slow'],
    ['stagger', '--stagger'],
    // UI-16a: the feedback times
    ['press', '--m-press'],
    ['exit', '--m-exit'],
    ['pop', '--m-pop'],
    ['float', '--m-float'],
  ]))
    if (typeof mo[k] === 'number') out.push(`${v}: ${mo[k]}ms;`);
  for (const [k, v] of /** @type {const} */ ([
    ['easeOut', '--ease-out'],
    ['easeIn', '--ease-in'],
    ['spring', '--spring'],
  ]))
    if (Array.isArray(mo[k]) && mo[k].length === 4) out.push(`${v}: cubic-bezier(${mo[k].join(', ')});`);
  // UI-8: the minimap (js/minimap.js reads these where its canvas sits): its span, the compact bar's timing, its marks
  const mm = look.minimap || {};
  if (typeof mm.span === 'number') out.push(`--minimap-span: ${mm.span};`);
  // UI-8b: the tile's sizes (pb-nav-bar and shell.css's --nav-h read them)
  if (typeof mm.tileW === 'number') out.push(`--minimap-tile-w: ${mm.tileW}px;`);
  if (typeof mm.tileH === 'number') out.push(`--minimap-tile-h: ${mm.tileH}px;`);
  if (typeof mm.tileW === 'number' && typeof mm.tileH === 'number' && mm.tileW > 0)
    out.push(`--minimap-tile-aspect: ${+(mm.tileH / mm.tileW).toFixed(4)};`);
  if (typeof mm.tileCompact === 'number') out.push(`--minimap-tile-compact: ${mm.tileCompact}px;`);
  if (typeof mm.compactAfter === 'number') out.push(`--minimap-compact-after: ${mm.compactAfter};`);
  if (typeof mm.fullAfter === 'number') out.push(`--minimap-full-after: ${mm.fullAfter};`);
  for (const k of /** @type {const} */ (['facilities', 'trainers', 'billies']))
    if (typeof mm[k] === 'boolean') out.push(`--minimap-${k}: ${mm[k] ? 1 : 0};`);
  // UI-11: the colour code's fills (each side's text shades: uiThemeCss)
  // SY-8: the style track's dials (pb-stamp, the HP fill; battle.js and the foil read them through styleDials)
  out.push(...styleVarsCss(look.style));
  if (look.signals) out.push(...signalVars(look.signals).shared);
  // UI-12: dark text on gold and on the colour code's fills, the same on both sides: the dark side's ground
  const ink = ((look.color || {}).dark || {}).ground;
  if (ink) out.push(`--c-ink: ${cssColour(ink.slice(0, 7))};`);
  return out;
}

/* ---------- UI-2: the angular shapes ----------
   Each component family's outline as clip-path polygons, made from the shape group: `cut` (chamfered 45° corners,
   smooth or stepped like pixel art), `rounded` (arcs, so the Studio can compare) or `square`. Three per family:
     --clip-<f>  the outline (the face is clipped to it)
     --edge-<f>  a 1 px ring just inside the outline (the edge line: light on top, dark below)
     --ring-<f>  everything around the outline out to 48 px (the shadow layer is clipped to it, so a drop shadow shows
                 outside the cut and never under the glass)
   A clip-path also clips box-shadows and borders, so the kit draws the shadow on its own layer (ui-kit.js,
   ui-kit.css). */
/** the families as they are without data (uiTheme.json shape.families lays its own over them): the shape (kind),
 * which cut size, which corners, and the radius when rounded; action and toast are long hexagons (hex) */
export const UI_SHAPE_FAMILIES = {
  panel: { kind: 'cut', size: 'cutLg', corners: ['tl', 'br'], radius: 22 }, // panels and sheets: top-left and bottom-right
  card: { kind: 'cut', size: 'cutMd', corners: ['tl', 'tr', 'br', 'bl'], radius: 16 }, // cards: four small cuts
  button: { kind: 'cut', size: 'cutSm', corners: ['tl', 'tr', 'br', 'bl'], radius: 16 }, // quiet and plain buttons
  action: { kind: 'cut', size: 'cutLg', hex: true, radius: 22 }, // the main action: a long hexagon
  tab: { kind: 'cut', size: 'cutMd', corners: ['tl', 'tr'], radius: 12 }, // tabs: trapezoids (the top corners cut)
  toast: { kind: 'cut', size: 'cutMd', hex: true, radius: 18 }, // toasts: a long hexagon
  // the dialogue box: a panel with a speech tail on its top edge, over the portrait; the tail is 1.5 cutLg high and
  // its upright side stands x from the left. Its layers reach up over the tail (dialogue.css: top: -tail)
  bubble: { kind: 'cut', size: 'cutLg', corners: ['tl', 'br'], radius: 22, tail: { x: 52, k: 1.5 } },
};
export const UI_SHAPE_DEFAULTS = { cutSm: 4, cutMd: 8, cutLg: 12, slant: 10, step: 4, stepped: false };
export const RING = 48;
export const roundTo2 = (/** @type {number} */ n) => Math.round(n * 100) / 100;
/** one coordinate: an anchor (0, 50 or 100 %) and a px offset @param {number} a @param {number} o */
export const coord = (a, o) => {
  o = roundTo2(o);
  if (a === 0) return o ? `${o}px` : '0';
  if (!o) return `${a}%`;
  return `calc(${a}% ${o < 0 ? '-' : '+'} ${Math.abs(o)}px)`;
};
/** @typedef {[number, number, number, number]} Pt anchor x, offset x, anchor y, offset y */
/** a corner's points, top-left first, from the left edge to the top edge, inset by d
 * @param {'cut' | 'rounded' | 'square'} kind @param {number} size @param {number} d @param {any} sh @returns {[number, number][]} */
export function cornerTL(kind, size, d, sh) {
  if (kind === 'square' || size <= 0) return [[d, d]];
  if (kind === 'rounded') {
    const r = Math.max(0, size - d),
      out = /** @type {[number, number][]} */ ([]);
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * (Math.PI / 2);
      out.push([d + r - r * Math.cos(t), d + r - r * Math.sin(t)]);
    }
    return out;
  }
  if (sh.stepped) {
    const n = Math.max(1, Math.round(size / (sh.step || 4))),
      s = size / n,
      out = /** @type {[number, number][]} */ ([[d, d + size]]);
    for (let i = 1; i <= n; i++) out.push([d + i * s, d + size - (i - 1) * s], [d + i * s, d + size - i * s]);
    return out;
  }
  // smooth: the diagonal moves in by d, so its ends sit d·(√2 − 1) further along the edges
  const c = size + d * (Math.SQRT2 - 1);
  return [
    [d, d + c],
    [d + c, d],
  ];
}
/** the bubble's tail height in px (whole pixels) @param {any} sh */
export const bubbleTail = sh => Math.round((sh.cutLg ?? UI_SHAPE_DEFAULTS.cutLg) * UI_SHAPE_FAMILIES.bubble.tail.k);
/** a family's outline as points, inset by d @param {string} fam @param {any} sh @param {number} d @returns {Pt[]} */
export function shapePoints(fam, sh, d = 0) {
  const F = { .../** @type {any} */ (UI_SHAPE_FAMILIES)[fam], ...((sh.families && sh.families[fam]) || {}) };
  const kind = F.kind || 'cut',
    corners = F.corners || [];
  if (F.hex && kind === 'cut') {
    const h = sh[F.size] ?? /** @type {any} */ (UI_SHAPE_DEFAULTS)[F.size],
      e = d * Math.SQRT2,
      k = h + d * (Math.SQRT2 - 1);
    return [
      [0, e, 50, 0],
      [0, k, 0, d],
      [100, -k, 0, d],
      [100, -e, 50, 0],
      [100, -k, 100, -d],
      [0, k, 100, -d],
    ];
  }
  const cut = F.hex ? 0 : (sh[F.size] ?? /** @type {any} */ (UI_SHAPE_DEFAULTS)[F.size]);
  /** @type {Pt[]} */
  const out = [];
  let tlEnd = 0;
  for (const [corner, mx, my, rev] of /** @type {const} */ ([
    ['tl', false, false, false],
    ['tr', true, false, true],
    ['br', true, true, false],
    ['bl', false, true, true],
  ])) {
    const size = kind === 'rounded' ? F.radius : kind === 'cut' && corners.includes(corner) ? cut : 0;
    let pts = cornerTL(kind === 'rounded' ? 'rounded' : size ? 'cut' : 'square', size, d, sh);
    if (rev) pts = pts.slice().reverse();
    for (const [u, v] of pts) out.push([mx ? 100 : 0, mx ? -u : u, my ? 100 : 0, my ? -v : v]);
    if (corner === 'tl') tlEnd = out.length;
  }
  if (F.tail) {
    // the box is the part plus the tail's height above it: the top edge moves down by t, the tail goes in after the
    // top-left corner (an upright side and a 45° side; inset by d, its tip sits d·(1 + √2) down)
    const t = bubbleTail(sh),
      x = F.tail.x;
    for (const p of out) if (p[2] === 0) p[3] += t;
    out.splice(
      tlEnd,
      0,
      [0, x + d, 0, t + d],
      [0, x + d, 0, d + d * Math.SQRT2],
      [0, x + t + d - d * Math.SQRT2, 0, t + d]
    );
  }
  return out;
}
export const ptsText = (/** @type {Pt[]} */ pts) => pts.map(([ax, ox, ay, oy]) => `${coord(ax, ox)} ${coord(ay, oy)}`);
/** the three polygons of a family @param {string} fam @param {any} sh */
export function shapeVars(fam, sh) {
  const outer = ptsText(shapePoints(fam, sh)),
    inner = ptsText(shapePoints(fam, sh, 1)),
    box = ptsText([
      [0, -RING, 0, -RING],
      [100, RING, 0, -RING],
      [100, RING, 100, RING],
      [0, -RING, 100, RING],
    ]);
  return {
    [`--clip-${fam}`]: `polygon(${outer.join(', ')})`,
    [`--edge-${fam}`]: `polygon(evenodd, ${[...outer, outer[0], ...inner, inner[0]].join(', ')})`,
    [`--ring-${fam}`]: `polygon(evenodd, ${[...box, box[0], ...outer, outer[0]].join(', ')})`,
  };
}
/** every family's polygons, the slanted chip and the cut sizes, as declarations @param {any} shape */
export function shapeDecls(shape) {
  const sh = { ...UI_SHAPE_DEFAULTS, ...(shape || {}) };
  const out = [];
  for (const fam of Object.keys(UI_SHAPE_FAMILIES))
    for (const [k, v] of Object.entries(shapeVars(fam, sh))) out.push(`${k}: ${v};`);
  // the slanted chip (pyramids, counts): the slant over a 24 px chip
  const s = roundTo2(Math.tan((sh.slant * Math.PI) / 180) * 24);
  out.push(`--clip-chip: polygon(${s}px 0, 100% 0, calc(100% - ${s}px) 100%, 0 100%);`);
  // how far the bubble's layers reach above the dialogue box (its tail)
  out.push(`--bubble-tail: ${bubbleTail(sh)}px;`);
  return out;
}

/** the fonts the game ships: family -> [weight, file] (in game/fonts) */
export const UI_FONTS = {
  'Jersey 15': [[400, 'jersey-15-400']],
  'Pixelify Sans': [
    [400, 'pixelify-sans-400'],
    [500, 'pixelify-sans-500'],
    [600, 'pixelify-sans-600'],
    [700, 'pixelify-sans-700'],
  ],
  Oxanium: [
    [500, 'oxanium-500'],
    [600, 'oxanium-600'],
  ],
  'Chakra Petch': [
    [500, 'chakra-petch-500'],
    [600, 'chakra-petch-600'],
  ],
};

/* ---------- UI-3: per-screen overrides ----------
   uiTheme.json overrides.<screen> lays colour and shape over the look on one screen. Its variables are declared again
   on the screen's root (and on anything marked data-ui-screen, as the Studio's preview is), so they reach only it. */
/** the screens an override can name: the Studio's name and the screen's root on the page */
export const UI_SCREENS = {
  walk: { name: 'Walk', sel: '.screen.s-walk' },
  map: { name: 'Map', sel: '.screen.s-map' },
  team: { name: 'Team', sel: '.screen.s-team' },
  guide: { name: 'Guide', sel: '.screen.s-guide' },
  bag: { name: 'Bag', sel: '.screen.s-bag' },
  profile: { name: 'Trainer card', sel: '.screen.s-profile' },
  battle: { name: 'Battle', sel: '#battle' },
  dialogue: { name: 'Dialogue', sel: '.talk-layer' },
};
/** variables the style sheets make at :root from the theme's; a custom property is worked out where it is declared,
 * so a screen with its own colours declares these again (tools/test/ui-theme.test.mjs keeps them equal to the CSS) */
export const UI_DERIVED = [
  '--depth-raised: var(--g-in), var(--g-sh);',
  '--depth-float: var(--g-in), var(--g-sh2);',
  '--edge: linear-gradient(180deg, var(--edge-hi), var(--edge-lo));',
  '--drop-focus: drop-shadow(2px 0 0 var(--gold-b)) drop-shadow(-2px 0 0 var(--gold-b)) drop-shadow(0 2px 0 var(--gold-b)) drop-shadow(0 -2px 0 var(--gold-b));',
  '--orn: var(--gold);',
];
/** a screen's selector @param {string} id */
export const screenSel = id =>
  `${/** @type {any} */ (UI_SCREENS[id] || {}).sel || '.s-' + id}, [data-ui-screen='${id}']`;
/** the shape declarations a shape group makes (cut sizes, slant, the polygons) @param {any} sh */
export function shapeLines(sh) {
  const out = [];
  if (sh.cutSm != null) out.push(`--cut-sm: ${sh.cutSm}px;`);
  if (sh.cutMd != null) out.push(`--cut-md: ${sh.cutMd}px;`);
  if (sh.cutLg != null) out.push(`--cut-lg: ${sh.cutLg}px;`);
  if (sh.slant != null) out.push(`--slant: ${sh.slant}deg;`);
  out.push(...shapeDecls(sh));
  return out;
}
/** one screen's look: the look with its override laid over @param {any} look @param {any} ov */
export const screenLook = (look, ov) => mergeLook(look, { color: ov && ov.color, shape: ov && ov.shape });
/** an override as CSS @param {string} id @param {any} look @param {any} ov
 * @param {(sel: string, lines: string[], ind?: string) => string} block */
export function overrideCss(id, look, ov, block) {
  const has = (/** @type {any} */ o) => !!o && Object.keys(o).length > 0;
  const col = ov && ov.color && (has(ov.color.light) || has(ov.color.dark)),
    shp = has(ov && ov.shape);
  if (!col && !shp) return '';
  const L = screenLook(look, ov),
    sel = `:is(${screenSel(id)})`,
    pal = L.color || {};
  const shared = [...(shp ? shapeLines(L.shape || {}) : [])];
  if (col) {
    const dr = sharedVars({ drop: L.drop }); // the drop shadows read --c-shadow: declared again here
    shared.push(...dr, ...UI_DERIVED);
  }
  let css = `/* ${id} */\n` + block(sel, [...shared, ...(col ? modeVars(pal.light || {}, L, 'light') : [])]);
  if (col) {
    const dark = modeVars(pal.dark || {}, L, 'dark');
    css +=
      `@media (prefers-color-scheme: dark) {\n${block(`:root:not([data-theme='light']) ${sel}`, dark, '  ')}}\n` +
      block(`:root[data-theme='dark'] ${sel}`, dark);
  }
  return css;
}

/* ---------- UI-3: contrast ----------
   Text and quiet text read at 4.5:1 on the ground and on a solid surface; danger and primary, used for marks and big
   text, at 3:1 (WCAG AA). Checked in the defaults, every palette players pick (a preset marked `player`, UI-12) and
   every screen's override, both sides; any other preset for text only (alpha05 is the look before UI-1, for
   comparing, and its green reads 2.5:1 on its ground).
   tools/check-data.mjs and the Studio's Check use the same list. */
export const UI_CONTRAST = [
  ['text', 4.5],
  ['text2', 4.5],
  ['danger', 3],
  ['primary', 3],
];
/** a colour with an alpha byte, laid over a solid one (#rrggbb) @param {string} fg @param {string} bg */
export function solidOver(fg, bg) {
  const h = String(fg).replace('#', '');
  if (h.length !== 8) return fg;
  const a = parseInt(h.slice(6), 16) / 255,
    f = hexRgb('#' + h.slice(0, 6)),
    b = hexRgb(bg);
  return (
    '#' +
    f
      .map((c, i) =>
        Math.round(c * a + b[i] * (1 - a))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
/** the contrast of one colour on another, alpha laid over the second @param {string} fg @param {string} bg */
export const uiRatio = (fg, bg) => contrastRatio(solidOver(fg, bg.slice(0, 7)), bg.slice(0, 7));
/** every pair under its minimum: {where ('' the defaults, 'preset:<id>', 'screen:<id>'), side, fg, bg, ratio, min}
 * @param {any} theme */
export function uiThemeContrast(theme) {
  if (!theme || !theme.defaults) return [];
  const out = [];
  const looks = /** @type {[string, any][]} */ ([['', uiThemeLook(theme)]]);
  for (const id of Object.keys(theme.presets || {})) looks.push([`preset:${id}`, uiThemeLook(theme, id)]);
  for (const [id, ov] of Object.entries(theme.overrides || {}))
    looks.push([`screen:${id}`, screenLook(uiThemeLook(theme), ov)]);
  for (const [where, look] of looks)
    for (const side of ['light', 'dark']) {
      const pal = paletteFor((look.color || {})[side] || {}, look, side);
      for (const [fg, min] of UI_CONTRAST)
        for (const bg of ['ground', 'surface']) {
          if (!pal[fg] || !pal[bg] || (!uiPlayerLook(theme, where) && /** @type {number} */ (min) < 4.5)) continue;
          const ratio = uiRatio(pal[fg], pal[bg]);
          if (ratio < /** @type {number} */ (min)) out.push({ where, side, fg, bg, ratio, min });
        }
    }
  return out;
}

/* ---------- UI-11: the colour code's checks ----------
   The colour code (defaults.signals, logic/signals.js) is the same in every palette, so it is checked against each:
   every text shade on its side's surface (4.5:1) and ground (3:1), dark text (the dark side's ground) on every fill
   (4.5:1), in the defaults, the players' palettes (UI-12) and every screen's colours; any other preset, as in
   uiThemeContrast, for the shades on its surface only (alpha05, the look before UI-1, has a darker dark ground); and within each screen's set (UI_SIGNAL_SETS, types.json's types with the battle and the pickups) every two
   fills apart (OKLab 5). A preset can't set its own. tools/check-data.mjs and the Studio's Check use the same list. */
/** every problem: {where ('' the defaults, 'preset:<id>', 'screen:<id>'), rel (the dial's place in the look), msg}
 * @param {any} theme uiTheme.json @param {any[]} [types] types.json */
export function uiSignalProblems(theme, types = []) {
  const sig = theme && theme.defaults && theme.defaults.signals;
  if (!sig) return [];
  const out = /** @type {{where: string, rel: string, msg: string}[]} */ ([]),
    M = UI_SIGNAL_MIN,
    name = (/** @type {string} */ id) => (UI_SIGNALS.find(s => s[0] === id) || [])[1] || id;
  for (const id of Object.keys(theme.presets || {}))
    if ((theme.presets[id] || {}).signals)
      out.push({
        where: `preset:${id}`,
        rel: 'signals',
        msg: 'sets its own colour code; the colour code is the same in every palette',
      });
  const looks = /** @type {[string, any][]} */ ([['', uiThemeLook(theme)]]);
  for (const id of Object.keys(theme.presets || {})) looks.push([`preset:${id}`, uiThemeLook(theme, id)]);
  for (const [id, ov] of Object.entries(theme.overrides || {}))
    looks.push([`screen:${id}`, screenLook(uiThemeLook(theme), ov)]);
  for (const [where, look] of looks) {
    const C = look.color || {},
      preset = !uiPlayerLook(theme, where);
    for (const side of /** @type {const} */ (['light', 'dark'])) {
      const pal = C[side] || {};
      for (const [id, hex] of Object.entries(sig[side] || {}))
        for (const [bg, min] of /** @type {const} */ ([
          ['surface', M.surface],
          ['ground', M.ground],
        ])) {
          if (!pal[bg] || (preset && bg !== 'surface')) continue;
          const r = uiRatio(/** @type {string} */ (hex), pal[bg]);
          if (r < min)
            out.push({
              where,
              rel: `signals.${side}.${id}`,
              msg: `${name(id)} (${side}) reads at ${r.toFixed(2)}:1 on the ${bg}, under ${min}:1`,
            });
        }
    }
    const ink = !preset && (C.dark || {}).ground;
    if (ink)
      for (const [id, hex] of Object.entries(sig.fill || {})) {
        const r = uiRatio(ink, /** @type {string} */ (hex).slice(0, 7));
        if (r < M.ink)
          out.push({
            where,
            rel: `signals.fill.${id}`,
            msg: `dark text (the dark ground) on ${name(id)}'s fill reads at ${r.toFixed(2)}:1, under ${M.ink}:1`,
          });
      }
  }
  /* UI-13: every type's text reads on its colour, and the types with light text sit at one lightness */
  // a type's text colour, white when it names none (as game-data.js reads it)
  const typeInk = (/** @type {any} */ t) => rgbHex(t.text ? hexRgb(t.text) : [255, 255, 255]),
    typed = (types || []).filter(t => t && t.id && t.color),
    light = typed.filter(t => luminance(hexRgb(typeInk(t))) > 0.5),
    Ls = light.map(t => oklab(t.color)[0]).sort((a, b) => a - b),
    mid = Ls.length ? (Ls[0] + Ls[Ls.length - 1]) / 2 : 0;
  for (const t of typed) {
    const r = uiRatio(typeInk(t), t.color);
    if (r < M.typeText)
      out.push({
        where: 'types',
        rel: '',
        msg: `${t.id}'s text reads at ${r.toFixed(2)}:1 on its colour, under ${M.typeText}:1`,
      });
  }
  for (const t of light) {
    const L = oklab(t.color)[0];
    if (Math.abs(L - mid) > M.typeLightness)
      out.push({
        where: 'types',
        rel: '',
        msg: `${t.id} sits at lightness ${(L / 100).toFixed(2)}, more than ${(M.typeLightness / 100).toFixed(2)} from the types' ${(mid / 100).toFixed(2)}`,
      });
  }
  for (const [set, S] of Object.entries(UI_SIGNAL_SETS)) {
    const list = signalSetColours(sig, set, types);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const d = oklabDistance(list[i][1], list[j][1]);
        if (d >= M.distance) continue;
        // the dial to open: the first of the two that is the colour code's (two types: types.json's own)
        const own = [list[i][0], list[j][0]].find(k => !k.startsWith('type '));
        out.push({
          where: own ? '' : 'types',
          rel: own ? `signals.fill.${own}` : '',
          msg: `${S.name}: ${name(list[i][0])} and ${name(list[j][0])} are ${d.toFixed(1)} apart, under ${M.distance} (OKLab)`,
        });
      }
  }
  return out;
}

/** the theme as a style sheet
 * @param {any} theme uiTheme.json @param {{preset?: string, fonts?: string}} [o] fonts: the URL of game/fonts/, ending in / */
export function uiThemeCss(theme, o = {}) {
  if (!theme || !theme.defaults) return '';
  const look = uiThemeLook(theme, o.preset);
  const pal = look.color || {};
  const block = (/** @type {string} */ sel, /** @type {string[]} */ lines, ind = '') =>
    lines.length ? `${ind}${sel} {\n${lines.map(l => `${ind}  ${l}`).join('\n')}\n${ind}}\n` : '';
  const sig = signalVars(look.signals);
  const light = [...sharedVars(look), ...modeVars(pal.light || {}, look, 'light'), ...sig.light];
  const dark = [...modeVars(pal.dark || {}, look, 'dark'), ...sig.dark];
  let css = block(':root', light);
  if (dark.length)
    css +=
      `@media (prefers-color-scheme: dark) {\n${block(":root:not([data-theme='light'])", dark, '  ')}}\n` +
      block(":root[data-theme='dark']", dark);
  // UI-3: each screen's own colours and shapes
  for (const [id, ov] of Object.entries(theme.overrides || {})) css += overrideCss(id, look, ov, block);
  // UI-12: the phone asks for less see-through: the glass goes solid and stops blurring (after the palettes and as
  // specific as their dark blocks, so it wins on either side)
  css +=
    `@media (prefers-reduced-transparency: reduce) {\n` +
    block(
      ":root:not([data-theme='light']),\n  :root[data-theme='light']",
      ['--g-blur: none;', '--g-bg: var(--g-solid);'],
      '  '
    ) +
    '}\n';
  // the voice font has one weight: never fake a bold (the CSS still asks for 600 and 700 in places)
  const ty = look.type || {};
  if (ty.voice && (UI_FONTS[/** @type {keyof typeof UI_FONTS} */ (ty.voice)] || []).length === 1)
    css += `:root {\n  font-synthesis-weight: none;\n}\n`;
  if (o.fonts) {
    const scale = (/** @type {string} */ f) => (f === ty.voice && ty.voiceScale ? ty.voiceScale : 1);
    for (const fam of new Set([ty.voice, ty.prose].filter(Boolean)))
      for (const [w, file] of UI_FONTS[/** @type {keyof typeof UI_FONTS} */ (fam)] || [])
        css +=
          `@font-face {\n  font-family: '${fam}';\n  font-weight: ${w};\n  font-display: swap;\n` +
          (scale(fam) !== 1 ? `  size-adjust: ${Math.round(scale(fam) * 100)}%;\n` : '') +
          `  src: url(${o.fonts}${file}.woff2) format('woff2');\n}\n`;
  }
  return css;
}
