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
  UI_FONTS: [() => UI_FONTS],
  UI_ROLES: [() => UI_ROLES],
  // @ts-expect-error -- replaced on purpose
  cssColour: [() => cssColour, v => (cssColour = v)],
  // @ts-expect-error -- replaced on purpose
  modeVars: [() => modeVars, v => (modeVars = v)],
  roleVar: [() => roleVar],
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

/** the look to use: the defaults, with a preset's groups laid over them (a preset names only what it changes)
 * @param {any} theme uiTheme.json @param {string} [preset] */
export function uiThemeLook(theme, preset) {
  const base = (theme && theme.defaults) || {};
  const over = (preset && theme && theme.presets && theme.presets[preset]) || {};
  /** @type {any} */
  const look = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(over)])) {
    if (k === 'color') {
      look.color = {};
      for (const m of ['light', 'dark'])
        look.color[m] = { ...((base.color || {})[m] || {}), ...((over.color || {})[m] || {}) };
    } else look[k] = { ...(base[k] || {}), ...(over[k] || {}) };
  }
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
  const s = look.surface || {};
  if (pal.surface && s.glass != null) out.push(`--g-bg: ${withAlpha(pal.surface.slice(0, 7), s.glass)};`);
  // the dark side's highlight and shadows stay those of v05.css until the Studio's surface dials split by mode (UI-3)
  if (mode === 'light') {
    if (s.highlight != null) out.push(`--g-in: inset 0 1px 0 rgba(255, 255, 255, ${s.highlight});`);
    const tint = s.shadowTint === 'text' ? pal.text : s.shadowTint;
    if (tint && /^#/.test(tint)) {
      const t = (/** @type {number} */ a) => withAlpha(tint.slice(0, 7), a);
      out.push(
        `--g-sh: 0 10px 28px -10px ${t(0.42)}, 0 2px 6px ${t(0.14)};`,
        `--g-sh2: 0 16px 34px -10px ${t(0.5)}, 0 3px 8px ${t(0.16)};`
      );
    }
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
  if (ty.voice) out.push(`--font-voice: '${ty.voice}', ui-monospace, monospace;`);
  if (ty.prose) out.push(`--font-prose: '${ty.prose}', ui-sans-serif, system-ui, sans-serif;`);
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
