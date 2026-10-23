'use strict';
/* ================= THE LAB BOARD (roguelite track RL-11) =================
   The unlock table on screen (logic/unlocks.js, game/data/unlocks.json), in the hub's Lab tab (also opened by the
   machine in Professor Chosen's lab): the three meta currencies, then each building of buildings.json with its level and its
   rows (the Lab's are bought here; the others show here and are bought at their building), the Workshop as coming
   later, and the milestones (earned, or what earns them). Milestones are granted in the hub after a run and on load,
   with a toast for each. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, toast } from './hooks.js';
import { CURRENCIES, RULES, UNLOCK_DATA } from './game-data.js';
import { formatNumber } from './logic/rules.js';
import { ranchNow } from './logic/ranch-clock.js';
import { incomeBank } from './logic/ranch-income.js';
import { buildingLevel, unlockAuto, unlockBuy, unlockCurrency, unlockReady, unlockRows } from './logic/unlocks.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { uiIconHTML } from './art.js';
import { flyMenu } from './airship.js';
import { ranchOpen } from './ranch-screen.js';
/* eslint-disable no-func-assign */
expose({
  LAB_WHERE: [() => LAB_WHERE],
  LAB_WHY: [() => LAB_WHY],
  buildingLabel: [() => buildingLabel, v => ((buildingLabel = v), provide({ buildingLabel }))],
  buildingRowsHTML: [() => buildingRowsHTML, v => ((buildingRowsHTML = v), provide({ buildingRowsHTML }))],
  labAction: [() => labAction, v => (labAction = v)],
  labBoardOpen: [() => labBoardOpen, v => (labBoardOpen = v)],
  labBuy: [() => labBuy, v => (labBuy = v)],
  labMilestones: [() => labMilestones, v => ((labMilestones = v), provide({ labMilestones }))],
  labPrice: [() => labPrice, v => (labPrice = v)],
  labRowHTML: [() => labRowHTML, v => (labRowHTML = v)],
  renderLabBoard: [() => renderLabBoard, v => (renderLabBoard = v)],
  unlockGiftText: [() => unlockGiftText, v => (unlockGiftText = v)],
});
/* eslint-enable no-func-assign */
provide({ buildingLabel, buildingRowsHTML, labMilestones });
/* to-module: end */
/** what an unlock gives, in a few words: "+10 Scrap", or its name @param {any} R */
function unlockGiftText(R) {
  const G = R.grant || {};
  for (const c of ['capital', 'scrap', 'seals'])
    if (G[c]) {
      const C = CURRENCIES[c] || { name: c, one: c };
      return `+${formatNumber(G[c])} ${G[c] === 1 ? C.one : C.name}`;
    }
  return R.name;
}
/** grant the milestones whose condition holds now (in the hub only), each with a toast; saves when any was granted.
 * Returns their ids */
export function labMilestones() {
  if (!saveData || !saveData.meta || saveData.run) return [];
  const got = unlockAuto(saveData, UNLOCK_DATA);
  if (!got.length) return got;
  for (const id of got) {
    const R = UNLOCK_DATA.unlocks[id];
    toast(`Milestone: ${R.name}. ${unlockGiftText(R)}.`);
  }
  if (typeof debugLog !== 'undefined') debugLog.add('meta', `milestones: ${got.join(', ')}`);
  save();
  return got;
}

/* why a row can't be bought, in words (logic/unlocks.js unlockReady) */
const LAB_WHY = {
  owned: 'Owned',
  earned: 'Earned by a milestone',
  soon: 'Coming later',
  requires: 'Needs another unlock first',
  run: 'Bought between runs',
  cost: 'Not enough',
  unknown: 'Gone',
};
/** where a building's rows are bought, for its section */
const LAB_WHERE = { airship: 'at the airship mast', ranch: 'at the ranch' };
/** a price: "60 Research", "1 Crest" @param {number} n @param {string | null} c */
function labPrice(n, c) {
  const C = (c && CURRENCIES[c]) || { name: c || '', one: c || '' };
  return `${formatNumber(n)} ${n === 1 ? C.one : C.name}`;
}
/** one row of the board: its name, what it gives, what it needs, and its button or state; `then` (a building's own
 * sheet: 'ranch', 'fly') gives its building's rows a button too, and says which sheet to draw again after
 * @param {any} r @param {string} [then] */
function labRowHTML(r, then) {
  const R = r.R,
    needs = (R.requires || [])
      .filter(q => !saveData.meta.unlocks[q])
      .map(q => (UNLOCK_DATA.unlocks[q] || { name: q }).name),
    note = needs.length ? `<small>Needs ${escapeHtml(needs.join(', '))}</small>` : '';
  let act = '';
  if (r.owned)
    act = `<span class="lab-state on">${uiIconHTML('spark', 14)}${r.door === 'earned' ? 'Earned' : 'Owned'}</span>`;
  else if (r.door === 'earned') act = `<span class="lab-state">Not yet</span>`;
  else if (r.door === 'board' || then)
    act = `<button class="pb small${r.why ? ' quiet' : ' gold'}" data-a="lab-buy" data-k="${escapeHtml(r.id)}"${then ? ` data-then="${then}"` : ''}${r.why ? ' disabled' : ''} aria-label="${escapeHtml(`Buy ${R.name} for ${labPrice(R.cost, r.currency)}`)}">${escapeHtml(labPrice(R.cost, r.currency))}</button>`;
  else act = `<span class="lab-state">${escapeHtml(labPrice(R.cost, r.currency))}</span>`;
  return `<div class="lab-row k-card${r.owned ? ' owned' : ''}"><span class="lab-t"><b>${escapeHtml(R.name)}</b><small>${escapeHtml(R.about)}</small>${note}${!r.owned && r.why && r.why !== 'cost' && r.why !== 'requires' && r.door === 'board' ? `<small>${LAB_WHY[r.why]}</small>` : ''}</span>${act}</div>`;
}
/** a building's rows not yet owned, with their buttons, for its own sheet (the ranch's, the mast's); '' when every
 * one is owned @param {string} b @param {string} then */
function buildingRowsHTML(b, then) {
  const rows = unlockRows(saveData, UNLOCK_DATA).filter(r => r.R.at === b && !r.owned);
  return rows.length ? `<div class="lab-list">${rows.map(r => labRowHTML(r, then)).join('')}</div>` : '';
}
/** a hub building's label with its level ("Ranch · Lv 2"): a building of buildings.json with levels, in Copperleaf
 * (not in a room, not on a run) @param {string} label @param {string} act */
function buildingLabel(label, act) {
  if (saveData.run || uiState.inside) return label;
  for (const [b, B] of Object.entries(UNLOCK_DATA.buildings))
    if (B.act === act && B.levels > 1) return `${label} · Lv ${buildingLevel(saveData, b)}`;
  return label;
}
/** the Lab tab: the unlock board */
export function renderLabBoard() {
  const s = saveData,
    M = s.meta,
    rows = unlockRows(s, UNLOCK_DATA),
    chips = ['capital', 'scrap', 'seals']
      .map(
        c =>
          `<pb-coin kind="${c}" value="${M[c]}" label="${escapeHtml((CURRENCIES[c] || { name: c }).name)}"></pb-coin>`
      )
      .join(' '),
    owned = rows.filter(r => r.owned).length;
  const sections = Object.entries(UNLOCK_DATA.buildings).map(([b, B]) => {
    const mine = rows.filter(r => r.R.at === b),
      lv = buildingLevel(s, b),
      head = `<div class="sec-h"><h2>${escapeHtml(B.name)}${B.levels > 1 ? ` · Lv ${lv}` : ''}</h2>${mine.length ? `<span class="count tnum">${mine.filter(r => r.owned).length} of ${mine.length}</span>` : ''}</div>`;
    if (B.soon)
      return `<section class="tpanel lab-sec soon">${head}<p class="note">${escapeHtml(B.about)}</p></section>`;
    const where = LAB_WHERE[b]
      ? `<p class="note">Bought ${LAB_WHERE[b]}, with ${escapeHtml((CURRENCIES[B.currency] || { name: B.currency }).name)}.</p>`
      : '';
    return `<section class="tpanel lab-sec">${head}<p class="note">${escapeHtml(B.about)}</p>${where}<div class="lab-list">${mine.map(labRowHTML).join('')}</div></section>`;
  });
  const earned = rows.filter(r => r.door === 'earned');
  if (earned.length)
    sections.push(
      `<section class="tpanel lab-sec"><div class="sec-h"><h2>Milestones</h2><span class="count tnum">${earned.filter(r => r.owned).length} of ${earned.length}</span></div><p class="note">Earned in Copperleaf after a run.</p><div class="lab-list">${earned.map(labRowHTML).join('')}</div></section>`
    );
  return `<header class="bar"><div><div class="sub">${owned} of ${rows.length} unlocked</div><h1 class="where">Lab</h1></div></header>
 <p class="lab-chips">${chips}</p>
 ${s.run ? '<p class="note">The Lab’s board waits for you in Copperleaf: unlocks are bought between runs.</p>' : ''}${sections.join('')}`;
}
/** a sold row bought from a screen (the board, the ranch, the mast): paid, granted, saved; true when it was bought
 * @param {string} id */
export function labBuy(id) {
  const R = UNLOCK_DATA.unlocks[id];
  if (!R) return false;
  const why = unlockReady(saveData, id, UNLOCK_DATA);
  if (why) {
    toast(
      why === 'cost'
        ? `Not enough ${(CURRENCIES[unlockCurrency(R, UNLOCK_DATA) || ''] || { name: '' }).name}.`
        : `${LAB_WHY[why]}.`
    );
    return false;
  }
  /* RL-10b: the ranch's income so far banked at the old level's rate before an upgrade changes it */
  if (RULES.ranch && RULES.ranch.income && saveData.ranch.income.lastAt)
    incomeBank(saveData, ranchNow(saveData, Date.now(), RULES.ranch).now, RULES.ranch);
  unlockBuy(saveData, id, UNLOCK_DATA);
  if (typeof debugLog !== 'undefined') debugLog.add('meta', `bought ${id}`);
  toast(`Unlocked: ${R.name}.`);
  save();
  render();
  return true;
}
/** the machine in the Chosen's lab: the board, in the hub */
export function labBoardOpen() {
  if (saveData.run) {
    toast('The Lab’s board waits for you in Copperleaf.');
    return;
  }
  uiState.tab = 'lab';
  render();
  scrollTo(0, 0);
}
/** the board's buttons (ui.js's click switch) @param {string} a @param {DOMStringMap} d */
export function labAction(a, d) {
  if (a !== 'lab-buy' || !d.k || !labBuy(d.k)) return;
  /* bought on a building's sheet: that sheet again, with its new level */
  if (d.then === 'ranch' && typeof ranchOpen === 'function') ranchOpen();
  else if (d.then === 'fly' && typeof flyMenu === 'function') {
    /* in place of the open sheet (a second one would wait behind it) */
    uiState.modal = null;
    flyMenu(uiState.flyAt);
  }
}
