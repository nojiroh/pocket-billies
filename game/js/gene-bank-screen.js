'use strict';
/* ================= THE GENE BANK SCREEN (splicing track SP-4) =================
   Copperleaf's Gene Bank (HB-5's lab-vault on its plot): a tap on its door walks you in (int_gene_bank), a tap on
   the Splice console or the keeper opens this sheet. It shows your DNA, the Bank's level, its Stability limit and
   the slots it splices; your Billies (team and storage) as cards. A Billie picked: Sequence (its parts into the
   library, free), the slots (a closed one says the level that opens it), the Gene on the slot now with Take off
   (free; the Gene stays in the library), the library's Genes that fit the slot, and the picked Gene's preview: the
   Billie drawn with it, its weight, stats, traits, types, the move it teaches (when genes.json has one) and
   Stability against the limit, Unstable or refused. Splice pays the DNA. The Bank's upgrades (unlocks.json rows,
   for DNA) at the foot. The rules are logic/gene-bank.js; every change is saved at once. A hub sheet only. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { buildingRowsHTML, closeModal, modal, provide, render, renderOverlay, toast } from './hooks.js';
import { GENES, MOVES, SPECIES, STAT_IDS, STAT_NAMES } from './game-data.js';
import { GRAFT_SLOTS, graftKey, graftOf } from './logic/graft-art.js';
import { geneOf, geneWords, graftStability, graftTraits } from './logic/genes.js';
import {
  bankGenes,
  bankLevel,
  bankNative,
  bankOpensAt,
  bankPrice,
  bankReads,
  bankRow,
  bankSequence,
  bankSettle,
  bankSlots,
  bankSplice,
  bankTry,
  bankUnsplice,
  bankWhy,
} from './logic/gene-bank.js';
import {
  billyGraft,
  billyName,
  billyTypes,
  billyUnstable,
  billyWeight,
  geneData,
  geneLimit,
  maxHp,
  spliceWords,
  stat,
} from './logic/rules.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { rigCanvasHTML } from './skeleton-rig.js';
/* eslint-disable no-func-assign */
expose({
  BANK_SLOT: [() => BANK_SLOT],
  BANK_WHY: [() => BANK_WHY],
  bankBillieHTML: [() => bankBillieHTML, v => (bankBillieHTML = v)],
  bankGeneLine: [() => bankGeneLine, v => (bankGeneLine = v)],
  bankLog: [() => bankLog, v => (bankLog = v)],
  bankPickNow: [() => bankPickNow, v => (bankPickNow = v)],
  bankPreviewHTML: [() => bankPreviewHTML, v => (bankPreviewHTML = v)],
  geneBankDo: [() => geneBankDo, v => (geneBankDo = v)],
  geneBankLevelled: [() => geneBankLevelled, v => ((geneBankLevelled = v), provide({ geneBankLevelled }))],
  geneBankOpen: [() => geneBankOpen, v => ((geneBankOpen = v), provide({ geneBankOpen }))],
});
/* eslint-enable no-func-assign */
provide({ geneBankLevelled, geneBankOpen });
/* to-module: end */
/** a Gene Bank refusal in words */
const BANK_WHY = {
  run: 'The Gene Bank is closed while you’re away on a run',
  slot: 'The Bank doesn’t splice that slot yet',
  unknown: 'That Gene isn’t in the library',
  fit: 'That Gene doesn’t fit this Billie',
  same: 'It already wears that Gene',
  refused: 'Too much for one body: Stability is far past the limit',
  dna: 'Not enough DNA',
  none: 'Nothing is spliced there',
  aug: 'An Augment is fitted there: the Workshop takes it off',
};
/** a slot's name on the sheet */
const BANK_SLOT = { front: 'Front', back: 'Back', sig: 'Tail' };

/** the sheet's picks: the Billie, the slot, the Gene previewed */
function bankPickNow() {
  return uiState.bankPick || (uiState.bankPick = { uid: '', slot: '', gene: '' });
}
/** a Gene's line in the list: its words, its trait, type and cost @param {any} D @param {any} m @param {string} slot
 * @param {string} id */
function bankGeneLine(D, m, slot, id) {
  const g = geneOf(D, slot, id),
    T = g && g.trait && GENES.traits[g.trait];
  return [T ? T.name : '', g && g.type ? `${g.type} type` : '', g && g.move && MOVES[g.move] ? MOVES[g.move].name : '']
    .filter(Boolean)
    .join(' · ');
}
/** the picked Gene's preview: the Billie drawn with it, its weight and stats before and after, its traits, types,
 * move, and Stability against the Bank's limit @param {any} D @param {any} s @param {any} m @param {string} slot
 * @param {string} id */
function bankPreviewHTML(D, s, m, slot, id) {
  const limit = geneLimit(s),
    { graft, st } = bankTry(D, m, slot, id, limit),
    q = { ...m, graft: graft || undefined };
  if (!graft) delete q.graft;
  /* the preview keeps a roll it would keep, and shows none it would roll (the roll comes when it is spliced) */
  if (!st.unstable) delete q.unstable;
  const before = Object.fromEntries(STAT_IDS.map(k => [k, k === 'hp' ? maxHp(m) : stat(m, k)])),
    after = Object.fromEntries(STAT_IDS.map(k => [k, k === 'hp' ? maxHp(q) : stat(q, k)])),
    bars = STAT_IDS.map(
      k =>
        `<span class="bx-sub tnum">${STAT_NAMES[k]} ${before[k] === after[k] ? after[k] : `${before[k]} → ${after[k]}`}</span><pb-stat-bar kind="stat" value="${after[k]}" max="150"></pb-stat-bar>`
    ).join(''),
    traits = graft ? graftTraits(D, m.sp, graft) : [],
    types = billyTypes(q),
    g = geneOf(D, slot, id),
    move = g && g.move && MOVES[g.move],
    why = bankWhy(D, s, m, slot, id),
    price = bankPrice(D, m.sp, slot, id),
    stLine = st.refused
      ? `Stability ${st.cost} of ${st.limit}: refused, far past the limit`
      : st.unstable
        ? `Stability ${st.cost} of ${st.limit}: past the limit, so it turns Unstable (one stat ×${GENES.unstable.up}, one ×${GENES.unstable.down}, ${GENES.unstable.d.replace(/\.$/, '').toLowerCase()})`
        : `Stability ${st.cost} of ${st.limit}`;
  return `<div class="bx k-card ranch-card gene-preview"><div class="bx-main"><span class="bx-spr">${rigCanvasHTML(m.sp, 56, { build: m.build, coat: m.coat, graft: graftKey(graft) })}</span><b>${escapeHtml(geneWords(D, slot, id))}</b><span class="bx-sub tnum">${billyWeight(m)} kg → ${billyWeight(q)} kg · ${escapeHtml(types.join(' / '))}</span><span class="bx-sub">${traits.length ? `Traits: ${traits.map(t => `<b>${escapeHtml(GENES.traits[t].name)}</b> (${escapeHtml(GENES.traits[t].d)})`).join(', ')}` : 'No trait'}</span>${move ? `<span class="bx-sub">Teaches ${escapeHtml(move.name)}</span>` : ''}<span class="bx-sub">${escapeHtml(stLine)}</span>${bars}</div><button class="qk k-btn" data-g="splice"${why ? ' disabled' : ''}>Splice · ${price} DNA</button></div>${why && why !== 'same' ? `<p class="note">${BANK_WHY[why]}.</p>` : ''}`;
}
/** the picked Billie's part of the sheet @param {any} D @param {any} s @param {any} m */
function bankBillieHTML(D, s, m) {
  const P = bankPickNow(),
    level = bankLevel(s),
    open = bankSlots(D, level),
    have = new Set(s.meta.genes),
    fresh = bankReads(D, m).filter(id => !have.has(id)).length,
    slots = GRAFT_SLOTS.filter(k => bankNative(D, m.sp, k));
  if (!slots.includes(P.slot)) P.slot = slots.find(k => open.includes(k)) || slots[0] || '';
  const g = billyGraft(m) || {},
    seg = slots
      .map(k => {
        const lv = bankOpensAt(D, k),
          shut = !open.includes(k);
        return `<button type="button" role="radio" aria-checked="${P.slot === k}" class="${P.slot === k ? 'on' : ''}" data-g="slot" data-k="${k}">${BANK_SLOT[k] || k}${shut ? ` · Lv ${lv || '?'}` : ''}</button>`;
      })
      .join(''),
    now = P.slot && g[P.slot],
    worn = now
      ? `<div class="bx k-card ranch-card"><div class="bx-main"><b>Now: ${escapeHtml(geneWords(D, P.slot, now))}</b><span class="bx-sub">${escapeHtml(bankGeneLine(D, m, P.slot, now)) || 'Its trait'}</span></div><button class="qk k-btn" data-g="off">Take off · free</button></div>`
      : '',
    list = P.slot ? bankGenes(D, s, m, P.slot).filter(id => id !== now) : [];
  if (P.gene && !list.includes(P.gene)) P.gene = '';
  const rows = list
      .map(
        id =>
          `<button class="pickrow${P.gene === id ? ' on' : ''}" data-g="gene" data-k="${escapeHtml(id)}"><span class="pr-t"><b>${escapeHtml(geneWords(D, P.slot, id))}</b><small>${escapeHtml(bankGeneLine(D, m, P.slot, id))}</small></span><span class="pr-n tnum">${bankPrice(D, m.sp, P.slot, id)} DNA</span></button>`
      )
      .join(''),
    shutNote =
      P.slot && !open.includes(P.slot)
        ? `<p class="note">The Bank splices this slot from Lv ${bankOpensAt(D, P.slot)}. You can still take a Gene off it.</p>`
        : '';
  return `<section class="tpanel gene-billie"><div class="sec-h"><h2>${escapeHtml(billyName(m))}</h2><span class="count tnum">Stability ${graftStability(D, m.sp, billyGraft(m), geneLimit(s)).cost} of ${geneLimit(s)}</span></div><div class="bx k-card ranch-card"><div class="bx-main"><span class="bx-spr">${rigCanvasHTML(m.sp, 56, { build: m.build, coat: m.coat, graft: graftOf(m) })}</span><b>${fresh ? `${fresh} new Gene${fresh === 1 ? '' : 's'} to read` : 'Sequenced'}</b><span class="bx-sub">${escapeHtml(spliceWords(m).join(', ')) || 'All its own parts'}${billyUnstable(m) ? ' · Unstable' : ''}</span></div><button class="qk k-btn" data-g="seq"${fresh ? '' : ' disabled'}>Sequence · free</button></div>${slots.length ? `<div class="seg" role="radiogroup" aria-label="Slot">${seg}</div>${worn}${shutNote}<div class="list">${rows || '<p class="note">No Gene in the library fits this slot. Sequence other Billies, or knock out spliced wild Billies on runs for Gene Samples.</p>'}</div>${P.gene ? bankPreviewHTML(D, s, m, P.slot, P.gene) : ''}` : '<p class="note">This Billie’s form can’t be spliced yet.</p>'}</section>`;
}
/** the Gene Bank's sheet, opened (or drawn again in place after a button) */
export function geneBankOpen() {
  const s = saveData;
  if (s.run) {
    toast(`${BANK_WHY.run}.`);
    return;
  }
  const D = geneData(),
    P = bankPickNow(),
    level = bankLevel(s),
    home = s.team.concat(s.box);
  if (P.uid && !home.some(m => m.uid === P.uid)) P.uid = '';
  const m = home.find(b => b.uid === P.uid),
    cards = home
      .map(
        b =>
          `<pb-pick-card data-u="${b.uid}" heading="${escapeHtml(billyName(b))}" sub="Lv ${b.lvl} · ${escapeHtml(SPECIES[b.sp].name)}${billyGraft(b) ? ' · spliced' : ''}"${P.uid === b.uid ? ' selected' : ''}><span slot="art">${rigCanvasHTML(b.sp, 56, { build: b.build, coat: b.coat, graft: graftOf(b) })}</span></pb-pick-card>`
      )
      .join(''),
    rowsHTML = typeof buildingRowsHTML === 'function' ? buildingRowsHTML('genebank', 'genebank') : '';
  const again = !!(uiState.modal && uiState.modal.cls === 'ranch-sheet gene-sheet'),
    sheet = again && document.querySelector('#ov .sheet'),
    body = again && document.querySelector('#ov .sheet .body'),
    scroll = sheet ? [sheet.scrollTop, body ? body.scrollTop : 0] : null;
  const M = {
    title: `The Gene Bank · Lv ${level}`,
    cls: 'ranch-sheet gene-sheet',
    html: `<p class="ranch-head"><pb-coin kind="dna" value="${s.meta.dna}" label="DNA"></pb-coin> <span class="note">Stability limit ${bankRow(D, level).limit} · splices ${bankSlots(
      D,
      level
    )
      .map(k => (BANK_SLOT[k] || k).toLowerCase())
      .join(
        ', '
      )} · ${s.meta.genes.length} Gene${s.meta.genes.length === 1 ? '' : 's'} in the library</span></p><section class="tpanel"><div class="sec-h"><h2>Your Billies</h2><span class="count tnum">${home.length}</span></div><div class="list">${cards || '<p class="note">Nobody is home.</p>'}</div></section>${m ? bankBillieHTML(D, s, m) : '<p class="note">Pick a Billie to sequence or splice.</p>'}${rowsHTML ? `<section class="tpanel"><div class="sec-h"><h2>Upgrades</h2></div>${rowsHTML}</section>` : ''}<p class="note">Runs bring DNA home: knock out a spliced wild Billie for DNA and a Gene Sample of its parts.</p>`,
    btns: [{ l: 'Done', c: 'gold', f: closeModal }],
    after: () => {
      for (const b of document.querySelectorAll('#ov .gene-sheet [data-g]'))
        b.addEventListener('click', () => {
          const d = /** @type {HTMLElement} */ (b).dataset;
          geneBankDo(d.g, d.k);
        });
      for (const c of document.querySelectorAll('#ov .gene-sheet pb-pick-card'))
        c.addEventListener('pb-pick', () => geneBankDo('pick', /** @type {HTMLElement} */ (c).dataset.u));
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
    uiState.bankPick = null;
    modal(M);
  }
}
/** a button on the Gene Bank's sheet: pick a Billie, a slot or a Gene; sequence, splice or take off; saved, then
 * drawn again @param {string} what @param {string} [arg] */
export function geneBankDo(what, arg) {
  const s = saveData,
    D = geneData(),
    P = bankPickNow(),
    m = s.team.concat(s.box).find(b => b.uid === P.uid);
  if (what === 'pick') {
    P.uid = P.uid === arg ? '' : arg || '';
    P.gene = '';
  } else if (what === 'slot') {
    P.slot = arg || '';
    P.gene = '';
  } else if (what === 'gene') P.gene = P.gene === arg ? '' : arg || '';
  else if (m && what === 'seq') {
    const got = bankSequence(D, s, m);
    toast(got.length ? `${got.length} new Gene${got.length === 1 ? '' : 's'} in the library.` : 'Nothing new to read.');
    bankLog(`sequence ${m.sp}: +${got.length}, ${s.meta.genes.length} in the library`);
    save();
  } else if (m && what === 'splice') {
    const id = P.gene,
      why = bankSplice(D, s, m, P.slot, id);
    if (why) toast(`${BANK_WHY[why]}.`);
    else {
      toast(`${billyName(m)} now has ${geneWords(D, P.slot, id)}.`);
      bankLog(
        `splice ${m.sp} ${P.slot}=${id}: Stability ${graftStability(D, m.sp, billyGraft(m), geneLimit(s)).cost}, ${s.meta.dna} DNA${m.unstable ? ', unstable' : ''}`
      );
      P.gene = '';
      save();
      render();
    }
  } else if (m && what === 'off') {
    const why = bankUnsplice(D, s, m, P.slot);
    if (why) toast(`${BANK_WHY[why]}.`);
    else {
      toast(`${billyName(m)} has its own ${BANK_SLOT[P.slot] ? BANK_SLOT[P.slot].toLowerCase() : 'part'} back.`);
      bankLog(`take off ${m.sp} ${P.slot}`);
      save();
      render();
    }
  }
  geneBankOpen();
}
/** after a Gene Bank level is bought on its sheet: your Billies held to the new limit, saved */
export function geneBankLevelled() {
  bankSettle(saveData);
  bankLog(`level ${bankLevel(saveData)}: limit ${geneLimit(saveData)}`);
  save();
}
/** a line in the debug log (data ids only: no names) @param {string} t */
function bankLog(t) {
  if (typeof debugLog !== 'undefined') debugLog.add('genebank', t);
}
