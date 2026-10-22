'use strict';
/* ================= THE RANCH SCREEN (roguelite track RL-9) =================
   Copperleaf's ranch, the barn by the farm: a tap on its door walks you in (int_barn), a tap on the training board or
   the rancher opens this sheet. It collects what the trainees banked since you were last here (logic/ranch.js
   ranchCollect), then shows the ranch's level and your Scrap, the Billies training (each with the hours it has
   banked, at most rules.json ranch.bankHours, and its level so far) and storage: each Billie resting there can start
   training (for Scrap) or join the team. Opening the sheet collects, so a trainee's card shows its way to the next
   level; time away past bankHours is lost, so the sheet says how long it banks. Every change is saved at once. Storage stays home during a run, so the
   ranch's sheet is the hub's only. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { buildingRowsHTML, closeModal, modal, render, renderOverlay, toast, xpProgress } from './hooks.js';
import { RULES } from './game-data.js';
import { billyName, teamSize, toTeam } from './logic/rules.js';
import {
  ranchCanTrain,
  ranchCap,
  ranchCollect,
  ranchLevel,
  ranchSlots,
  ranchStop,
  ranchTrainStart,
} from './logic/ranch.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
/* eslint-disable no-func-assign */
expose({
  RANCH_WHY: [() => RANCH_WHY],
  ranchCardHTML: [() => ranchCardHTML, v => (ranchCardHTML = v)],
  ranchDo: [() => ranchDo, v => (ranchDo = v)],
  ranchOpen: [() => ranchOpen, v => (ranchOpen = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const RANCH_WHY = {
  run: 'Storage stays home on a run',
  stored: 'Only Billies in storage train',
  training: 'Training',
  full: 'Every slot is busy',
  cap: 'Trained as far as the ranch goes',
  scrap: 'Not enough Scrap',
};
/** one Billie's card on the ranch's sheet: its picture, name and level, a line under it and its buttons */
function ranchCardHTML(m, sub, btns) {
  return `<div class="bx k-card ranch-card"><div class="bx-main"><span class="bx-spr">${rigCanvasHTML(m.sp, 56, { build: m.build, coat: m.coat })}</span><b>${escapeHtml(billyName(m))}</b><span class="bx-sub tnum">Lv ${m.lvl}</span>${sub}</div>${btns}</div>`;
}
/** the ranch's sheet, opened (or drawn again in place after a button) */
export function ranchOpen() {
  const s = saveData,
    R = RULES.ranch;
  if (!R || s.run) {
    toast('The ranch is closed while you’re away on a run.');
    return;
  }
  const now = Date.now();
  ranchCollect(s, now, R, t => toast(t));
  save();
  const slots = ranchSlots(s, R),
    cap = ranchCap(s, R),
    training = s.ranch.trainees.map(t => ({ t, m: s.box.find(b => b.uid === t.uid) })).filter(x => x.m),
    resting = s.box.filter(m => !s.ranch.trainees.some(t => t.uid === m.uid)),
    full = s.team.length >= teamSize();
  const trainHTML = training.length
    ? `<div class="bx-grid">${training
        .map(({ m }) => {
          const next = (1 - xpProgress(m)) / R.levelsPerHour;
          return ranchCardHTML(
            m,
            `<pb-stat-bar kind="xp" value="${Math.round(xpProgress(m) * 100)}" max="100"></pb-stat-bar><span class="bx-sub">${m.lvl >= cap ? `At Lv ${cap}, the ranch’s most` : `Lv ${m.lvl + 1} in about ${next < 1 ? `${Math.max(1, Math.round(next * 60))} min` : `${next.toFixed(1)} h`}`}</span>`,
            `<button class="qk k-btn" data-r="stop" data-u="${m.uid}">Stop</button>`
          );
        })
        .join('')}</div>`
    : `<p class="note">Nobody is training. Pick a Billie from storage below.</p>`;
  const restHTML = resting.length
    ? `<div class="bx-grid">${resting
        .map(m => {
          const why = ranchCanTrain(s, m.uid, R);
          return ranchCardHTML(
            m,
            why && why !== 'scrap' && why !== 'full' ? `<span class="bx-sub">${RANCH_WHY[why]}</span>` : '',
            `<button class="qk k-btn" data-r="train" data-u="${m.uid}"${why ? ' disabled' : ''}>Train · ${R.trainCost} Scrap</button><button class="qk k-btn" data-r="team" data-u="${m.uid}"${full ? ' disabled' : ''}>${full ? 'Team full' : 'To team'}</button>`
          );
        })
        .join('')}</div>`
    : `<p class="note">Storage is empty. When your team is full, new Billies rest here.</p>`;
  const M = {
    title: `The ranch · Lv ${ranchLevel(s)}`,
    cls: 'ranch-sheet',
    html: `<p class="ranch-head"><pb-coin kind="scrap" value="${s.meta.scrap}" label="Scrap"></pb-coin> <span class="note">Ranch level ${ranchLevel(s)} · trains up to Lv ${cap} · ${R.levelsPerHour < 1 ? `a level every ${+(1 / R.levelsPerHour).toFixed(1)} h` : `${R.levelsPerHour} levels an hour`}, banking up to ${R.bankHours} h between visits</span></p><section class="tpanel"><div class="sec-h"><h2>Training</h2><span class="count tnum">${training.length} of ${slots}</span></div>${trainHTML}</section><section class="tpanel"><div class="sec-h"><h2>Storage</h2><span class="count tnum">${resting.length}</span></div>${restHTML}</section>${typeof buildingRowsHTML === 'function' && buildingRowsHTML('ranch', 'ranch') ? `<section class="tpanel"><div class="sec-h"><h2>Upgrades</h2></div>${buildingRowsHTML('ranch', 'ranch')}</section>` : ''}<p class="note">Runs bring Scrap home: a little for every place you reach.</p>`,
    btns: [{ l: 'Done', c: 'gold', f: closeModal }],
    after: () => {
      for (const b of document.querySelectorAll('#ov .ranch-sheet [data-r]'))
        b.addEventListener('click', () =>
          ranchDo(/** @type {HTMLElement} */ (b).dataset.r, /** @type {HTMLElement} */ (b).dataset.u)
        );
    },
  };
  /* drawn again in place (a button pressed); any other sheet waits behind it */
  if (uiState.modal && uiState.modal.cls === 'ranch-sheet') {
    uiState.modal = M;
    renderOverlay();
  } else modal(M);
}
/** a button on the ranch's sheet: start or stop training, or bring a Billie onto the team; saved, then drawn again */
function ranchDo(what, uid) {
  const s = saveData,
    R = RULES.ranch,
    now = Date.now(),
    m = s.box.find(b => b.uid === uid);
  if (!m || !R) return;
  if (what === 'train') {
    const why = ranchTrainStart(s, uid, now, R);
    toast(why ? `${RANCH_WHY[why]}.` : `${billyName(m)} starts training.`);
  } else if (what === 'stop') {
    const got = ranchStop(s, uid, now, R, t => toast(t));
    if (got && !got.up) toast(`${billyName(m)} stops training.`);
  } else if (what === 'team') {
    if (s.team.length >= teamSize() || !toTeam(m)) return;
    toast(`${billyName(m)} joins your team.`);
  }
  if (typeof debugLog !== 'undefined')
    debugLog.add('ranch', `${what}: ${s.ranch.trainees.length} training, ${s.meta.scrap} Scrap`);
  save();
  render();
  ranchOpen();
}
