// Phase 06-4: the UI gallery's switches (theme, width, reduced motion) and its live samples. The components come from the
// game's own js/ui-kit.js, so the gallery shows exactly what the game draws.
import { pbFloat, typeGlyphHTML } from '../game/js/ui-kit.js';
import { applyUiTheme } from '../game/js/theme-sheet.js';
// UI-4: the run parts (pb-day-chip, pb-forecast, pb-node, pb-coin, pb-pick-card, pb-payout, pb-nav-bar; HB-2 pb-loading)
import '../game/js/ui-run-kit.js';
import { caseFile } from '../game/js/logic/case-file.js';

const root = document.documentElement;
const press = (group, value) =>
  document
    .querySelectorAll(`[data-g="${group}"]`)
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === value)));

document.addEventListener('click', ev => {
  const b = /** @type {HTMLElement} */ (ev.target).closest(
    '[data-g],[data-m],#gToastMore,#gFloat,#gSheetBtn,#gPayoutPlay,#gPickFlip,#gCoinUp,#gStampPlay'
  );
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
    el.classList.remove('m-wipe', 'm-wipe-r', 'm-enter', 'm-pop', 'm-nudge', 'm-count');
    void el.offsetWidth;
    el.classList.add(d.m);
  } else if (b.id === 'gToastMore') {
    const t = /** @type {any} */ (document.getElementById('gToast'));
    t.n = (t.n || 1) + 1;
  } else if (b.id === 'gFloat') pbFloat(b, '+120 Moneys');
  else if (b.id === 'gSheetBtn') /** @type {any} */ (document.getElementById('gSheet')).open = true;
  // UI-4: the reward motions on demand (the pictures take each part at its end)
  else if (b.id === 'gPayoutPlay') /** @type {any} */ (document.getElementById('gPayout')).play();
  else if (b.id === 'gPickFlip') {
    const c = /** @type {any} */ (document.getElementById('gPickDown'));
    if (c.facedown) c.reveal();
    else c.facedown = true;
  } else if (b.id === 'gStampPlay')
    // SY-3: each stamp slams on again, one after another
    document
      .querySelectorAll('#gStamps pb-stamp')
      .forEach((el, i) => setTimeout(() => /** @type {any} */ (el).play(), i * 160));
  else if (b.id === 'gCoinUp') {
    const c = /** @type {any} */ (document.querySelector('pb-coin[kind="research"]'));
    c.value += 1000;
  }
});

const toastEl = /** @type {any} */ (document.getElementById('gToast'));
toastEl.text = 'Found an item';
toastEl.n = 1;

// UI-2: the hand-written type pills get their glyphs, as typeBadgeHTML gives them in the game
document
  .querySelectorAll('.chip[data-ty]')
  .forEach(c => c.insertAdjacentHTML('afterbegin', typeGlyphHTML(/** @type {HTMLElement} */ (c).dataset.ty)));

// SY-3: the stamps say the data's words (factions.json look.stamps) and its first form number
const GD = /** @type {any} */ (globalThis).GAMEDATA || {},
  bureauLook = GD.factions?.factions?.bureau?.look;
if (bureauLook) {
  document.querySelectorAll('#gStamps pb-stamp').forEach(el => {
    const w = bureauLook.stamps[/** @type {HTMLElement} */ (el).dataset.k];
    if (w) el.setAttribute('word', w);
  });
  document.getElementById('gForm').textContent = bureauLook.forms[0];
  // SY-4: the case file's form number is the checkpoint's own (logic/case-file.js), its stamp the data's word
  const C = caseFile('bureau_checkpoint', GD.events?.events?.bureau_checkpoint, GD.factions);
  if (C) document.querySelectorAll('[data-case="form"]').forEach(el => (el.textContent = C.form));
  document.querySelectorAll('pb-stamp[data-case]').forEach(el => {
    const w = bureauLook.stamps[/** @type {HTMLElement} */ (el).dataset.case];
    if (w) el.setAttribute('word', w);
  });
}

// UI-3: the Studio's UI section shows this page in a frame (gallery.html?studio=1, without the bar) and hands it the
// look being edited: the theme, light or dark, the width, reduced motion, Settings' text size and the screen whose
// own colours and shapes to show (uiTheme.json overrides, through data-ui-screen)
if (new URLSearchParams(location.search).has('studio')) root.classList.add('g-studio');
/** @param {any} theme uiTheme.json as edited @param {{mode?: string, width?: string, reduced?: boolean,
 * text?: string, screen?: string}} [o] */
function galleryLook(theme, o = {}) {
  applyUiTheme(theme);
  root.dataset.theme = o.mode === 'dark' ? 'dark' : 'light';
  const wrap = /** @type {HTMLElement} */ (document.querySelector('.g-wrap'));
  if (o.width) wrap.style.setProperty('--g-w', o.width);
  if (o.reduced) root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
  if (o.text) root.dataset.text = o.text;
  else delete root.dataset.text;
  if (o.screen) wrap.dataset.uiScreen = o.screen;
  else delete wrap.dataset.uiScreen;
}
/** @type {any} */ (globalThis).galleryLook = galleryLook;
