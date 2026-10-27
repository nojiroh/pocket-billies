'use strict';
/* ================= COPPERLEAF'S SQUARE: THINGS TO DO (hub track HB-10d) =================
   The fountain's coin: a tap on the fountain asks whether to toss one (its price in Scrap, once each time you come
   home), then shows how it went (logic/fountain-wish.js has the rules: rules.json square.wish). Nothing here is sent
   anywhere: the debug log keeps the outcome's id only. A hub sheet only. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, render, toast } from './hooks.js';
import { RULES } from './game-data.js';
import { wishCan, wishToss } from './logic/fountain-wish.js';
import { escapeHtml, save, saveData } from './game-state.js';
import { soundEffect, soundEffectAt } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  fountainWishOpen: [() => fountainWishOpen, v => (fountainWishOpen = v)],
  fountainWishToss: [() => fountainWishToss, v => (fountainWishToss = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** tap the square's fountain: toss a coin, if you can @param {{ x: number, z: number }} [p] the fountain */
export function fountainWishOpen(p) {
  const s = saveData,
    R = RULES.square && RULES.square.wish;
  if (!R || !s.meta) return;
  if (s.run) {
    toast('The fountain burbles. Toss a coin when you’re home.');
    return;
  }
  const can = wishCan(s.meta, R),
    price = `<pb-coin kind="${R.cost.cur}" value="${R.cost.n}" label="Scrap"></pb-coin>`;
  if (can === 'done') {
    toast('You’ve tossed your coin. The fountain wants a new story first: come back after your next run.');
    return;
  }
  modal({
    title: 'Fountain',
    cls: 'wish-sheet',
    html:
      `<p>Toss a coin for luck? It costs ${price}, once each time you come home. Mostly it helps your next run a little. ` +
      `Now and then it doesn’t.</p>` +
      (can === 'poor' ? `<p class="note">You have ${s.meta[R.cost.cur] || 0} Scrap.</p>` : ''),
    btns: [
      ...(can === 'ok' ? [{ l: `Toss a coin (${R.cost.n} Scrap)`, f: () => fountainWishToss(p) }] : []),
      { l: 'Not now', c: 'quiet', f: closeModal },
    ],
  });
}

function fountainWishToss(p) {
  const R = RULES.square.wish,
    r = wishToss(saveData.meta, R);
  if (!r) {
    closeModal();
    return;
  }
  save();
  if (typeof debugLog !== 'undefined') debugLog.add('hub', `fountain coin: ${r.out.id}`);
  if (typeof soundEffect === 'function') soundEffect('coin');
  if (p && typeof soundEffectAt === 'function') setTimeout(() => soundEffectAt('plop', p.x, p.z), 350);
  /* queued before the ask closes, so the result comes next (before any window waiting its turn) */
  modal({
    title: 'Fountain',
    cls: 'wish-sheet',
    html: `<p>${escapeHtml(r.say)}</p>`,
    btns: [{ l: 'OK', f: closeModal }],
  });
  closeModal();
  render();
}
