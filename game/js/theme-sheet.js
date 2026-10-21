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
  uiBlurCount: [() => uiBlurCount, v => (uiBlurCount = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** game/fonts/, wherever the page is (the game, or the Studio's gallery): next to the css/ folder tokens.css is in */
const fontsUrl = () => {
  const link = /** @type {HTMLLinkElement | null} */ (document.querySelector('link[href$="css/tokens.css"]'));
  return new URL('../fonts/', link ? link.href : location.href).href;
};

/** @param {any} theme uiTheme.json (nothing: the sheet is taken away) @param {string} [preset] */
export function applyUiTheme(theme, preset) {
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
