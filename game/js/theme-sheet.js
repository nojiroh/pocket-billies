// @ts-check
'use strict';
/* ================= THE THEME SHEET (UI-1) =================
   Writes game/data/uiTheme.json as <style id="ui-theme"> at the end of <head>, after every stylesheet, when the
   page loads (logic/ui-theme.js makes the text). The loading screen paints first with tokens.css and changes when
   this runs. The Studio's live preview and the UI gallery call applyUiTheme with their own copy. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { STYLE_DIALS, STYLE_VARS, styleCount, styleDialsOf, styleReport, styleStateOf } from './logic/style-dials.js';
import { uiThemeCss } from './logic/ui-theme.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  applyUiTheme: [() => applyUiTheme, v => (applyUiTheme = v)],
  fontsUrl: [() => fontsUrl],
  // @ts-expect-error -- replaced on purpose
  setUiPalette: [() => setUiPalette, v => (setUiPalette = v)],
  // @ts-expect-error -- replaced on purpose
  styleDials: [() => styleDials, v => ((styleDials = v), provide({ styleDials }))],
  styleDialsAt: [() => styleDialsAt, v => (styleDialsAt = v)],
  styleDialsNow: [() => styleDialsNow, v => (styleDialsNow = v)],
  // @ts-expect-error -- replaced on purpose
  styleLog: [() => styleLog, v => (styleLog = v)],
  // @ts-expect-error -- replaced on purpose
  styleNote: [() => styleNote, v => ((styleNote = v), provide({ styleNote }))],
  // @ts-expect-error -- replaced on purpose
  styleStateNow: [() => styleStateNow, v => (styleStateNow = v)],
  // @ts-expect-error -- replaced on purpose
  uiBlurCount: [() => uiBlurCount, v => (uiBlurCount = v)],
  // @ts-expect-error -- replaced on purpose
  uiElementCount: [() => uiElementCount, v => (uiElementCount = v)],
  uiPalette: [() => uiPalette, v => setUiPalette(v)],
  uiPaletteNow: [() => uiPaletteNow],
});
/* eslint-enable no-func-assign */
provide({ styleDials, styleNote });
/* to-module: end */
/** game/fonts/, wherever the page is (the game, or the Studio's gallery): next to the css/ folder tokens.css is in */
const fontsUrl = () => {
  const link = /** @type {HTMLLinkElement | null} */ (document.querySelector('link[href$="css/tokens.css"]'));
  return new URL('../fonts/', link ? link.href : location.href).href;
};

/** UI-12: the palette the player picked in Settings (a preset of uiTheme.json; '' the defaults) */
let uiPalette = '';
/** UI-12: Settings' Palette row (settings-screen.js applyPreferences): the sheet again, with the player's palette
 * @param {string} [id] a preset id; nothing or an unknown one: the defaults */
export function setUiPalette(id) {
  const theme = /** @type {any} */ (globalThis).GAMEDATA?.uiTheme;
  const next = id && theme && theme.presets && theme.presets[id] ? id : '';
  if (next === uiPalette) return;
  uiPalette = next;
  applyUiTheme(theme);
}
/** the preset the sheet is written with when a caller names none: the player's palette (the Studio's draft and the
 * fixtures keep it; the gallery names its own) */
const uiPaletteNow = () => uiPalette;

/** @param {any} theme uiTheme.json (nothing: the sheet is taken away) @param {string} [preset] (nothing: the player's palette) */
export function applyUiTheme(theme, preset = uiPalette) {
  let el = document.getElementById('ui-theme');
  const css = theme ? uiThemeCss(theme, { preset, fonts: fontsUrl() }) : '';
  if (!css) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = 'ui-theme';
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
  styleDialsAt = -1e9;
}

/* ---------- SY-8: the style track's dials and what ran ---------- */
/** when the dials were last read, and what they were */
let styleDialsAt = -1e9,
  styleDialsNow = STYLE_DIALS;
/** the style track's dials as the page has them (uiTheme.json style, through the sheet's variables; the Studio's
 * preview writes the same sheet): read again at most twice a second, as the foil asks every frame */
export function styleDials() {
  const t = performance.now();
  if (t - styleDialsAt < 500) return styleDialsNow;
  styleDialsAt = t;
  const cs = getComputedStyle(document.documentElement),
    vars = new Map(STYLE_VARS.map(([k, v]) => [k, v]));
  styleDialsNow = styleDialsOf(k => cs.getPropertyValue(/** @type {string} */ (vars.get(k))));
  return styleDialsNow;
}
/** the Flashes and Animation state the page plays at now (html data-flash and data-motion, set by Settings) */
function styleStateNow() {
  const d = document.documentElement.dataset;
  return styleStateOf(d.flash === 'off', d.motion);
}
/** one more flash, stamp, pop, roll or foil frame under the state now (the debug log's style line)
 * @param {string} what @param {number} [n] */
export function styleNote(what, n = 1) {
  styleCount(styleStateNow(), what, n);
}
/** the debug log's style line: the state now, and what ran under each state */
export function styleLog() {
  return styleReport(styleStateNow());
}

/** UI-1: how many surfaces on screen blur what's behind them (the plan's budget: 3 per screen besides the two bars);
 * the smoke run logs it per screen. The checks session after UI-18: pseudo-elements (the top bar's glass is its
 * `::before`) and shadow trees (the bottom bar's glass is inside pb-nav-bar) count too.
 * @param {{bars?: boolean}} [o] bars: false leaves out the top bar and the bottom bar (the budget's count) */
function uiBlurCount(o = {}) {
  let n = 0;
  const blurs = /** @param {CSSStyleDeclaration} s */ s => {
    const f = s.backdropFilter || s.getPropertyValue('-webkit-backdrop-filter');
    return !!f && f !== 'none' && s.display !== 'none' && s.visibility !== 'hidden';
  };
  const onScreen = /** @param {Element} el */ el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  };
  /** @param {Element | ShadowRoot} root @param {boolean} bar inside a bar */
  const walk = (root, bar) => {
    for (const el of root.querySelectorAll('*')) {
      const inBar = bar || !!el.closest('.topbar, pb-nav-bar');
      if (el.shadowRoot) walk(el.shadowRoot, inBar);
      if (inBar && o.bars === false) continue;
      if (!onScreen(el)) continue;
      if (blurs(getComputedStyle(el))) n++;
      for (const p of ['::before', '::after']) {
        const s = getComputedStyle(el, p);
        if (s.content && s.content !== 'none' && blurs(s)) n++;
      }
    }
  };
  walk(document.body, false);
  return n;
}

/** UI-15: how many pieces a screen shows: visible elements that draw words of their own or are an icon or picture (the
 * scene's canvases not counted), shadow trees included. Opacity is not read (a tile half way through rising in still
 * counts); what fades away also turns visibility: hidden. The smoke run logs it per screen, so clutter can only go down
 * (check-quick.py ELEMENT_CEILING) */
function uiElementCount() {
  let n = 0;
  const icon = /** @param {Element} el */ el =>
    el.tagName === 'IMG' || el.tagName === 'svg' || (el.classList && el.classList.contains('uico'));
  const own = /** @param {Element} el */ el => {
    for (const c of el.childNodes) if (c.nodeType === 3 && /\S/.test(c.nodeValue || '')) return true;
    return false;
  };
  const shown = /** @param {Element} el */ el => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth))
      return false;
    const E = /** @type {any} */ (el);
    if (typeof E.checkVisibility === 'function') return E.checkVisibility({ visibilityProperty: true });
    return getComputedStyle(el).visibility !== 'hidden';
  };
  const walk = /** @param {Element | ShadowRoot} root */ root => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (el.closest('svg') && el.tagName !== 'svg') continue;
      if ((icon(el) || own(el)) && shown(el)) n++;
    }
  };
  walk(document.body);
  return n;
}

applyUiTheme(/** @type {any} */ (globalThis).GAMEDATA?.uiTheme);
