'use strict';
/* ================= BAG (alpha 0.5) =================
   Your inventory, in pockets by what things are for: Healing (potions, salves, revives, snacks), Coins (for taxing
   a Billie in battle), Special (stones that make some Billies evolve) and Eggs (with how far each still has to go).
   Tap a thing to choose it; healing is used straight from here on a Billie you pick. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, render, toast } from './hooks.js';
import { COINS, EGGS, ITEMS, STATUS_NAMES } from './game-data.js';
import { billyName, eggKm, formatNumber, maxHp, metresToKm } from './logic/rules.js';
import { applyItem, canUse, teamNeedsHp } from './logic/battle-engine.js';
import { escapeHtml, saveData, uiState } from './game-state.js';
import { coinHTML, eggHTML, uiIconHTML } from './art.js';
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
  ['coins', 'Coins', 'coin'],
  ['special', 'Special', 'spark'],
  ['eggs', 'Eggs', 'leaf'],
];
const bagHeal = k => {
  const I = ITEMS[k];
  return !!(I && (I.hp || I.hpAll || I.revive || I.cure));
};
function bagList(p) {
  if (p === 'heal') return Object.keys(ITEMS).filter(k => bagHeal(k) && saveData.items[k] > 0);
  if (p === 'special') return Object.keys(ITEMS).filter(k => !bagHeal(k) && saveData.items[k] > 0);
  if (p === 'coins') return Object.keys(COINS).filter(k => saveData.coins[k] > 0);
  return [];
}
export function renderBag() {
  const p = uiState.bagP || 'heal',
    sel = uiState.bagSel;
  const tabs = `<div class="bag-pockets glass px" role="tablist" aria-label="Pockets">${BAG_POCKETS.map(
    ([k, l, ic]) => {
      const n = k === 'eggs' ? saveData.eggs.length : bagList(k).length;
      return `<button role="tab" aria-selected="${p === k}" data-a="bag-p" data-p="${k}">${uiIconHTML(ic, 20)}<span>${l}</span>${n ? `<small class="tnum">${n}</small>` : ''}</button>`;
    }
  ).join('')}</div>`;
  let body = '';
  if (p === 'eggs') {
    body = saveData.eggs.length
      ? `<div class="bag-list px">${saveData.eggs
          .map(e => {
            const E = EGGS[e.tier] || { need: 1 },
              f = Math.min(1, (e.prog || 0) / E.need),
              left = Math.max(0, E.need - (e.prog || 0));
            return `<div class="bag-row"><span class="bag-ic">${eggHTML(e.tier, 30)}</span><span class="bag-t"><b>${eggKm(e.tier)} km egg</b><small>${e.slot != null ? (left ? `${metresToKm(left)} km to go` : 'Ready to hatch') : 'Waiting for a free incubator'}</small><span class="bag-prog"><i style="width:${Math.round(f * 100)}%"></i></span></span></div>`;
          })
          .join('')}</div>`
      : `<p class="note bag-empty">No eggs right now. Some trainers and shops give them; they hatch as you walk.</p>`;
  } else {
    const L = bagList(p);
    body = L.length
      ? `<div class="bag-list px">${L.map(k => {
          const I = p === 'coins' ? COINS[k] : ITEMS[k],
            n = p === 'coins' ? saveData.coins[k] : saveData.items[k],
            on = sel === k;
          return `<button class="bag-row ${on ? 'on' : ''}" data-a="bag-sel" data-k="${escapeHtml(k)}" aria-pressed="${on}"><span class="bag-ic">${p === 'coins' ? coinHTML(k, 30) : itemIcon(k, 30)}</span><span class="bag-t"><b>${escapeHtml(I.n)}</b><small>${escapeHtml(I.d || '')}</small></span><b class="bag-n tnum">×${formatNumber(n)}</b></button>`;
        }).join('')}</div>`
      : `<p class="note bag-empty">${p === 'coins' ? 'No coins. Shops sell them.' : p === 'special' ? 'Nothing special yet.' : 'No healing items. Shops sell them.'}</p>`;
  }
  /* what the chosen thing can do */
  let act = '';
  if (sel && p !== 'eggs' && bagList(p).includes(sel)) {
    if (p === 'heal') {
      const I = ITEMS[sel],
        ok = I.hpAll ? teamNeedsHp() : saveData.team.some(m => canUse(sel, m));
      act = `<div class="bag-act px"><span class="bag-t"><b>${escapeHtml(I.n)}</b><small>${ok ? (I.hpAll ? 'Shares out over your whole team' : 'Choose a Billie to use it on') : 'Nobody on your team needs it right now'}</small></span><button class="pb gold" data-a="bag-use" data-k="${escapeHtml(sel)}" ${ok ? '' : 'disabled'}>Use</button></div>`;
    } else if (p === 'coins')
      act = `<div class="bag-act px"><span class="bag-t"><b>${escapeHtml(COINS[sel].n)}</b><small>Throw it in a battle to tax a tired Billie</small></span></div>`;
    else
      act = `<div class="bag-act px"><span class="bag-t"><b>${escapeHtml(ITEMS[sel].n)}</b><small>Open a Billie’s details on the Team screen to use it</small></span><button class="pb" data-a="tab" data-t="team">Team</button></div>`;
  }
  /* phase 06-3: the same title as the other screens; the use panel floats above the bottom bar (css/units.css "Bag") */
  const total =
    Object.keys(ITEMS).reduce((a, k) => a + (saveData.items[k] || 0), 0) +
    Object.keys(COINS).reduce((a, k) => a + (saveData.coins[k] || 0), 0);
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
      html: `<div class="list">${L.map(m => `<button class="pickrow" data-a="bag-on" data-k="${escapeHtml(k)}" data-u="${m.uid}">${bustHTML(m.sp, 40, { gold: m.gold })}<span><b>${escapeHtml(billyName(m))}</b><small class="tnum">HP ${m.hp}/${maxHp(m)}${m.status ? ' · ' + escapeHtml(STATUS_NAMES[m.status] || m.status) : ''}</small></span></button>`).join('')}</div>`,
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
