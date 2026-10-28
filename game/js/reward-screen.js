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
import { CURRENCIES, ITEMS, MOVES, PYRAMIDS, RULES } from './game-data.js';
import { ROBOT_SLOT_NAMES, robotPartDef } from './logic/fighters.js';
import { billyName } from './logic/rules.js';
import { rarityTier } from './logic/marks.js';
import {
  rewardDataGame,
  rewardReroll,
  rewardRerollCost,
  rewardRerollFree,
  rewardTake,
  tutorWho,
} from './logic/rewards.js';
import { pbNudge } from './ui-kit.js';
import { fxTagsHTML } from './ui-marks-kit.js';
import { pbFlipFresh, pbFlipIn, pbGainFly } from './ui-motion.js';
import { escapeHtml, saveData, saveNow, uiState } from './game-state.js';
import { artURL, moneyHTML, pyramidHTML, uiIconHTML } from './art.js';
import { bustHTML } from './skeleton-rig.js';
import { itemIcon } from './battle.js';
/* eslint-disable no-func-assign */
expose({
  rarityAttr: [() => rarityAttr],
  rewardAnswer: [() => rewardAnswer, v => (rewardAnswer = v)],
  rewardCardFace: [() => rewardCardFace, v => (rewardCardFace = v)],
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

/** UI-14b: a pick card's rarity attribute ('' for none: rarities' starter shows as common, boss parts none)
 * @param {string | undefined} r */
const rarityAttr = r => (rarityTier(r) ? ` rarity="${rarityTier(r)}"` : '');
/** a card as a pick card @param {import('../types/save-data').RewardCard} c @param {number} k @param {boolean} on */
function rewardCardHTML(c, k, on) {
  const n = c.n && c.n > 1 ? `${c.n} × ` : '';
  /* RL-14: a salvage pick's cards: a bot's part (into your parts) and a stack of Scrap */
  if (c.kind === 'part') {
    const P = robotPartDef(/** @type {string} */ (c.item)) || { name: c.item, d: '', type: 'None' },
      M = P.move && MOVES[P.move],
      img = P.art && P.art.img;
    /* UI-14b: each card's kind as its ribbon (pb-pick-card kind), and a held item's or part's tier as its frame */
    return `<pb-pick-card data-k="${k}" kind="part"${rarityAttr(P.rar)} heading="${escapeHtml(P.name)}" sub="Bot part · ${escapeHtml(ROBOT_SLOT_NAMES[P.slot === 'arm' ? 'armL' : P.slot] || P.slot || '')}"${on ? ' selected' : ''}><span slot="art">${img ? `<img class="part-pic" src="${escapeHtml(artURL(img))}" width="40" height="40" alt="">` : typeBadgeHTML(P.type)}</span>${escapeHtml(P.d || '')}${M ? ` Gives ${escapeHtml(M.n)}.` : ''} Kept for the Workshop.</pb-pick-card>`;
  }
  if (c.kind === 'scrap') {
    const C = CURRENCIES.scrap || { name: 'Scrap' };
    return `<pb-pick-card data-k="${k}" kind="scrap" heading="${escapeHtml(`${c.n || 1} ${C.name}`)}" sub="Salvage"${on ? ' selected' : ''}><span slot="art">${uiIconHTML('scrap', 40)}</span>Melted down and sent home: ${escapeHtml(C.name)} builds up the ranch and the Workshop.</pb-pick-card>`;
  }
  if (c.kind === 'tutor') {
    const M = MOVES[/** @type {string} */ (c.move)] || { n: c.move, t: 'None', d: '' };
    return `<pb-pick-card data-k="${k}" kind="tutor" heading="${escapeHtml(M.n)}" sub="Move tutor"${on ? ' selected' : ''}><span slot="art">${typeBadgeHTML(M.t)}</span>${escapeHtml(M.d || '')}${M.p ? ` Power ${M.p}.` : ''}</pb-pick-card>`;
  }
  if (c.item && c.item.startsWith('coin_')) {
    const P = PYRAMIDS[c.item.slice(5)] || { n: c.item, d: '' };
    return `<pb-pick-card data-k="${k}" kind="item" heading="${escapeHtml(n + P.n)}" sub="Pyramid"${on ? ' selected' : ''}><span slot="art">${pyramidHTML(c.item.slice(5), 40)}</span>${escapeHtml(P.d || '')}</pb-pick-card>`;
  }
  const I = /** @type {any} */ (ITEMS[/** @type {string} */ (c.item)] || { n: c.item, d: '' }),
    sub = c.kind === 'candy' ? 'Candy' : c.kind === 'evo' ? 'Evolution item' : c.kind === 'held' ? 'Held item' : 'Item',
    kind = c.kind === 'candy' || c.kind === 'evo' || c.kind === 'held' ? c.kind : 'item';
  return `<pb-pick-card data-k="${k}" kind="${kind}"${c.kind === 'held' ? rarityAttr(I.rarity) : ''} heading="${escapeHtml(n + I.n)}" sub="${sub}"${on ? ' selected' : ''}><span slot="art">${itemIcon(/** @type {string} */ (c.item), 40)}</span>${escapeHtml(I.d || '')}${c.kind === 'held' ? fxTagsHTML(I.hold) : ''}</pb-pick-card>`;
}
/** show the pick's sheet (in place when it is up; ahead of any other) */
function rewardSheet(M) {
  if (uiState.modal && uiState.modal.cls !== M.cls) uiState.mq.unshift(uiState.modal);
  uiState.mq = uiState.mq.filter(q => q.cls !== M.cls);
  uiState.modal = M;
  renderOverlay();
}

/** UI-16a: a card dealt face down (pbFlipIn turns it over) @param {string} h its pb-pick-card @param {boolean} down */
function rewardCardFace(h, down) {
  return down ? h.replace('<pb-pick-card ', '<pb-pick-card facedown dealt ') : h;
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
  /* UI-16a: the first time this offer shows, its cards come face down and turn over one by one (a reroll is a new
     offer); drawn again (a card chosen), they stay face up */
  const flipKey = `reward:${R.from}:${R.rolls || 0}`,
    flip = pbFlipFresh(flipKey);
  const sel = typeof uiState.rewardSel === 'number' && R.cards[uiState.rewardSel] ? uiState.rewardSel : null,
    cost = rewardRerollCost(R, RULES.run.rewards, rewardRerollFree(run)),
    /* RL-14: what the bots left (logic/rewards.js salvageOfferMake): never rerolled */
    salvage = R.kind === 'salvage';
  rewardSheet({
    title: salvage ? 'Salvage' : 'Pick a reward',
    cls: 'reward-pick',
    lock: true,
    html: `<p>${salvage ? 'The bots came apart. Take one piece of what is left.' : R.from.startsWith('event:') ? 'Take one.' : R.from.startsWith('quest:') ? 'A thank-you for the quest. Take one.' : 'Your opponent left a few things behind. Take one.'}</p><div class="relic-cards">${R.cards.map((c, k) => rewardCardFace(rewardCardHTML(c, k, k === sel), flip)).join('')}</div>`,
    btns: [
      { l: 'Take it', c: 'gold', dis: sel == null, f: () => rewardTakeTap(/** @type {number} */ (sel)) },
      ...(salvage
        ? []
        : [
            {
              /* PK-5: a free reroll (Fortune Cookie) says so */
              l: cost ? `Reroll ${moneyHTML(cost, 12)}` : 'Reroll free',
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
          ]),
      { l: 'Take none', c: 'quiet', f: () => rewardAnswer(null) },
    ],
    after: () => {
      if (flip) pbFlipIn(flipKey);
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
    /* UI-16a: where the card was, before the sheet closes, for what it gives to fly from */
    card = k == null ? null : document.querySelector(`#ov pb-pick-card[data-k="${k}"]`),
    from = card ? card.getBoundingClientRect() : null,
    why = rewardTake(run, saveData, k, rewardDataGame(saveData.team), o);
  if (why) {
    toast('That can’t be taken.');
    pbNudge(document.querySelector('#ov .btns .gold'), true);
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
  } else if (c && c.kind === 'part') toast(`Into your parts, for the Workshop.`);
  else if (c && c.kind === 'scrap') toast(`${c.n || 1} Scrap sent home.`);
  else if (c && c.item) toast(`Into the bag.`);
  /* UI-16a: an item that went into the bag flies to the Bag tab (one held by a Billie stays with it) */
  if (c && c.item && !(c.kind === 'held' && o && o.uid)) pbGainFly(from, 'bag', 'bag');
  rewardDone();
}
/** an event waiting on the pick goes on */
function rewardDone() {
  const then = rewardThen;
  rewardThen = null;
  if (then) then();
}
