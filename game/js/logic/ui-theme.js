// @ts-check
'use strict';
/* ================= UI THEME (UI-1) =================
   game/data/uiTheme.json as one style sheet: the colour roles, the glass, the cut sizes and the fonts. The page writes
   it into <style id="ui-theme"> after every stylesheet (theme-sheet.js), with the same three selectors the CSS uses
   (light on :root, dark from the system unless Settings says light, dark from Settings), so Settings' theme switch
   keeps working. Each role also sets the older variable names the screens still read (--text, --bg, --panel-s,
   --g-solid, --gold, --red, --ok...), so the palette reaches every rule that uses a variable; raw colours in the rules
   stay until UI-5/6. Without the data the page keeps tokens.css and the older sheets as they are. Logic only: no
   DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { hexRgb } from './colors.js';
/* eslint-disable no-func-assign */
expose({
  RING: [() => RING],
  UI_FONTS: [() => UI_FONTS],
  UI_ROLES: [() => UI_ROLES],
  UI_SHAPE_DEFAULTS: [() => UI_SHAPE_DEFAULTS],
  UI_SHAPE_FAMILIES: [() => UI_SHAPE_FAMILIES],
  coord: [() => coord],
  // @ts-expect-error -- replaced on purpose
  cornerTL: [() => cornerTL, v => (cornerTL = v)],
  // @ts-expect-error -- replaced on purpose
  cssColour: [() => cssColour, v => (cssColour = v)],
  // @ts-expect-error -- replaced on purpose
  mergeLook: [() => mergeLook, v => (mergeLook = v)],
  // @ts-expect-error -- replaced on purpose
  modeVars: [() => modeVars, v => (modeVars = v)],
  plain: [() => plain],
  ptsText: [() => ptsText],
  roleVar: [() => roleVar],
  roundTo2: [() => roundTo2],
  // @ts-expect-error -- replaced on purpose
  shapeDecls: [() => shapeDecls, v => (shapeDecls = v)],
  // @ts-expect-error -- replaced on purpose
  shapePoints: [() => shapePoints, v => (shapePoints = v)],
  // @ts-expect-error -- replaced on purpose
  shapeVars: [() => shapeVars, v => (shapeVars = v)],
  // @ts-expect-error -- replaced on purpose
  sharedVars: [() => sharedVars, v => (sharedVars = v)],
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
  return look;
}

/** one mode's declarations @param {Record<string, string>} pal @param {any} look @param {'light' | 'dark'} mode */
export function modeVars(pal, look, mode) {
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
  if (mode === 'light') {
    if (s.highlight != null) out.push(`--g-in: inset 0 1px 0 rgba(255, 255, 255, ${s.highlight});`);
    if (s.edgeHi != null) out.push(`--edge-hi: rgba(255, 255, 255, ${s.edgeHi});`);
    // UI-2: the shadow colour the angular parts' drop shadows read, and the edge line's dark side
    if (tint && /^#/.test(tint))
      out.push(
        `--c-shadow: ${cssColour(tint.slice(0, 7))};`,
        `--edge-lo: ${withAlpha(tint.slice(0, 7), s.edgeLo ?? 0.3)};`
      );
    if (tint && /^#/.test(tint)) {
      const t = (/** @type {number} */ a) => withAlpha(tint.slice(0, 7), a);
      out.push(
        `--g-sh: 0 10px 28px -10px ${t(0.42)}, 0 2px 6px ${t(0.14)};`,
        `--g-sh2: 0 16px 34px -10px ${t(0.5)}, 0 3px 8px ${t(0.16)};`
      );
    }
  } else if (tint && /^#/.test(tint)) {
    out.push(`--c-shadow: ${cssColour(tint.slice(0, 7))};`);
    if (s.edgeHi != null) out.push(`--edge-hi: rgba(255, 255, 255, ${s.edgeHi});`);
    out.push(`--edge-lo: ${withAlpha(tint.slice(0, 7), s.edgeLo ?? 0.55)};`);
  }
  return out;
}

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
  if (ty.voice) out.push(`--font-voice: '${ty.voice}', ui-monospace, monospace;`);
  if (ty.prose) out.push(`--font-prose: '${ty.prose}', ui-sans-serif, system-ui, sans-serif;`);
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
  // the slanted chip (coins, counts): the slant over a 24 px chip
  const s = roundTo2(Math.tan((sh.slant * Math.PI) / 180) * 24);
  out.push(`--clip-chip: polygon(${s}px 0, 100% 0, calc(100% - ${s}px) 100%, 0 100%);`);
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

/** the theme as a style sheet
 * @param {any} theme uiTheme.json @param {{preset?: string, fonts?: string}} [o] fonts: the URL of game/fonts/, ending in / */
export function uiThemeCss(theme, o = {}) {
  if (!theme || !theme.defaults) return '';
  const look = uiThemeLook(theme, o.preset);
  const pal = look.color || {};
  const block = (/** @type {string} */ sel, /** @type {string[]} */ lines, ind = '') =>
    lines.length ? `${ind}${sel} {\n${lines.map(l => `${ind}  ${l}`).join('\n')}\n${ind}}\n` : '';
  const light = [...sharedVars(look), ...modeVars(pal.light || {}, look, 'light')];
  const dark = modeVars(pal.dark || {}, look, 'dark');
  let css = block(':root', light);
  if (dark.length)
    css +=
      `@media (prefers-color-scheme: dark) {\n${block(":root:not([data-theme='light'])", dark, '  ')}}\n` +
      block(":root[data-theme='dark']", dark);
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
