'use strict';
/* ================= PERKS ON SCREEN (roguelite track RL-12) =================
   A run's Perks (perks.json; logic/perks.js, logic/effects.js) as the player sees them:
   - the pick after a mini-boss: the offer (saved on the run before it shows) as face-up pick cards; tap one, then
     "Take it", or "Take none". It can't be closed any other way, and a reload opens it again (run.js runResume);
   - past the cap a second sheet asks which Perk to let go (the pick's and the shop's);
   - the Perks tab of a run's bottom bar: what you hold and what each does, "n of 6".
   Every change is saved at once (saveNow), as every other choice on a run. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, provide, render, renderOverlay, toast } from './hooks.js';
import { PERKS, RULES } from './game-data.js';
import { perkChoose } from './logic/perks.js';
import { escapeHtml, saveData, saveNow, uiState } from './game-state.js';
import { uiIconHTML } from './art.js';
import { jinglePlay } from './sound.js';
import { runHint } from './run.js';
/* eslint-disable no-func-assign */
expose({
  PERK_RARITY: [() => PERK_RARITY],
  perkCardHTML: [() => perkCardHTML, v => (perkCardHTML = v)],
  perkCardsOn: [() => perkCardsOn, v => (perkCardsOn = v)],
  perkDropOpen: [() => perkDropOpen, v => ((perkDropOpen = v), provide({ perkDropOpen }))],
  perkPickDone: [() => perkPickDone, v => (perkPickDone = v)],
  perkPickOpen: [() => perkPickOpen, v => ((perkPickOpen = v), provide({ perkPickOpen }))],
  perkPickTake: [() => perkPickTake, v => (perkPickTake = v)],
  perkSheet: [() => perkSheet, v => (perkSheet = v)],
  renderPerks: [() => renderPerks, v => (renderPerks = v)],
});
/* eslint-enable no-func-assign */
provide({ perkDropOpen, perkPickOpen });
/* to-module: end */
/** a rarity as the player reads it */
const PERK_RARITY = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
/** a Perk as a pick card (the pick, letting one go) @param {string} id @param {boolean} on */
function perkCardHTML(id, on) {
  const R = PERKS[id];
  return `<pb-pick-card data-id="${escapeHtml(id)}" heading="${escapeHtml(R.name)}" sub="${PERK_RARITY[R.rarity] || ''}"${on ? ' selected' : ''}><span slot="art">${uiIconHTML('relic', 40)}</span>${escapeHtml(R.d)}</pb-pick-card>`;
}
/** show a sheet of this class in place when it is already up; otherwise ahead of any other (as the payout does) */
function perkSheet(M) {
  if (uiState.modal && uiState.modal.cls !== M.cls) uiState.mq.unshift(uiState.modal);
  uiState.mq = uiState.mq.filter(q => q.cls !== M.cls);
  uiState.modal = M;
  renderOverlay();
}
/** a pick card tapped on the open sheet: f(its Perk's id) */
function perkCardsOn(f) {
  for (const c of document.querySelectorAll('#ov pb-pick-card[data-id]'))
    c.addEventListener('pb-pick', () => f(/** @type {HTMLElement} */ (c).dataset.id));
}

/* ---------- the pick after a mini-boss ---------- */
/** the run's offer as a sheet (nothing when there is none) */
export function perkPickOpen() {
  const run = saveData.run;
  if (!run || !run.offer) return;
  const rule = RULES.run.perks,
    ids = run.offer.filter(id => PERKS[id]),
    sel = ids.includes(uiState.relicSel) ? uiState.relicSel : null;
  perkSheet({
    title: 'Pick a Perk',
    cls: 'relic-pick',
    lock: true,
    html: `<p>The mini-boss left a few perks behind. Take one for the rest of the run.</p><p class="note">You hold ${run.relics.length} of ${rule.cap}.${run.relics.length >= rule.cap ? ' Taking one means letting another go.' : ''}</p><div class="relic-cards">${ids.map(id => perkCardHTML(id, id === sel)).join('')}</div>`,
    btns: [
      { l: 'Take it', c: 'gold', dis: !sel, f: () => perkPickTake(/** @type {string} */ (sel)) },
      { l: 'Take none', c: 'quiet', f: () => perkPickDone(null) },
    ],
    after: () =>
      perkCardsOn(id => {
        uiState.relicSel = id;
        perkPickOpen();
      }),
  });
  runHint('relic');
}
/** "Take it": past the cap, which to let go first */
function perkPickTake(id) {
  const run = saveData.run;
  if (!run || !run.offer || !id) return;
  if (run.relics.length >= RULES.run.perks.cap) perkDropOpen(id, drop => perkPickDone(id, drop), perkPickOpen);
  else perkPickDone(id);
}
/** the pick answered (a Perk, or none): saved, the sheet closed */
function perkPickDone(id, drop) {
  const run = saveData.run;
  if (!run) return;
  const why = perkChoose(run, id, PERKS, RULES.run.perks, drop);
  if (why) {
    toast('That Perk can’t be taken.');
    return;
  }
  uiState.relicSel = null;
  saveNow();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `Perk pick: ${id || 'none'}${drop ? ` for ${drop}` : ''}`);
  closeModal();
  render();
  if (id) toast(`${PERKS[id].name}: ${PERKS[id].d}`);
  /* SND-6: a Perk taken has a jingle of its own */
  if (id && typeof jinglePlay === 'function') jinglePlay('relic');
}

/* ---------- past the cap: let one go ---------- */
/**
 * Which Perk to let go for `id`: the held ones as cards; a tap answers `then(itsId)`; "Keep them" goes `back`.
 * @param {string} id @param {(drop: string) => void} then @param {() => void} back
 */
function perkDropOpen(id, then, back) {
  const run = saveData.run;
  if (!run || !PERKS[id]) return;
  perkSheet({
    title: 'Let one go',
    cls: 'relic-drop',
    lock: true,
    html: `<p>You can hold ${RULES.run.perks.cap} Perks. Tap one to let it go for ${escapeHtml(PERKS[id].name)}.</p><div class="relic-cards">${run.relics
      .filter(k => PERKS[k])
      .map(k => perkCardHTML(k, false))
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
      perkCardsOn(drop => {
        uiState.modal = null;
        then(drop);
      }),
  });
}

/* ---------- the Perks tab ---------- */
/** the run's Perks, each with what it does */
export function renderPerks() {
  const run = saveData.run,
    cap = RULES.run.perks.cap;
  if (!run) return `<p class="note bag-empty">Perks come with a run. Start one at the airship mast.</p>`;
  const held = run.relics.filter(id => PERKS[id]);
  return `<section class="tpanel relics"><div class="sec-h"><h2>Perks</h2><span class="count tnum">${held.length} of ${cap}</span></div>${
    held.length
      ? `<div class="bag-list">${held
          .map(
            id =>
              `<div class="bag-row k-card"><span class="bag-ic">${uiIconHTML('relic', 30)}</span><span class="bag-t"><b>${escapeHtml(PERKS[id].name)}</b><small>${escapeHtml(PERKS[id].d)}</small></span><small class="note">${PERK_RARITY[PERKS[id].rarity] || ''}</small></div>`
          )
          .join('')}</div>`
      : `<p class="note bag-empty">None yet. Beat a mini-boss for a pick of ${RULES.run.perks.pick}, or buy one in a town’s shop. They last the run.</p>`
  }</section>`;
}
