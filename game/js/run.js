'use strict';
/* ================= THE RUN ON THE PAGE (roguelite track RL-8) =================
   The run loop as the player meets it: starting a run at Copperleaf's airship mast, the checkpoints it saves, a
   reload picking it up where it was, giving up, and the end (the payout screen is run-payout.js). The rules it plays
   by are logic/run-loop.js, logic/run-map.js and logic/run-state.js; the run's world is run-world.js.
   Storage stays in Copperleaf during a run (logic/rules.js allBillies, toBox, toTeam, addBilly): a Billie caught while
   the party is full waits in runCatch, never in the save (a team of seven can't be saved), until one is released. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, provide, render, toast } from './hooks.js';
import { billyName } from './logic/rules.js';
import { runRelease, runReleasePays } from './logic/run-loop.js';
import { escapeHtml, save, saveData } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
/* eslint-disable no-func-assign */
expose({
  runCatch: [() => runCatch],
  runReleasePick: [() => runReleasePick, v => (runReleasePick = v)],
  runReleaseSheet: [() => runReleaseSheet, v => ((runReleaseSheet = v), provide({ runReleaseSheet }))],
});
/* eslint-enable no-func-assign */
provide({ runReleaseSheet });
/* to-module: end */
/** a Billie caught on a run while the party was full, waiting for the release sheet (page state only) */
const runCatch = { m: /** @type {any} */ (null) };
provide({ runCatch }); /* to-module */
/** the sheet after a catch with a full party: who leaves the party, the new one included. One caught on the run is
 * paid as Capital at the end (logic/run-loop.js runRelease); one from Copperleaf only leaves the party */
function runReleaseSheet() {
  const m = runCatch.m;
  if (!m || !saveData.run) return null;
  const all = saveData.team.concat([m]),
    row = (o, i) =>
      `<button class="pickrow" data-a="mact" data-i="${i}">${rigCanvasHTML(o.sp, 40, { build: o.build, coat: o.coat })}<span class="pr-t"><b>${escapeHtml(billyName(o))}</b><small>Lv ${o.lvl}${o === m ? ', just taxed' : ''}${runReleasePays(saveData.run, o) ? '' : ', from Copperleaf: comes home at the end'}</small></span></button>`;
  return {
    title: 'Your party is full',
    lock: true,
    html: `<p>Six can travel on a run. Pick who leaves the party. A Billie caught on the run is paid for in Capital at the end.</p><div class="list">${all.map(row).join('')}</div>`,
    acts: all.map(o => ({ f: () => runReleasePick(o) })),
    btns: [],
  };
}
/** the release sheet's choice: that Billie leaves the party; the new one joins unless it was the one let go */
function runReleasePick(o) {
  const m = runCatch.m;
  if (!m || !saveData.run) return;
  runCatch.m = null;
  if (o === m) {
    if (runReleasePays(saveData.run, m)) saveData.run.released.push({ sp: m.sp, lvl: m.lvl });
  } else {
    runRelease(saveData, o);
    saveData.team.push(m);
    if (saveData.buddy === o.uid) saveData.buddy = saveData.team[0].uid;
  }
  save();
  closeModal();
  render();
  toast(`${billyName(o)} left the party.`);
}
