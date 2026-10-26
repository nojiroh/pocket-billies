'use strict';
/* ================= THE PAYOUT SCREEN (roguelite track RL-8) =================
   Where a run ends (won, lost or given up; run.at.phase 'payout', so a reload opens it again): what the run brought
   home as Research (logic/run-state.js payoutOf, its rows in the payout screen's words from logic/run-loop.js
   runPayoutRows), the Crest a win adds, and on a loss the keep-one picker: one Billie of the party brings its run
   home (one from Copperleaf keeps what it learned, one caught on the run comes home); on a win everyone does (the
   owner's answer). Everyone else from Copperleaf comes back as they left. RL-9b: on a win the bag goes home (no items
   row), on a loss it is paid as Research. "Fly home" ends the run (run.js runEndHome). RS-2: who is moving to
   Copperleaf (run.invited, won or lost: logic/run-state.js runEnd settles it after this screen).
   Built from the run parts (js/ui-run-kit.js: pb-payout, pb-coin, pb-pick-card) in a sheet. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, renderOverlay } from './hooks.js';
import { PERKS, QUESTS, RESIDENTS, RULES } from './game-data.js';
import { graftOf } from './logic/graft-art.js';
import { billyName } from './logic/rules.js';
import { payoutOf } from './logic/run-state.js';
import { runItemPrice, runKept, runPayoutRows, runReleasePays } from './logic/run-loop.js';
import { fxOfRun, fxPayoutRates } from './logic/effects.js';
import { escapeHtml, saveData, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { jinglePlay } from './sound.js';
import { runEndHome } from './run.js';
/* eslint-disable no-func-assign */
expose({
  runPayoutDone: [() => runPayoutDone, v => (runPayoutDone = v)],
  runPayoutNow: [() => runPayoutNow, v => (runPayoutNow = v)],
  runPayoutOpen: [() => runPayoutOpen, v => ((runPayoutOpen = v), provide({ runPayoutOpen }))],
});
/* eslint-enable no-func-assign */
provide({ runPayoutOpen });
/* to-module: end */
/** what the run pays as it stands: the same sum runEnd pays */
function runPayoutNow() {
  const s = saveData,
    run = s.run;
  return payoutOf(
    { se: s.se, items: s.items, released: run.released.length, cleared: new Set(run.path).size, won: !!run.at.won },
    fxPayoutRates(fxOfRun(run, PERKS), RULES.run.payout),
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
    who = run.invited && RESIDENTS[run.invited],
    moving = who ? `<p class="run-moving">${escapeHtml(QUESTS.invite.moving.replace(/\{name\}/g, who.name))}</p>` : '',
    cards = won
      ? ''
      : `<p class="note">Pick one Billie to bring its run home. One from Copperleaf keeps what it learned; one caught on the run comes home with you. Everyone else from Copperleaf comes back as they left.</p><div class="bx-grid">${saveData.team
          .map(
            m =>
              `<pb-pick-card data-u="${m.uid}" heading="${escapeHtml(billyName(m))}" sub="${`Lv ${m.lvl} · ${runReleasePays(run, m) ? 'caught on the run' : 'from Copperleaf'}`}"${keep === m.uid ? ' selected' : ''}><span slot="art">${rigCanvasHTML(m.sp, 64, { build: m.build, coat: m.coat, graft: graftOf(m) })}</span></pb-pick-card>`
          )
          .join('')}</div>`;
  const M = {
    title: won ? 'You beat the run' : 'The run is over',
    cls: 'run-payout',
    lock: true,
    html: `<p>${won ? 'The boss is down. The airship takes everyone home, with all they learned, and your bag goes into Copperleaf’s.' : 'The airship comes for you. What you found turns into Research, for the Lab.'}</p><pb-payout rows="${escapeHtml(JSON.stringify(rows))}" total="${pay.research}" total-label="Research"></pb-payout>${moving}${pay.crests || pay.scrap ? `<p>${pay.scrap ? `<pb-coin kind="scrap" value="${pay.scrap}" label="Scrap, for the Ranch"></pb-coin> ` : ''}${pay.crests ? `<pb-coin kind="crests" value="${pay.crests}" label="Crest"></pb-coin>` : ''}</p>` : ''}${cards}`,
    btns: [{ l: 'Fly home', c: 'gold', dis: !won && !saveData.team.some(m => m.uid === keep), f: runPayoutDone }],
    after: () => {
      const el = /** @type {any} */ (document.querySelector('#ov pb-payout'));
      /* SND-6: a coin for each row as it shows, a step higher each, then the run's end when the total lands: run_won
         (the victory tune, then the title's motif: the run's last bookend, the first plays as the airship leaves the
         mast) or run_lost. Once, however often the sheet is drawn again (a card picked) */
      if (el) {
        el.addEventListener('pb-payout-row', (/** @type {any} */ e) => {
          if (typeof jinglePlay === 'function') jinglePlay('payout_coin', { shift: 2 * e.detail.i, duck: false });
        });
        el.addEventListener('pb-payout-total', () => {
          if (uiState.runPayoutSung) return;
          uiState.runPayoutSung = true;
          if (typeof jinglePlay === 'function') jinglePlay(won ? 'run_won' : 'run_lost');
        });
      }
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
    keep = runKept(saveData.team, won, uiState.runKeep);
  if (!won && !keep.length) return;
  uiState.runKeep = null;
  uiState.runPayoutPlayed = false;
  uiState.runPayoutSung = false;
  runEndHome(won, keep, runItemPrice);
}
