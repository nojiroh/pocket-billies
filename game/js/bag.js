'use strict';
/* ================= BAG (alpha 0.5) =================
   Your inventory, in pockets by what things are for: Healing (potions, salves, revives, snacks), Coins (for catching
   a Billie in battle), Special (stones that make some Billies evolve) and Eggs (with how far each still has to go).
   Tap a thing to choose it; healing is used straight from here on a Billie you pick. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, render, toast } from './hooks.js';
import { ITEMS, PYRAMIDS } from './game-data.js';
import { billyName, formatNumber, maxHp } from './logic/rules.js';
import { fxTagsHTML, rarityPillHTML, rarityRowAttr, statusTagHTML } from './ui-marks-kit.js';
import { applyItem, canUse, teamNeedsHp } from './logic/battle-engine.js';
import { escapeHtml, saveData, uiState } from './game-state.js';
import { pyramidHTML, uiIconHTML } from './art.js';
import { bustHTML } from './skeleton-rig.js';
import { itemIcon } from './battle.js';
/* eslint-disable no-func-assign */
expose({
  BAG_POCKETS: [() => BAG_POCKETS],
  bagHeal: [() => bagHeal],
  bagList: [() => bagList, v => (bagList = v)],
  renderBag: [() => renderBag, v => (renderBag = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const BAG_POCKETS = [
  ['heal', 'Healing', 'heart'],
  ['pyramids', 'Pyramids', 'pyramid'],
  ['special', 'Special', 'spark'],
];
const bagHeal = k => {
  const I = ITEMS[k];
  return !!(I && (I.hp || I.hpAll || I.revive || I.cure));
};
function bagList(p) {
  if (p === 'heal') return Object.keys(ITEMS).filter(k => bagHeal(k) && saveData.items[k] > 0);
  if (p === 'special') return Object.keys(ITEMS).filter(k => !bagHeal(k) && saveData.items[k] > 0);
  if (p === 'pyramids') return Object.keys(PYRAMIDS).filter(k => saveData.pyramids[k] > 0);
  return [];
}
export function renderBag() {
  /* RL-10: the Eggs pocket is gone (eggs hatch at the ranch); a pocket that isn't there any more opens Healing */
  const p = BAG_POCKETS.some(([k]) => k === uiState.bagP) ? uiState.bagP : 'heal',
    sel = uiState.bagSel;
  const tabs = `<div class="bag-pockets glass px k-panel" role="tablist" aria-label="Pockets">${BAG_POCKETS.map(
    ([k, l, ic]) => {
      const n = bagList(k).length;
      return `<button role="tab" aria-selected="${p === k}" data-a="bag-p" data-p="${k}">${uiIconHTML(ic, 20)}<span>${l}</span>${n ? `<small class="tnum">${n}</small>` : ''}</button>`;
    }
  ).join('')}</div>`;
  const L = bagList(p),
    body = L.length
      ? `<div class="bag-list px">${L.map(k => {
          const I = p === 'pyramids' ? PYRAMIDS[k] : ITEMS[k],
            n = p === 'pyramids' ? saveData.pyramids[k] : saveData.items[k],
            on = sel === k,
            /* UI-14b: a held item's tier (row frame, name colour, pill) and its stat rows as tags */
            held = p !== 'pyramids' && I.hold;
          return `<button class="bag-row k-card${held ? ' rar-row' : ''} ${on ? 'on' : ''}"${held ? rarityRowAttr(I.rarity) : ''} data-a="bag-sel" data-k="${escapeHtml(k)}" aria-pressed="${on}"><span class="bag-ic">${p === 'pyramids' ? pyramidHTML(k, 30) : itemIcon(k, 30)}</span><span class="bag-t"><b class="rar-name">${escapeHtml(I.n)}</b><small>${escapeHtml(I.d || '')}${held ? fxTagsHTML(I.hold) : ''}</small></span>${held ? rarityPillHTML(I.rarity) : ''}<b class="bag-n tnum">×${formatNumber(n)}</b></button>`;
        }).join('')}</div>`
      : `<p class="note bag-empty">${p === 'pyramids' ? 'No pyramids. Shops sell them.' : p === 'special' ? 'Nothing special yet.' : 'No healing items. Shops sell them.'}</p>`;
  /* what the chosen thing can do */
  let act = '';
  if (sel && bagList(p).includes(sel)) {
    if (p === 'heal') {
      const I = ITEMS[sel],
        ok = I.hpAll ? teamNeedsHp() : saveData.team.some(m => canUse(sel, m));
      act = `<div class="bag-act px"><span class="bag-t"><b>${escapeHtml(I.n)}</b><small>${ok ? (I.hpAll ? 'Shares out over your whole team' : 'Choose a Billie to use it on') : 'Nobody on your team needs it right now'}</small></span><button class="pb gold" data-a="bag-use" data-k="${escapeHtml(sel)}" ${ok ? '' : 'disabled'}>Use</button></div>`;
    } else if (p === 'pyramids')
      act = `<div class="bag-act px"><span class="bag-t"><b>${escapeHtml(PYRAMIDS[sel].n)}</b><small>Throw it in a battle to catch a tired Billie</small></span></div>`;
    else
      act = `<div class="bag-act px"><span class="bag-t"><b>${escapeHtml(ITEMS[sel].n)}</b><small>Open a Billie’s details on the Team screen to use it</small></span><button class="pb" data-a="tab" data-t="team">Team</button></div>`;
  }
  /* phase 06-3: the same title as the other screens; the use panel floats above the bottom bar (css/units.css "Bag") */
  const total =
    Object.keys(ITEMS).reduce((a, k) => a + (saveData.items[k] || 0), 0) +
    Object.keys(PYRAMIDS).reduce((a, k) => a + (saveData.pyramids[k] || 0), 0);
  return `<header class="bar"><div><div class="sub">${formatNumber(total)} things carried</div><h1 class="where">Bag</h1></div></header>${tabs}${body}${act}`;
}
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a^="bag-"]');
  if (!el) return;
  const d = el.dataset;
  if (d.a === 'bag-p') {
    uiState.bagP = d.p;
    uiState.bagSel = null;
    render();
    return;
  }
  if (d.a === 'bag-sel') {
    uiState.bagSel = uiState.bagSel === d.k ? null : d.k;
    render();
    return;
  }
  if (d.a === 'bag-use') {
    const k = d.k,
      I = ITEMS[k];
    if (!I) return;
    if (I.hpAll) {
      const m = saveData.team.find(x => x.hp > 0);
      if (m && applyItem(k, m.uid, false)) {
        if (!saveData.items[k]) uiState.bagSel = null;
        render();
      }
      return;
    }
    const L = saveData.team.filter(m => canUse(k, m));
    if (!L.length) {
      toast('Nobody on your team needs that right now.');
      return;
    }
    modal({
      title: `Use ${escapeHtml(I.n)} on…`,
      html: `<div class="list">${L.map(m => `<button class="pickrow" data-a="bag-on" data-k="${escapeHtml(k)}" data-u="${m.uid}">${bustHTML(m.sp, 40, { coat: m.coat })}<span><b>${escapeHtml(billyName(m))}</b><small class="tnum">HP ${m.hp}/${maxHp(m)} ${statusTagHTML(m.status)}</small></span></button>`).join('')}</div>`,
      btns: [{ l: 'Never mind', c: 'quiet', f: closeModal }],
    });
    return;
  }
  if (d.a === 'bag-on') {
    closeModal();
    if (applyItem(d.k, d.u, false)) {
      if (!saveData.items[d.k]) uiState.bagSel = null;
      render();
    }
  }
});
