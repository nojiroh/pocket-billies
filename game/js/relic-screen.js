'use strict';
/* ================= LOOPHOLES ON SCREEN (roguelite track RL-12) =================
   A run's Loopholes (relics.json; logic/relics.js, logic/effects.js) as the player sees them:
   - the pick after a mini-boss: the offer (saved on the run before it shows) as face-up pick cards; tap one, then
     "Take it", or "Take none". It can't be closed any other way, and a reload opens it again (run.js runResume);
   - past the cap a second sheet asks which Loophole to let go (the pick's and the shop's);
   - the Loopholes tab of a run's bottom bar: what you hold and what each does, "n of 6".
   Every change is saved at once (saveNow), as every other choice on a run. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, provide, render, renderOverlay, toast } from './hooks.js';
import { RELICS, RULES } from './game-data.js';
import { relicChoose } from './logic/relics.js';
import { escapeHtml, saveData, saveNow, uiState } from './game-state.js';
import { uiIconHTML } from './art.js';
import { jinglePlay } from './sound.js';
import { runHint } from './run.js';
/* eslint-disable no-func-assign */
expose({
  RELIC_RARITY: [() => RELIC_RARITY],
  relicCardHTML: [() => relicCardHTML, v => (relicCardHTML = v)],
  relicCardsOn: [() => relicCardsOn, v => (relicCardsOn = v)],
  relicDropOpen: [() => relicDropOpen, v => ((relicDropOpen = v), provide({ relicDropOpen }))],
  relicPickDone: [() => relicPickDone, v => (relicPickDone = v)],
  relicPickOpen: [() => relicPickOpen, v => ((relicPickOpen = v), provide({ relicPickOpen }))],
  relicPickTake: [() => relicPickTake, v => (relicPickTake = v)],
  relicSheet: [() => relicSheet, v => (relicSheet = v)],
  renderRelics: [() => renderRelics, v => (renderRelics = v)],
});
/* eslint-enable no-func-assign */
provide({ relicDropOpen, relicPickOpen });
/* to-module: end */
/** a rarity as the player reads it */
const RELIC_RARITY = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
/** a Loophole as a pick card (the pick, letting one go) @param {string} id @param {boolean} on */
function relicCardHTML(id, on) {
  const R = RELICS[id];
  return `<pb-pick-card data-id="${escapeHtml(id)}" heading="${escapeHtml(R.name)}" sub="${RELIC_RARITY[R.rarity] || ''}"${on ? ' selected' : ''}><span slot="art">${uiIconHTML('relic', 40)}</span>${escapeHtml(R.d)}</pb-pick-card>`;
}
/** show a sheet of this class in place when it is already up; otherwise ahead of any other (as the payout does) */
function relicSheet(M) {
  if (uiState.modal && uiState.modal.cls !== M.cls) uiState.mq.unshift(uiState.modal);
  uiState.mq = uiState.mq.filter(q => q.cls !== M.cls);
  uiState.modal = M;
  renderOverlay();
}
/** a pick card tapped on the open sheet: f(its Loophole's id) */
function relicCardsOn(f) {
  for (const c of document.querySelectorAll('#ov pb-pick-card[data-id]'))
    c.addEventListener('pb-pick', () => f(/** @type {HTMLElement} */ (c).dataset.id));
}

/* ---------- the pick after a mini-boss ---------- */
/** the run's offer as a sheet (nothing when there is none) */
export function relicPickOpen() {
  const run = saveData.run;
  if (!run || !run.offer) return;
  const rule = RULES.run.relics,
    ids = run.offer.filter(id => RELICS[id]),
    sel = ids.includes(uiState.relicSel) ? uiState.relicSel : null;
  relicSheet({
    title: 'Pick a Loophole',
    cls: 'relic-pick',
    lock: true,
    html: `<p>The mini-boss left a few loopholes behind. Take one for the rest of the run.</p><p class="note">You hold ${run.relics.length} of ${rule.cap}.${run.relics.length >= rule.cap ? ' Taking one means letting another go.' : ''}</p><div class="relic-cards">${ids.map(id => relicCardHTML(id, id === sel)).join('')}</div>`,
    btns: [
      { l: 'Take it', c: 'gold', dis: !sel, f: () => relicPickTake(/** @type {string} */ (sel)) },
      { l: 'Take none', c: 'quiet', f: () => relicPickDone(null) },
    ],
    after: () =>
      relicCardsOn(id => {
        uiState.relicSel = id;
        relicPickOpen();
      }),
  });
  runHint('relic');
}
/** "Take it": past the cap, which to let go first */
function relicPickTake(id) {
  const run = saveData.run;
  if (!run || !run.offer || !id) return;
  if (run.relics.length >= RULES.run.relics.cap) relicDropOpen(id, drop => relicPickDone(id, drop), relicPickOpen);
  else relicPickDone(id);
}
/** the pick answered (a Loophole, or none): saved, the sheet closed */
function relicPickDone(id, drop) {
  const run = saveData.run;
  if (!run) return;
  const why = relicChoose(run, id, RELICS, RULES.run.relics, drop);
  if (why) {
    toast('That Loophole can’t be taken.');
    return;
  }
  uiState.relicSel = null;
  saveNow();
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', `Loophole pick: ${id || 'none'}${drop ? ` for ${drop}` : ''}`);
  closeModal();
  render();
  if (id) toast(`${RELICS[id].name}: ${RELICS[id].d}`);
  /* SND-6: a Loophole taken has a jingle of its own */
  if (id && typeof jinglePlay === 'function') jinglePlay('relic');
}

/* ---------- past the cap: let one go ---------- */
/**
 * Which Loophole to let go for `id`: the held ones as cards; a tap answers `then(itsId)`; "Keep them" goes `back`.
 * @param {string} id @param {(drop: string) => void} then @param {() => void} back
 */
function relicDropOpen(id, then, back) {
  const run = saveData.run;
  if (!run || !RELICS[id]) return;
  relicSheet({
    title: 'Let one go',
    cls: 'relic-drop',
    lock: true,
    html: `<p>You can hold ${RULES.run.relics.cap} Loopholes. Tap one to let it go for ${escapeHtml(RELICS[id].name)}.</p><div class="relic-cards">${run.relics
      .filter(k => RELICS[k])
      .map(k => relicCardHTML(k, false))
      .join('')}</div>`,
    btns: [
      {
        l: 'Keep them',
        c: 'quiet',
        f: () => {
          uiState.modal = null;
          back();
        },
      },
    ],
    after: () =>
      relicCardsOn(drop => {
        uiState.modal = null;
        then(drop);
      }),
  });
}

/* ---------- the Loopholes tab ---------- */
/** the run's Loopholes, each with what it does */
export function renderRelics() {
  const run = saveData.run,
    cap = RULES.run.relics.cap;
  if (!run) return `<p class="note bag-empty">Loopholes come with a run. Start one at the airship mast.</p>`;
  const held = run.relics.filter(id => RELICS[id]);
  return `<section class="tpanel relics"><div class="sec-h"><h2>Loopholes</h2><span class="count tnum">${held.length} of ${cap}</span></div>${
    held.length
      ? `<div class="bag-list">${held
          .map(
            id =>
              `<div class="bag-row k-card"><span class="bag-ic">${uiIconHTML('relic', 30)}</span><span class="bag-t"><b>${escapeHtml(RELICS[id].name)}</b><small>${escapeHtml(RELICS[id].d)}</small></span><small class="note">${RELIC_RARITY[RELICS[id].rarity] || ''}</small></div>`
          )
          .join('')}</div>`
      : `<p class="note bag-empty">None yet. Beat a mini-boss for a pick of ${RULES.run.relics.pick}, or buy one in a town’s shop. They last the run.</p>`
  }</section>`;
}
