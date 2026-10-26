'use strict';
/* ================= THE REWARD PICK ON SCREEN (roguelite track RL-12b) =================
   The pick after a route trainer's battle (or an event's "reward"): run.enc.reward's cards (logic/rewards.js), saved
   before the sheet shows, as face-up pick cards. Tap one, then "Take it"; "Reroll" draws them again for Moneys (the
   price doubles each time); "Take none" leaves them. A tutor card asks which Billie learns the move, then, when its
   moves are full, which one it forgets. A held item's card (RL-12c) asks who holds it (or into the bag). The sheet can't be closed any other way, and a reload opens it again
   (run.js runResume). Every change is saved at once (saveNow). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, provide, render, renderOverlay, toast, typeBadgeHTML } from './hooks.js';
import { ITEMS, MOVES, PYRAMIDS, RULES } from './game-data.js';
import { billyName } from './logic/rules.js';
import { rewardDataGame, rewardReroll, rewardRerollCost, rewardTake, tutorWho } from './logic/rewards.js';
import { escapeHtml, saveData, saveNow, uiState } from './game-state.js';
import { moneyHTML, pyramidHTML } from './art.js';
import { bustHTML } from './skeleton-rig.js';
import { itemIcon } from './battle.js';
/* eslint-disable no-func-assign */
expose({
  rewardAnswer: [() => rewardAnswer, v => (rewardAnswer = v)],
  rewardCardHTML: [() => rewardCardHTML, v => (rewardCardHTML = v)],
  rewardDone: [() => rewardDone, v => (rewardDone = v)],
  rewardHolder: [() => rewardHolder, v => (rewardHolder = v)],
  rewardPickOpen: [() => rewardPickOpen, v => ((rewardPickOpen = v), provide({ rewardPickOpen }))],
  rewardSheet: [() => rewardSheet, v => (rewardSheet = v)],
  rewardTakeTap: [() => rewardTakeTap, v => (rewardTakeTap = v)],
  rewardTeach: [() => rewardTeach, v => (rewardTeach = v)],
  rewardThen: [() => rewardThen, v => (rewardThen = v)],
});
/* eslint-enable no-func-assign */
provide({ rewardPickOpen });
/* to-module: end */
/** what to do once the pick is answered (an event waits on it; lost on a reload) */
let rewardThen = /** @type {(() => void) | null} */ (null);

/** a card as a pick card @param {import('../types/save-data').RewardCard} c @param {number} k @param {boolean} on */
function rewardCardHTML(c, k, on) {
  const n = c.n && c.n > 1 ? `${c.n} × ` : '';
  if (c.kind === 'tutor') {
    const M = MOVES[/** @type {string} */ (c.move)] || { n: c.move, t: 'None', d: '' };
    return `<pb-pick-card data-k="${k}" heading="${escapeHtml(M.n)}" sub="Move tutor"${on ? ' selected' : ''}><span slot="art">${typeBadgeHTML(M.t)}</span>${escapeHtml(M.d || '')}${M.p ? ` Power ${M.p}.` : ''}</pb-pick-card>`;
  }
  if (c.item && c.item.startsWith('coin_')) {
    const P = PYRAMIDS[c.item.slice(5)] || { n: c.item, d: '' };
    return `<pb-pick-card data-k="${k}" heading="${escapeHtml(n + P.n)}" sub="Pyramid"${on ? ' selected' : ''}><span slot="art">${pyramidHTML(c.item.slice(5), 40)}</span>${escapeHtml(P.d || '')}</pb-pick-card>`;
  }
  const I = ITEMS[/** @type {string} */ (c.item)] || { n: c.item, d: '' },
    sub = c.kind === 'candy' ? 'Candy' : c.kind === 'evo' ? 'Evolution item' : c.kind === 'held' ? 'Held item' : 'Item';
  return `<pb-pick-card data-k="${k}" heading="${escapeHtml(n + I.n)}" sub="${sub}"${on ? ' selected' : ''}><span slot="art">${itemIcon(/** @type {string} */ (c.item), 40)}</span>${escapeHtml(I.d || '')}</pb-pick-card>`;
}
/** show the pick's sheet (in place when it is up; ahead of any other) */
function rewardSheet(M) {
  if (uiState.modal && uiState.modal.cls !== M.cls) uiState.mq.unshift(uiState.modal);
  uiState.mq = uiState.mq.filter(q => q.cls !== M.cls);
  uiState.modal = M;
  renderOverlay();
}

/** the run's reward pick as a sheet (nothing when there is none) @param {() => void} [then] */
export function rewardPickOpen(then) {
  if (then) rewardThen = then;
  const run = saveData.run,
    R = run && run.enc && run.enc.reward;
  if (!R) {
    rewardDone();
    return;
  }
  const sel = typeof uiState.rewardSel === 'number' && R.cards[uiState.rewardSel] ? uiState.rewardSel : null,
    cost = rewardRerollCost(R, RULES.run.rewards);
  rewardSheet({
    title: 'Pick a reward',
    cls: 'reward-pick',
    lock: true,
    html: `<p>${R.from.startsWith('event:') ? 'Take one.' : R.from.startsWith('quest:') ? 'A thank-you for the quest. Take one.' : 'Your opponent left a few things behind. Take one.'}</p><div class="relic-cards">${R.cards.map((c, k) => rewardCardHTML(c, k, k === sel)).join('')}</div>`,
    btns: [
      { l: 'Take it', c: 'gold', dis: sel == null, f: () => rewardTakeTap(/** @type {number} */ (sel)) },
      {
        l: `Reroll ${moneyHTML(cost, 12)}`,
        c: 'dark',
        dis: saveData.se < cost,
        f: () => {
          if (rewardReroll(run, saveData, rewardDataGame(saveData.team))) return;
          uiState.rewardSel = null;
          saveNow();
          if (typeof debugLog !== 'undefined') debugLog.add('scene', `reward reroll ${R.rolls}`);
          rewardPickOpen();
        },
      },
      { l: 'Take none', c: 'quiet', f: () => rewardAnswer(null) },
    ],
    after: () => {
      for (const c of document.querySelectorAll('#ov pb-pick-card[data-k]'))
        c.addEventListener('pb-pick', () => {
          uiState.rewardSel = +(/** @type {HTMLElement} */ (c).dataset.k);
          rewardPickOpen();
        });
    },
  });
}
/** "Take it": a tutor's move asks who learns it (and what it forgets) first @param {number} k */
function rewardTakeTap(k) {
  const run = saveData.run,
    R = run && run.enc && run.enc.reward,
    c = R && R.cards[k];
  if (!c) return;
  if (c.kind === 'held') {
    rewardHolder(k);
    return;
  }
  if (c.kind !== 'tutor') {
    rewardAnswer(k);
    return;
  }
  const D = rewardDataGame(saveData.team),
    who = tutorWho(/** @type {string} */ (c.move), D),
    M = MOVES[/** @type {string} */ (c.move)];
  rewardSheet({
    title: `Who learns ${escapeHtml(M.n)}?`,
    cls: 'reward-pick',
    lock: true,
    html: `<div class="list">${who.map(m => `<button class="pickrow" data-u="${m.uid}">${bustHTML(m.sp, 40, { coat: m.coat })}<span class="pr-t"><b>${escapeHtml(billyName(m))}</b><small>Lv ${m.lvl} · ${m.moves.length} of ${D.slots} moves</small></span></button>`).join('')}</div>`,
    btns: [{ l: 'Back', c: 'quiet', f: () => rewardPickOpen() }],
    after: () => {
      for (const b of document.querySelectorAll('#ov .pickrow[data-u]'))
        b.addEventListener('click', () => rewardTeach(k, /** @type {HTMLElement} */ (b).dataset.u || ''));
    },
  });
}
/** RL-12c: a held item's card: who holds it (one holding another gives that back to the bag), or into the bag
 * @param {number} k */
function rewardHolder(k) {
  const c = saveData.run.enc.reward.cards[k],
    I = ITEMS[c.item] || { n: c.item };
  rewardSheet({
    title: `Who holds the ${escapeHtml(I.n)}?`,
    cls: 'reward-pick',
    lock: true,
    html: `<div class="list">${saveData.team.map(m => `<button class="pickrow" data-u="${m.uid}">${bustHTML(m.sp, 40, { coat: m.coat })}<span class="pr-t"><b>${escapeHtml(billyName(m))}</b><small>Lv ${m.lvl} · ${m.held && ITEMS[m.held] ? `holding ${escapeHtml(ITEMS[m.held].n)}` : 'holding nothing'}</small></span></button>`).join('')}</div>`,
    btns: [
      { l: 'Into the bag', c: 'dark', f: () => rewardAnswer(k) },
      { l: 'Back', c: 'quiet', f: () => rewardPickOpen() },
    ],
    after: () => {
      for (const b of document.querySelectorAll('#ov .pickrow[data-u]'))
        b.addEventListener('click', () => rewardAnswer(k, { uid: /** @type {HTMLElement} */ (b).dataset.u || '' }));
    },
  });
}
/** a Billie picked for the tutor's move: with its moves full, which one goes @param {number} k @param {string} uid */
function rewardTeach(k, uid) {
  const D = rewardDataGame(saveData.team),
    m = saveData.team.find(b => b.uid === uid),
    c = saveData.run.enc.reward.cards[k];
  if (!m) return;
  if (m.moves.length < D.slots) {
    rewardAnswer(k, { uid });
    return;
  }
  rewardSheet({
    title: `${escapeHtml(billyName(m))} forgets…`,
    cls: 'reward-pick',
    lock: true,
    html: `<p class="note">To learn ${escapeHtml(MOVES[c.move].n)}, ${escapeHtml(billyName(m))} forgets one move.</p>`,
    btns: [
      ...m.moves.map(mv => ({ l: escapeHtml(MOVES[mv].n), c: 'dark', f: () => rewardAnswer(k, { uid, forget: mv }) })),
      { l: 'Back', c: 'quiet', f: () => rewardTakeTap(k) },
    ],
  });
}
/** the pick answered (a card, or none): saved, the sheet closed @param {number | null} k
 * @param {{ uid?: string, forget?: string }} [o] */
function rewardAnswer(k, o) {
  const run = saveData.run,
    R = run && run.enc && run.enc.reward;
  if (!R) return;
  const c = k == null ? null : R.cards[k],
    why = rewardTake(run, saveData, k, rewardDataGame(saveData.team), o);
  if (why) {
    toast('That can’t be taken.');
    return;
  }
  uiState.rewardSel = null;
  saveNow();
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', `reward pick: ${c ? c.id + (c.move ? ' ' + c.move : '') : 'none'}`);
  closeModal();
  render();
  if (c && c.kind === 'tutor' && o && o.uid) {
    const m = saveData.team.find(b => b.uid === o.uid);
    if (m) toast(`${billyName(m)} learned ${MOVES[/** @type {string} */ (c.move)].n}.`);
  } else if (c && c.kind === 'held' && o && o.uid) {
    const m = saveData.team.find(b => b.uid === o.uid);
    if (m && m.held === c.item) toast(`${billyName(m)} is holding the ${ITEMS[/** @type {string} */ (c.item)].n}.`);
  } else if (c && c.item) toast(`Into the bag.`);
  rewardDone();
}
/** an event waiting on the pick goes on */
function rewardDone() {
  const then = rewardThen;
  rewardThen = null;
  if (then) then();
}
