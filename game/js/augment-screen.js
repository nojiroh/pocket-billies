'use strict';
/* ================= THE WORKSHOP'S AUGMENTS (splicing track SP-5) =================
   Copperleaf's Workshop (HB-5's model on its plot): a tap on its door walks you in (int_workshop), a tap on the
   Upgrade bench or the keeper opens this sheet. It shows your Scrap, the Workshop's level, the slots it fits and how
   far it upgrades; your Billies (team and storage) as cards. A Billie picked: its slots (the right arm, the legs; a
   closed one says the level that opens it), the Augment there now with Take off (free; back to your parts) and
   Upgrade (Scrap), your spare parts that fit (RL-14a's salvage), and the picked part's preview: the Billie drawn with
   it, its weight, types, the move it brings, the field move it counts for, Stability against your Gene Bank's limit
   (Unstable or refused), stats before and after. Fit pays the Scrap. The Workshop's upgrades (unlocks.json rows, for
   Scrap) at the foot. The rules are logic/augments.js; every change is saved at once. A hub sheet only. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { buildingRowsHTML, closeModal, modal, render, renderOverlay, toast } from './hooks.js';
import { FIELD_MOVES, GENES, MOVES, ROBOTS, SPECIES, STAT_IDS, STAT_NAMES } from './game-data.js';
import { graftLook } from './logic/graft-art.js';
import {
  AUG_SLOTS,
  augChoices,
  augWords,
  workFit,
  workLevel,
  workOff,
  workOpensAt,
  workRow,
  workSpares,
  workTry,
  workUpPrice,
  workUpWhy,
  workUpgrade,
  workWhy,
} from './logic/augments.js';
import { geneWords, graftStability } from './logic/genes.js';
import { isRobot } from './logic/fighters.js';
import {
  billyAug,
  billyGraft,
  billyName,
  billyTypes,
  billyWeight,
  geneData,
  geneLimit,
  maxHp,
  stat,
} from './logic/rules.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
/* eslint-disable no-func-assign */
expose({
  WORK_SLOT: [() => WORK_SLOT],
  WORK_WHY: [() => WORK_WHY],
  augmentsDo: [() => augmentsDo, v => (augmentsDo = v)],
  augmentsLevelled: [() => augmentsLevelled, v => (augmentsLevelled = v)],
  augmentsOpen: [() => augmentsOpen, v => (augmentsOpen = v)],
  workBillieHTML: [() => workBillieHTML, v => (workBillieHTML = v)],
  workLog: [() => workLog, v => (workLog = v)],
  workPartLine: [() => workPartLine, v => (workPartLine = v)],
  workPickNow: [() => workPickNow, v => (workPickNow = v)],
  workPreviewHTML: [() => workPreviewHTML, v => (workPreviewHTML = v)],
  workStability: [() => workStability],
  workUp: [() => workUp],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a refusal in words */
const WORK_WHY = {
  run: 'The Workshop is closed while you’re away on a run',
  robot: 'Robots are refitted on the Team screen',
  slot: 'The Workshop doesn’t fit that slot yet',
  unknown: 'That part isn’t in your spares',
  fit: 'That part doesn’t fit this Billie',
  same: 'It already wears that part',
  refused: 'Too much for one body: Stability is far past the limit',
  scrap: 'Not enough Scrap',
  none: 'Nothing is fitted there',
  max: 'The Workshop can’t upgrade it further yet',
};
/** a slot's name on the sheet */
const WORK_SLOT = { front: 'Right arm', back: 'Legs' };

/** the sheet's picks: the Billie, the slot, the spare part previewed (its uid) */
function workPickNow() {
  return uiState.augPick || (uiState.augPick = { uid: '', slot: '', part: '' });
}
/** a part's line: its type, move and the field move it counts for @param {any} D @param {string} id */
function workPartLine(D, id) {
  const P = ROBOTS.parts[id],
    f = GENES.augment.field[id],
    F = f && FIELD_MOVES[f];
  return [
    P ? `${P.type} type` : '',
    GENES.augment.move === 'extra' && P && P.move && MOVES[P.move] ? MOVES[P.move].n : '',
    F ? `Counts for ${F.name}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
/** upgrade marks: "+2" @param {number} up */
const workUp = up => (up ? ` +${up}` : '');
/** the picked part's preview: the Billie drawn with it, kg, types, its move, Stability and stats before and after
 * @param {any} D @param {any} s @param {any} m @param {string} slot @param {any} p a spare part instance */
function workPreviewHTML(D, s, m, slot, p) {
  const limit = geneLimit(s),
    { aug, graft, st } = workTry(D, m, slot, p, limit),
    q = { ...m, aug: aug || undefined, graft: graft || undefined };
  if (!aug) delete q.aug;
  if (!graft) delete q.graft;
  if (!st.unstable) delete q.unstable;
  const before = Object.fromEntries(STAT_IDS.map(k => [k, k === 'hp' ? maxHp(m) : stat(m, k)])),
    after = Object.fromEntries(STAT_IDS.map(k => [k, k === 'hp' ? maxHp(q) : stat(q, k)])),
    bars = STAT_IDS.map(
      k =>
        `<span class="bx-sub tnum">${STAT_NAMES[k]} ${before[k] === after[k] ? after[k] : `${before[k]} → ${after[k]}`}</span><pb-stat-bar kind="stat" value="${after[k]}" max="150"></pb-stat-bar>`
    ).join(''),
    gene = (billyGraft(m) || {})[slot],
    why = workWhy(D, s, m, slot, p.uid),
    price = GENES.augment.price.fit,
    stLine = st.refused
      ? `Stability ${st.cost} of ${st.limit}: refused, far past the limit`
      : st.unstable
        ? `Stability ${st.cost} of ${st.limit}: past the limit, so it turns Unstable (one stat ×${GENES.unstable.up}, one ×${GENES.unstable.down}, ${GENES.unstable.d.replace(/\.$/, '').toLowerCase()})`
        : `Stability ${st.cost} of ${st.limit}`;
  return `<div class="bx k-card ranch-card gene-preview"><div class="bx-main"><span class="bx-spr">${rigCanvasHTML(m.sp, 56, { build: m.build, coat: m.coat, graft: graftLook(q) })}</span><b>${escapeHtml(augWords(D, p.id))}${workUp(p.up)}</b><span class="bx-sub tnum">${billyWeight(m)} kg → ${billyWeight(q)} kg · ${escapeHtml(billyTypes(q).join(' / '))}</span><span class="bx-sub">${escapeHtml(workPartLine(D, p.id))}</span>${gene ? `<span class="bx-sub">Takes off ${escapeHtml(geneWords(D, slot, gene))} (it stays in the Gene library)</span>` : ''}<span class="bx-sub">${escapeHtml(stLine)}</span>${bars}</div><button class="qk k-btn" data-w="fit"${why ? ' disabled' : ''}>Fit · ${price} Scrap</button></div>${why ? `<p class="note">${WORK_WHY[why]}.</p>` : ''}`;
}
/** the picked Billie's part of the sheet @param {any} D @param {any} s @param {any} m */
function workBillieHTML(D, s, m) {
  const P = workPickNow(),
    row = workRow(D, workLevel(s)),
    slots = AUG_SLOTS.filter(k => GENES.augment.slots[k] && augChoices(D, m.sp).some(([sl]) => sl === k));
  if (!slots.includes(P.slot)) P.slot = slots.find(k => row.slots.includes(k)) || slots[0] || '';
  const a = billyAug(m) || {},
    seg = slots
      .map(k => {
        const shut = !row.slots.includes(k);
        return `<button type="button" role="radio" aria-checked="${P.slot === k}" class="${P.slot === k ? 'on' : ''}" data-w="slot" data-k="${k}">${WORK_SLOT[k] || k}${shut ? ` · Lv ${workOpensAt(D, k) || '?'}` : ''}</button>`;
      })
      .join(''),
    now = P.slot && a[P.slot],
    upWhy = now ? workUpWhy(D, s, m, P.slot) : 'none',
    upPrice = now ? workUpPrice(D, now) : 0,
    worn = now
      ? `<div class="bx k-card ranch-card"><div class="bx-main"><b>Now: ${escapeHtml(augWords(D, now.id))}${workUp(now.up)}</b><span class="bx-sub">${escapeHtml(workPartLine(D, now.id))}</span>${upWhy && upWhy !== 'scrap' ? `<span class="bx-sub">${WORK_WHY[upWhy]}.</span>` : ''}</div><button class="qk k-btn" data-w="up"${upWhy ? ' disabled' : ''}>Upgrade${Number.isFinite(upPrice) ? ` · ${upPrice} Scrap` : ''}</button><button class="qk k-btn" data-w="off">Take off · free</button></div>`
      : '',
    list = P.slot ? workSpares(D, s, m, P.slot) : [];
  if (P.part && !list.some(p => p.uid === P.part)) P.part = '';
  const rows = list
      .map(
        p =>
          `<button class="pickrow${P.part === p.uid ? ' on' : ''}" data-w="part" data-k="${escapeHtml(p.uid)}"><span class="pr-t"><b>${escapeHtml(augWords(D, p.id))}${workUp(p.up)}</b><small>${escapeHtml(workPartLine(D, p.id))}</small></span><span class="pr-n tnum">${GENES.augment.price.fit} Scrap</span></button>`
      )
      .join(''),
    shutNote =
      P.slot && !row.slots.includes(P.slot)
        ? `<p class="note">The Workshop fits this slot from Lv ${workOpensAt(D, P.slot)}. You can still take a part off it.</p>`
        : '',
    pick = P.part && list.find(p => p.uid === P.part),
    st = graftStability(D, m.sp, billyGraft(m), geneLimit(s), billyAug(m));
  return `<section class="tpanel gene-billie"><div class="sec-h"><h2>${escapeHtml(billyName(m))}</h2><span class="count tnum">Stability ${st.cost} of ${geneLimit(s)}</span></div>${slots.length ? `<div class="seg" role="radiogroup" aria-label="Slot">${seg}</div>${worn}${shutNote}<div class="list">${rows || '<p class="note">No spare part fits this slot. Beat the Bureau’s bots on runs for salvage.</p>'}</div>${pick ? workPreviewHTML(D, s, m, P.slot, pick) : ''}` : '<p class="note">This Billie’s form can’t take an Augment yet.</p>'}</section>`;
}
/** the Workshop's Augment sheet, opened (or drawn again in place after a button) */
export function augmentsOpen() {
  const s = saveData;
  if (s.run) {
    toast(`${WORK_WHY.run}.`);
    return;
  }
  const D = geneData(),
    P = workPickNow(),
    level = workLevel(s),
    row = workRow(D, level),
    home = s.team.concat(s.box).filter(b => !isRobot(b));
  if (P.uid && !home.some(m => m.uid === P.uid)) P.uid = '';
  const m = home.find(b => b.uid === P.uid),
    spares = (s.parts || []).filter(p => ROBOTS.parts[p.id] && ROBOTS.parts[p.id].slot !== 'torso').length,
    cards = home
      .map(
        b =>
          `<pb-pick-card data-u="${b.uid}" heading="${escapeHtml(billyName(b))}" sub="Lv ${b.lvl} · ${escapeHtml(SPECIES[b.sp].name)}${billyAug(b) ? ' · augmented' : ''}"${P.uid === b.uid ? ' selected' : ''}><span slot="art">${rigCanvasHTML(b.sp, 56, { build: b.build, coat: b.coat, graft: graftLook(b) })}</span></pb-pick-card>`
      )
      .join(''),
    rowsHTML = typeof buildingRowsHTML === 'function' ? buildingRowsHTML('workshop', 'workshop') : '';
  const again = !!(uiState.modal && uiState.modal.cls === 'ranch-sheet gene-sheet aug-sheet'),
    sheet = again && document.querySelector('#ov .sheet'),
    body = again && document.querySelector('#ov .sheet .body'),
    scroll = sheet ? [sheet.scrollTop, body ? body.scrollTop : 0] : null;
  const M = {
    title: `The Workshop · Lv ${level}`,
    cls: 'ranch-sheet gene-sheet aug-sheet',
    html: `<p class="ranch-head"><pb-coin kind="scrap" value="${s.meta.scrap || 0}" label="Scrap"></pb-coin> <span class="note">fits ${row.slots
      .map(k => (WORK_SLOT[k] || k).toLowerCase())
      .join(
        ' and '
      )} · upgrades to +${row.maxUp} · ${spares} spare arm${spares === 1 ? '' : 's'} and legs</span></p><section class="tpanel"><div class="sec-h"><h2>Your Billies</h2><span class="count tnum">${home.length}</span></div><div class="list">${cards || '<p class="note">Nobody is home.</p>'}</div></section>${m ? workBillieHTML(D, s, m) : '<p class="note">Pick a Billie to fit an Augment on.</p>'}${rowsHTML ? `<section class="tpanel"><div class="sec-h"><h2>Upgrades</h2></div>${rowsHTML}</section>` : ''}<p class="note">An Augment is a bot’s arm or legs on a Billie: its move, its type and some of its stats, at Stability ${GENES.stability.augment}. It can break in battle; a town’s clinic mends it.</p>`,
    btns: [{ l: 'Done', c: 'gold', f: closeModal }],
    after: () => {
      for (const b of document.querySelectorAll('#ov .aug-sheet [data-w]'))
        b.addEventListener('click', () => {
          const d = /** @type {HTMLElement} */ (b).dataset;
          augmentsDo(d.w, d.k);
        });
      for (const c of document.querySelectorAll('#ov .aug-sheet pb-pick-card'))
        c.addEventListener('pb-pick', () => augmentsDo('pick', /** @type {HTMLElement} */ (c).dataset.u));
      const sh = document.querySelector('#ov .sheet'),
        bd = document.querySelector('#ov .sheet .body');
      if (scroll && sh) sh.scrollTop = scroll[0];
      if (scroll && bd) bd.scrollTop = scroll[1];
    },
  };
  if (again) {
    uiState.modal = M;
    renderOverlay();
  } else {
    uiState.augPick = null;
    modal(M);
  }
}
/** a button on the Workshop's sheet: pick a Billie, a slot or a part; fit, take off or upgrade; saved, then drawn
 * again @param {string} what @param {string} [arg] */
function augmentsDo(what, arg) {
  const s = saveData,
    D = geneData(),
    P = workPickNow(),
    m = s.team.concat(s.box).find(b => b.uid === P.uid);
  if (what === 'pick') {
    P.uid = P.uid === arg ? '' : arg || '';
    P.part = '';
  } else if (what === 'slot') {
    P.slot = arg || '';
    P.part = '';
  } else if (what === 'part') P.part = P.part === arg ? '' : arg || '';
  else if (m && what === 'fit') {
    const p = s.parts.find(q => q.uid === P.part),
      why = workFit(D, s, m, P.slot, P.part);
    if (why || !p) toast(`${WORK_WHY[why || 'unknown']}.`);
    else {
      toast(`${billyName(m)} now has ${augWords(D, p.id)}.`);
      workLog(
        `fit ${m.sp} ${P.slot}=${p.id}+${p.up || 0}: Stability ${workStability(D, s, m)}, ${s.meta.scrap} Scrap${m.unstable ? ', unstable' : ''}`
      );
      P.part = '';
      save();
      render();
    }
  } else if (m && what === 'off') {
    const why = workOff(D, s, m, P.slot);
    if (why) toast(`${WORK_WHY[why]}.`);
    else {
      toast(`${billyName(m)} has its own ${WORK_SLOT[P.slot] ? WORK_SLOT[P.slot].toLowerCase() : 'part'} back.`);
      workLog(`take off ${m.sp} ${P.slot}`);
      save();
      render();
    }
  } else if (m && what === 'up') {
    const why = workUpgrade(D, s, m, P.slot);
    if (why) toast(`${WORK_WHY[why]}.`);
    else {
      const p = /** @type {any} */ (billyAug(m))[P.slot];
      toast(`${augWords(D, p.id).replace(/^an? /, '')} upgraded to +${p.up}.`);
      workLog(`upgrade ${m.sp} ${P.slot}=${p.id}+${p.up}: ${s.meta.scrap} Scrap`);
      save();
      render();
    }
  }
  augmentsOpen();
}
/** a Billie's Stability now, for the debug log @param {any} D @param {any} s @param {any} m */
const workStability = (D, s, m) => graftStability(D, m.sp, billyGraft(m), geneLimit(s), billyAug(m)).cost;
/** after a Workshop level is bought on its sheet: saved */
export function augmentsLevelled() {
  workLog(`level ${workLevel(saveData)}`);
  save();
}
/** a line in the debug log (data ids only: no names) @param {string} t */
function workLog(t) {
  if (typeof debugLog !== 'undefined') debugLog.add('augment', t);
}
