// Phase 06-4: the UI gallery's switches (theme, width, reduced motion) and its live samples. The components come from the
// game's own js/ui-kit.js, so the gallery shows exactly what the game draws.
import { pbFloat } from '../game/js/ui-kit.js';
import { applyUiTheme } from '../game/js/theme-sheet.js';

const root = document.documentElement;
const press = (group, value) =>
  document
    .querySelectorAll(`[data-g="${group}"]`)
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === value)));

document.addEventListener('click', ev => {
  const b = /** @type {HTMLElement} */ (ev.target).closest('[data-g],[data-m],#gToastMore,#gFloat,#gSheetBtn');
  if (!b) return;
  const d = b.dataset;
  if (d.g === 'theme') {
    root.dataset.theme = d.v;
    press('theme', d.v);
  } else if (d.g === 'look') {
    // UI-1: the look in game/data/uiTheme.json, or one of its presets laid over it
    applyUiTheme(/** @type {any} */ (globalThis).GAMEDATA?.uiTheme, d.v || undefined);
    press('look', d.v);
  } else if (d.g === 'w') {
    document.querySelector('.g-wrap').style.setProperty('--g-w', d.v);
    press('w', d.v);
  } else if (d.g === 'motion') {
    const on = root.dataset.motion !== 'reduced';
    if (on) root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
    b.setAttribute('aria-pressed', String(on));
  } else if (d.m) {
    const el = document.getElementById('gMotion');
    el.classList.remove('m-enter', 'm-pop', 'm-nudge', 'm-count');
    void el.offsetWidth;
    el.classList.add(d.m);
  } else if (b.id === 'gToastMore') {
    const t = /** @type {any} */ (document.getElementById('gToast'));
    t.n = (t.n || 1) + 1;
  } else if (b.id === 'gFloat') pbFloat(b, '+$120');
  else if (b.id === 'gSheetBtn') /** @type {any} */ (document.getElementById('gSheet')).open = true;
});

const toastEl = /** @type {any} */ (document.getElementById('gToast'));
toastEl.text = 'Found an item';
toastEl.n = 1;
