'use strict';
/* ================= THE PAYOUT SCREEN (roguelite track RL-8) =================
   Where a run ends (won, lost or given up; run.at.phase 'payout', so a reload opens it again): what the run brought
   home as Capital (logic/run-state.js payoutOf, its rows in the payout screen's words from logic/run-loop.js
   runPayoutRows), the Audit Seal a win adds, and on a loss the keep-one picker: one Billie of the party brings its run
   home (one from Copperleaf keeps what it learned, one caught on the run comes home); on a win everyone does (the
   owner's answer). Everyone else from Copperleaf comes back as they left. "Fly home" ends the run (run.js runEndHome).
   Built from the run parts (js/ui-run-kit.js: pb-payout, pb-coin, pb-pick-card) in a sheet. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, renderOverlay } from './hooks.js';
import { ITEMS, RULES } from './game-data.js';
import { billyName } from './logic/rules.js';
import { payoutOf } from './logic/run-state.js';
import { runPayoutRows, runReleasePays } from './logic/run-loop.js';
import { escapeHtml, saveData, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { runEndHome } from './run.js';
/* eslint-disable no-func-assign */
expose({
  runItemPrice: [() => runItemPrice],
  runPayoutDone: [() => runPayoutDone, v => (runPayoutDone = v)],
  runPayoutNow: [() => runPayoutNow, v => (runPayoutNow = v)],
  runPayoutOpen: [() => runPayoutOpen, v => ((runPayoutOpen = v), provide({ runPayoutOpen }))],
});
/* eslint-enable no-func-assign */
provide({ runPayoutOpen });
/* to-module: end */
/** an item's shop price, for the payout's items line (0 for none) @param {string} id */
const runItemPrice = id => (ITEMS[id] && ITEMS[id].price) || 0;
/** what the run pays as it stands: the same sum runEnd pays */
function runPayoutNow() {
  const s = saveData,
    run = s.run;
  return payoutOf(
    { se: s.se, items: s.items, released: run.released.length, cleared: new Set(run.path).size, won: !!run.at.won },
    RULES.run.payout,
    runItemPrice
  );
}
/** the payout screen: the sheet, locked (only "Fly home" leaves it); its rows play in once */
function runPayoutOpen() {
  const run = saveData.run;
  if (!run || run.at.phase !== 'payout') return;
  const won = !!run.at.won,
    pay = runPayoutNow(),
    rows = runPayoutRows(pay, RULES.run.payout),
    keep = uiState.runKeep,
    cards = won
      ? ''
      : `<p class="note">Pick one Billie to bring its run home. One from Copperleaf keeps what it learned; one caught on the run comes home with you. Everyone else from Copperleaf comes back as they left.</p><div class="bx-grid">${saveData.team
          .map(
            m =>
              `<pb-pick-card data-u="${m.uid}" heading="${escapeHtml(billyName(m))}" sub="${`Lv ${m.lvl} · ${runReleasePays(run, m) ? 'caught on the run' : 'from Copperleaf'}`}"${keep === m.uid ? ' selected' : ''}><span slot="art">${rigCanvasHTML(m.sp, 64, { build: m.build, coat: m.coat })}</span></pb-pick-card>`
          )
          .join('')}</div>`;
  const M = {
    title: won ? 'You beat the run' : 'The run is over',
    cls: 'run-payout',
    lock: true,
    html: `<p>${won ? 'The boss is down. The airship takes everyone home, with all they learned.' : 'The airship comes for you. What you found turns into Capital, for the Lab.'}</p><pb-payout rows="${escapeHtml(JSON.stringify(rows))}" total="${pay.capital}" total-label="Capital"></pb-payout>${pay.seals || pay.scrap ? `<p>${pay.scrap ? `<pb-coin kind="scrap" value="${pay.scrap}" label="Scrap, for the Ranch"></pb-coin> ` : ''}${pay.seals ? `<pb-coin kind="seals" value="${pay.seals}" label="Audit Seal"></pb-coin>` : ''}</p>` : ''}${cards}`,
    btns: [{ l: 'Fly home', c: 'gold', dis: !won && !saveData.team.some(m => m.uid === keep), f: runPayoutDone }],
    after: () => {
      const el = /** @type {any} */ (document.querySelector('#ov pb-payout'));
      if (el && !uiState.runPayoutPlayed && typeof el.play === 'function') {
        uiState.runPayoutPlayed = true;
        el.play();
      } else if (el && typeof el.finish === 'function') el.finish();
      for (const c of document.querySelectorAll('#ov pb-pick-card'))
        c.addEventListener('pb-pick', () => {
          uiState.runKeep = /** @type {HTMLElement} */ (c).dataset.u;
          runPayoutOpen();
        });
    },
  };
  /* it comes first: opened again (a card picked) in place; any other sheet waits behind it */
  if (uiState.modal && uiState.modal.cls !== 'run-payout') uiState.mq.unshift(uiState.modal);
  uiState.mq = uiState.mq.filter(q => q.cls !== 'run-payout');
  uiState.modal = M;
  renderOverlay();
}
/** "Fly home": the kept Billies (the whole party on a win), then the run ends */
function runPayoutDone() {
  const run = saveData.run;
  if (!run) return;
  const won = !!run.at.won,
    keep = won ? saveData.team.map(m => m.uid) : saveData.team.filter(m => m.uid === uiState.runKeep).map(m => m.uid);
  if (!won && !keep.length) return;
  uiState.runKeep = null;
  uiState.runPayoutPlayed = false;
  runEndHome(won, keep, runItemPrice);
}
