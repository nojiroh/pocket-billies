'use strict';
/* ================= TOWN SHOPS =================
   Shops are a run's (logic/run-scenes.js puts them in SHOPS with its world) and are attached to its places (.shop).
   Each shop has a keeper (drawn by the trainer renderer from PEOPLE), a greeting and a stock list. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, perkDropOpen, provide, renderOverlay, soundEffect, toast } from './hooks.js';
import { clamp, random } from './util.js';
import { CURRENCIES, ITEMS, PERKS, PYRAMIDS, RESIDENTS, RULES, SHOPS, UNLOCK_DATA } from './game-data.js';
import { formatNumber, plural } from './logic/rules.js';
import { resStock } from './logic/residents.js';
import { runRerollsLeft, runShopOpen, runShopReroll, runShopRerolled, runStallStock } from './logic/run-loop.js';
import { fxRunPrice } from './logic/effects.js';
import { perkBuy, perkPrice, perkShelf } from './logic/perks.js';
import { escapeHtml, save, saveData, saveNow, uiState } from './game-state.js';
import { moneyHTML, pyramidHTML, uiIconHTML } from './art.js';
import { portraitHTML } from './person-art.js';
import { openDressingRoom } from './dressing-room.js';
import { buzz } from './battle-stage.js';
import { itemIcon } from './battle.js';
/* eslint-disable no-func-assign */
expose({
  SHOP_THANKS: [() => SHOP_THANKS],
  openShop: [() => openShop, v => setOpenShop(v)],
  residentShop: [() => residentShop, v => (residentShop = v)],
  shopBuy: [() => shopBuy, v => (shopBuy = v)],
  shopCostHTML: [() => shopCostHTML, v => (shopCostHTML = v)],
  shopHTML: [() => shopHTML, v => (shopHTML = v)],
  shopPerk: [() => shopPerk, v => (shopPerk = v)],
  shopPerkBuy: [() => shopPerkBuy, v => (shopPerkBuy = v)],
  shopPerkHTML: [() => shopPerkHTML, v => (shopPerkHTML = v)],
  shopPurse: [() => shopPurse],
  shopRefresh: [() => shopRefresh, v => (shopRefresh = v)],
  shopReroll: [() => shopReroll, v => (shopReroll = v)],
  shopRerollHTML: [() => shopRerollHTML, v => (shopRerollHTML = v)],
  wareInfo: [() => wareInfo],
  warePrice: [() => warePrice],
});
/* eslint-enable no-func-assign */
export function setOpenShop(v) {
  openShop = v; // eslint-disable-line no-func-assign
  provide({ openShop });
}
/* to-module: end */
const SHOP_THANKS = [
  'Pleasure doing business.',
  'Come back any time. It’s always noon.',
  'Receipt’s in the bag. Probably.',
  'That’s a solid pick.',
  'No refunds, but lots of goodwill.',
];
const wareInfo = w => {
  if (w.coin) {
    const c = PYRAMIDS[w.coin];
    return c
      ? {
          kind: 'coin',
          key: w.coin,
          n: c.n,
          d: c.d,
          base: c.price,
          need: c.need || 0,
          have: saveData.pyramids[w.coin] || 0,
        }
      : null;
  }
  const I = ITEMS[w.item];
  return I
    ? { kind: 'item', key: w.item, n: I.n, d: I.d, base: I.price, need: 0, have: saveData.items[w.item] || 0 }
    : null;
};
/** RS-4: what a shop is paid in: a resident's hub shop takes its home's currency (saveData.meta), the rest Moneys */
const shopPurse = sh => (sh.currency ? saveData.meta[sh.currency] || 0 : saveData.se);
/** a price in the shop's currency, for its buttons */
function shopCostHTML(sh, n) {
  if (!sh.currency) return moneyHTML(n);
  const C = CURRENCIES[sh.currency] || { name: sh.currency, one: sh.currency, icon: 'coin' };
  return `<span class="money" role="img" aria-label="${formatNumber(n)} ${escapeHtml(n === 1 ? C.one : C.name)}">${uiIconHTML(C.icon, 14)}<span aria-hidden="true">${formatNumber(n)}</span></span>`;
}
/** RS-4: a resident's hub shop (Mo's General store): their wares at their level (logic/residents.js resStock), in
 * their home's currency; registered in SHOPS as res_<id> when their building is entered. Null when they sell
 * nothing, or on a run @param {string | null} id */
export function residentShop(id) {
  const r = id && RESIDENTS[id];
  if (!r || saveData.run || !(r.service || []).some(L => L.stock)) return null;
  const B = UNLOCK_DATA.buildings[r.home],
    key = 'res_' + id;
  SHOPS[key] = {
    name: (B && B.name) || r.role,
    keeper: r.name,
    who: id,
    greeting: `Welcome in! Everything’s priced in ${(CURRENCIES[(B && B.currency) || 'research'] || { name: 'Research' }).name}.`,
    stock: resStock(saveData, id, RESIDENTS, UNLOCK_DATA.unlocks),
    res: id,
    currency: (B && B.currency) || 'research',
  };
  return key;
}
/** a ware's price: its own or its base; in a run shop, with the Perks' price rows (RL-12, logic/effects.js) */
const warePrice = (sh, w, it) => {
  const p = w.price ?? it.base;
  return sh.runNode != null && saveData.run ? fxRunPrice(saveData.run, PERKS, 'shop', p) : p;
};
/** RL-12: a run shop's Perk today (logic/perks.js perkShelf, drawn when the shop opened): its id and price, or
 * null (not a run shop, bought, or none left) */
function shopPerk(sh) {
  const run = saveData.run;
  /* WM-5: a market stall sells no Perk (the owner) */
  if (sh.runNode == null || !run || sh.stall) return null;
  const id = run.shelf[sh.runNode + ':' + run.clock];
  if (!id || !PERKS[id]) return null;
  return { id, price: fxRunPrice(run, PERKS, 'shop', perkPrice(PERKS[id], RULES.run.perks)) };
}
/** RL-12: the Perk's row: what it does, its rarity and price, Buy */
function shopPerkHTML(id, sh) {
  const L = shopPerk(sh);
  if (!L) return '';
  const R = PERKS[L.id],
    can = saveData.se >= L.price;
  return `<div class="ware2 k-card"><span class="w-ic">${uiIconHTML('relic', 36)}</span><span class="w-t"><b>${escapeHtml(R.name)}</b><small>${escapeHtml(R.d)}</small><small class="note">A Perk, for the rest of the run · you hold ${saveData.run.perks.length} of ${RULES.run.perks.cap}</small></span><span class="w-buy"><button class="pb small ${can ? 'gold' : ''}" data-a="shoprelic" data-s="${id}" ${can ? '' : 'disabled'}>${moneyHTML(L.price)}</button></span></div>`;
}
/** RS-4: Mo's service on a run: ask this run shop for a fresh stock today (logic/run-loop.js runShopReroll) */
function shopRerollHTML(id, sh) {
  const run = saveData.run;
  if (sh.runNode == null || !run) return '';
  /* WM-5: a town's market stall has a fresh stock of its own (the owner) */
  const left = runRerollsLeft(run, RESIDENTS),
    done = runShopRerolled(run, sh.runNode, run.clock, sh.stall ? 'stall' : 'shop');
  if (!left && !done) return '';
  return done
    ? '<p class="note">Fresh stock, on Mo’s word.</p>'
    : `<p class="note"><button class="pb small" data-a="shopreroll" data-s="${id}">Fresh stock, on Mo’s word (${left} left this run)</button></p>`;
}
function shopReroll(id) {
  const sh = SHOPS[id],
    run = saveData.run;
  if (!sh || !run || sh.runNode == null) return;
  if (!runShopReroll(run, sh.runNode, run.clock, RESIDENTS, sh.stall ? 'stall' : 'shop')) return;
  sh.stock = sh.stall
    ? runStallStock(run, sh.runNode, run.clock, RULES.run.town.stall)
    : runShopOpen(run, sh.runNode, run.clock, RULES.run.shop, UNLOCK_DATA);
  uiState.shopQty = {};
  uiState.shopLine = sh.stall
    ? 'The stallholder rummages under the cart and lays out other pieces.'
    : 'The shopkeeper ducks into the back and comes out with other boxes.';
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', `${sh.stall ? 'stall' : 'shop'} restocked: ${sh.runNode}:${run.clock}`);
  saveNow();
  shopRefresh();
}
function shopHTML(id) {
  const sh = SHOPS[id],
    q = uiState.shopQty || (uiState.shopQty = {}),
    seats = saveData.seats.length;
  const rows = (sh.stock || [])
    .map((w, ix) => {
      const it = wareInfo(w);
      if (!it) return '';
      const k = ix + ':' + it.kind + ':' + it.key,
        n = q[k] || 1,
        price = warePrice(sh, w, it),
        locked = it.need && seats < it.need,
        cost = price * n,
        /* RS-4: a price in another currency is no deal on the Moneys one */
        deal = !sh.currency && price < it.base;
      return `<div class="ware2 k-card${locked ? ' locked' : ''}"><span class="w-ic">${it.kind === 'coin' ? pyramidHTML(it.key, 36) : itemIcon(it.key, 36)}</span><span class="w-t"><b>${escapeHtml(it.n)}</b><small>${escapeHtml(it.d)}</small><small class="w-own tnum">You have ${it.have}${deal ? ` · <em>Shop price ${moneyHTML(it.base)}</em>` : ''}</small></span>
  <span class="w-buy">${
    locked
      ? `<span class="note">Needs ${plural(it.need, 'badge')}</span>`
      : `<span class="qty"><button class="qb k-btn" data-a="shopq" data-k="${k}" data-d="-1" aria-label="One fewer" ${n <= 1 ? 'disabled' : ''}>${uiIconHTML('minus', 10)}</button><b class="tnum">${n}</b><button class="qb k-btn" data-a="shopq" data-k="${k}" data-d="1" aria-label="One more" ${n >= 99 ? 'disabled' : ''}>${uiIconHTML('plus', 10)}</button></span>
  <button class="pb small ${shopPurse(sh) >= cost ? 'gold' : ''}" data-a="shopbuy" data-s="${id}" data-k="${k}" ${shopPurse(sh) >= cost ? '' : 'disabled'}>${shopCostHTML(sh, cost)}</button>`
  }</span></div>`;
    })
    .join('');
  return `<div class="shop-head"><div class="shop-keeper">${portraitHTML(sh.who || 'clerk', 78, 'happy')}</div><div class="shop-say"><b>${escapeHtml(sh.keeper || 'Shopkeeper')}</b><p id="shopLine">${escapeHtml(uiState.shopLine || sh.greeting || 'Welcome in.')}</p></div></div>
 <div class="shop-bal">${sh.currency ? `<span>${uiIconHTML((CURRENCIES[sh.currency] || { icon: 'coin' }).icon, 14)} ${escapeHtml((CURRENCIES[sh.currency] || { name: sh.currency }).name)}</span><b class="tnum">${formatNumber(shopPurse(sh))}</b>` : `<span>${uiIconHTML('coin', 14)} Moneys</span><b class="tnum" data-count="shopse" data-to="${saveData.se}">${formatNumber(saveData.se)}</b>`}</div>
 <div class="shop-bag"><span>In your bag</span>${Object.keys(PYRAMIDS)
   .map(
     k =>
       `<span class="sb-c${saveData.pyramids[k] ? '' : ' none'}" role="img" title="${escapeHtml(PYRAMIDS[k].n)}" aria-label="${escapeHtml(PYRAMIDS[k].n)}: ${formatNumber(saveData.pyramids[k] || 0)}">${pyramidHTML(k, 18, 32)}<b class="tnum">${formatNumber(saveData.pyramids[k] || 0)}</b></span>`
   )
   .join(
     ''
   )}</div><div class="wares2">${shopRerollHTML(id, sh)}${shopPerkHTML(id, sh)}${rows || '<p class="note">The shelves are empty today.</p>'}</div>`;
}
export function openShop(id) {
  const sh = SHOPS[id];
  if (!sh) return;
  if (sh.kind === 'wardrobe' && typeof openDressingRoom === 'function') {
    if (uiState.modal) closeModal();
    openDressingRoom({ shop: id });
    return;
  }
  /* RL-8: a run town's shop has the day's stock (logic/run-loop.js runShopStock: its own stream for the day) */
  if (sh.runNode != null && saveData.run && sh.stall) {
    /* WM-5: a village's or a town's market stall: the day's held items, no Perk (logic/run-loop.js runStallStock) */
    sh.stock = runStallStock(saveData.run, sh.runNode, saveData.run.clock, RULES.run.town.stall);
  } else if (sh.runNode != null && saveData.run) {
    /* RL-11: only the wares the run has unlocked (its copy, run.unlocks) */
    sh.stock = runShopOpen(saveData.run, sh.runNode, saveData.run.clock, RULES.run.shop, UNLOCK_DATA);
    /* RL-12: and a Perk, drawn the first time it opens today (kept on the run, saved with the next save) */
    perkShelf(saveData.run, sh.runNode, saveData.run.clock, PERKS, RULES.run.perks);
  }
  /* RS-4: a resident's shop sells what their level has now */
  if (sh.res && !saveData.run) sh.stock = resStock(saveData, sh.res, RESIDENTS, UNLOCK_DATA.unlocks);
  uiState.shopLine = null;
  uiState.shopQty = {};
  const m = {
    title: escapeHtml(sh.name),
    shop: id,
    cls: 'shop-sheet',
    html: shopHTML(id),
    btns: [{ l: 'Leave the shop', c: 'quiet', f: closeModal }],
  };
  modal(m);
}
function shopRefresh() {
  const M = uiState.modal;
  if (!M || !M.shop) return;
  M.html = shopHTML(M.shop);
  renderOverlay();
}
function shopBuy(id, k) {
  const sh = SHOPS[id],
    [ix, kind, key] = k.split(':'),
    w = (sh.stock || [])[+ix];
  if (!w) return;
  const it = wareInfo(w);
  if (!it) return;
  const n = (uiState.shopQty || {})[k] || 1,
    price = warePrice(sh, w, it),
    cost = price * n;
  if (it.need && saveData.seats.length < it.need) return;
  if (shopPurse(sh) < cost) {
    toast(
      sh.currency
        ? `Not enough ${(CURRENCIES[sh.currency] || { name: sh.currency }).name}.`
        : 'Not enough Moneys. Win a few battles first.'
    );
    return;
  }
  if (sh.currency) saveData.meta[sh.currency] -= cost;
  else saveData.se -= cost;
  if (typeof soundEffect === 'function') soundEffect('buy');
  if (kind === 'coin') saveData.pyramids[key] = (saveData.pyramids[key] || 0) + n;
  else saveData.items[key] = (saveData.items[key] || 0) + n;
  /* RL-8: a run's purchase is a checkpoint */
  if (saveData.run) saveNow();
  else save();
  buzz && buzz(10);
  const lines = sh.thanks && sh.thanks.length ? sh.thanks : SHOP_THANKS;
  uiState.shopLine = lines[Math.floor(random() * lines.length)];
  uiState.shopQty[k] = 1;
  shopRefresh();
  toast(`Bought ${n} × ${it.n}.`);
}
/** RL-12: buy the shop's Perk (past the cap, which to let go first); a checkpoint, as every run purchase */
function shopPerkBuy(id, drop) {
  const sh = SHOPS[id],
    run = saveData.run,
    L = sh && shopPerk(sh);
  if (!L || !run) return;
  if (saveData.se < L.price) {
    toast('Not enough Moneys for that one.');
    return;
  }
  if (drop == null && run.perks.length >= RULES.run.perks.cap) {
    perkDropOpen(
      L.id,
      d => {
        openShop(id);
        shopPerkBuy(id, d);
      },
      () => openShop(id)
    );
    return;
  }
  if (perkBuy(run, sh.runNode, run.clock, PERKS, RULES.run.perks, drop)) return;
  saveData.se -= L.price;
  if (typeof soundEffect === 'function') soundEffect('buy');
  saveNow();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `Perk bought: ${L.id}${drop ? ` for ${drop}` : ''}`);
  shopRefresh();
  toast(`${PERKS[L.id].name}: ${PERKS[L.id].d}`);
}
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const d = el.dataset;
  if (d.a === 'shop') openShop(d.s);
  else if (d.a === 'shopq') {
    const q = uiState.shopQty || (uiState.shopQty = {});
    q[d.k] = clamp((q[d.k] || 1) + +d.d, 1, 99);
    shopRefresh();
  } else if (d.a === 'shopbuy') shopBuy(d.s, d.k);
  else if (d.a === 'shopreroll') shopReroll(d.s);
  else if (d.a === 'shoprelic') shopPerkBuy(d.s);
});
