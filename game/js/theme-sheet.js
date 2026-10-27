// @ts-check
'use strict';
/* ================= THE THEME SHEET (UI-1) =================
   Writes game/data/uiTheme.json as <style id="ui-theme"> at the end of <head>, after every stylesheet, when the
   page loads (logic/ui-theme.js makes the text). The loading screen paints first with tokens.css and changes when
   this runs. The Studio's live preview and the UI gallery call applyUiTheme with their own copy. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { uiThemeCss } from './logic/ui-theme.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  applyUiTheme: [() => applyUiTheme, v => (applyUiTheme = v)],
  fontsUrl: [() => fontsUrl],
  // @ts-expect-error -- replaced on purpose
  setUiPalette: [() => setUiPalette, v => (setUiPalette = v)],
  // @ts-expect-error -- replaced on purpose
  uiBlurCount: [() => uiBlurCount, v => (uiBlurCount = v)],
  uiPalette: [() => uiPalette, v => setUiPalette(v)],
  uiPaletteNow: [() => uiPaletteNow],
});
/* eslint-enable no-func-assign */
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
}

/** UI-1: how many surfaces on screen blur what's behind them (the plan's budget: 3 per screen); the smoke run logs
 * it per screen */
function uiBlurCount() {
  let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    const f = s.backdropFilter || s.getPropertyValue('-webkit-backdrop-filter');
    if (!f || f === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight) n++;
  }
  return n;
}

applyUiTheme(/** @type {any} */ (globalThis).GAMEDATA?.uiTheme);
