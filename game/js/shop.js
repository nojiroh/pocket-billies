'use strict';
/* ================= TOWN SHOPS =================
   Shops live in data (GAMEDATA.shops) and are attached to route stops (route[].shop).
   Each shop has a keeper (drawn by the trainer renderer from PEOPLE), a greeting and a stock list. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, provide, renderOverlay, sfx, toast } from './hooks.js';
import { clamp, random } from './util.js';
import { COINS, ITEMS, SHOPS } from './game-data.js';
import { escapeHtml, formatNumber, plural, save, saveData, uiState } from './game-state.js';
import { coinHTML, uiIconHTML } from './art.js';
import { portraitHTML } from './person-art.js';
import { openDressingRoom } from './dressing-room.js';
import { buzz } from './battle-stage.js';
import { itemIcon } from './battle.js';
/* eslint-disable no-func-assign */
expose({
  SHOP_THANKS: [() => SHOP_THANKS],
  openShop: [() => openShop, v => setOpenShop(v)],
  shopBuy: [() => shopBuy, v => (shopBuy = v)],
  shopHTML: [() => shopHTML, v => (shopHTML = v)],
  shopRefresh: [() => shopRefresh, v => (shopRefresh = v)],
  wareInfo: [() => wareInfo],
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
    const c = COINS[w.coin];
    return c
      ? {
          kind: 'coin',
          key: w.coin,
          n: c.n,
          d: c.d,
          base: c.price,
          need: c.need || 0,
          have: saveData.coins[w.coin] || 0,
        }
      : null;
  }
  const I = ITEMS[w.item];
  return I
    ? { kind: 'item', key: w.item, n: I.n, d: I.d, base: I.price, need: 0, have: saveData.items[w.item] || 0 }
    : null;
};
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
        price = w.price ?? it.base,
        locked = it.need && seats < it.need,
        cost = price * n,
        deal = price < it.base;
      return `<div class="ware2${locked ? ' locked' : ''}"><span class="w-ic">${it.kind === 'coin' ? coinHTML(it.key, 36) : itemIcon(it.key, 36)}</span><span class="w-t"><b>${escapeHtml(it.n)}</b><small>${escapeHtml(it.d)}</small><small class="w-own tnum">You have ${it.have}${deal ? ` · <em>Shop price $${formatNumber(it.base)}</em>` : ''}</small></span>
  <span class="w-buy">${
    locked
      ? `<span class="note">Needs ${plural(it.need, 'badge')}</span>`
      : `<span class="qty"><button class="qb" data-a="shopq" data-k="${k}" data-d="-1" aria-label="One fewer" ${n <= 1 ? 'disabled' : ''}>${uiIconHTML('minus', 10)}</button><b class="tnum">${n}</b><button class="qb" data-a="shopq" data-k="${k}" data-d="1" aria-label="One more" ${n >= 99 ? 'disabled' : ''}>${uiIconHTML('plus', 10)}</button></span>
  <button class="pb small ${saveData.se >= cost ? 'gold' : ''}" data-a="shopbuy" data-s="${id}" data-k="${k}" ${saveData.se >= cost ? '' : 'disabled'}>$${formatNumber(cost)}</button>`
  }</span></div>`;
    })
    .join('');
  return `<div class="shop-head"><div class="shop-keeper">${portraitHTML(sh.who || 'clerk', 78, 'happy')}</div><div class="shop-say"><b>${escapeHtml(sh.keeper || 'Shopkeeper')}</b><p id="shopLine">${escapeHtml(uiState.shopLine || sh.greeting || 'Welcome in.')}</p></div></div>
 <div class="shop-bal"><span>${uiIconHTML('coin', 14)} Money</span><b class="tnum" data-count="shopse" data-to="${saveData.se}">${formatNumber(saveData.se)}</b></div>
 <div class="shop-bag"><span>In your bag</span>${Object.keys(COINS)
   .map(
     k =>
       `<span class="sb-c${saveData.coins[k] ? '' : ' none'}" role="img" title="${escapeHtml(COINS[k].n)}" aria-label="${escapeHtml(COINS[k].n)}: ${formatNumber(saveData.coins[k] || 0)}">${coinHTML(k, 18, 32)}<b class="tnum">${formatNumber(saveData.coins[k] || 0)}</b></span>`
   )
   .join('')}</div><div class="wares2">${rows || '<p class="note">The shelves are empty today.</p>'}</div>`;
}
export function openShop(id) {
  const sh = SHOPS[id];
  if (!sh) return;
  if (sh.kind === 'wardrobe' && typeof openDressingRoom === 'function') {
    if (uiState.modal) closeModal();
    openDressingRoom({ shop: id });
    return;
  }
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
    price = w.price ?? it.base,
    cost = price * n;
  if (it.need && saveData.seats.length < it.need) return;
  if (saveData.se < cost) {
    toast('Not enough money. Walk a little first.');
    return;
  }
  saveData.se -= cost;
  if (typeof sfx === 'function') sfx('buy');
  if (kind === 'coin') saveData.coins[key] = (saveData.coins[key] || 0) + n;
  else saveData.items[key] = (saveData.items[key] || 0) + n;
  save();
  buzz && buzz(10);
  const lines = sh.thanks && sh.thanks.length ? sh.thanks : SHOP_THANKS;
  uiState.shopLine = lines[Math.floor(random() * lines.length)];
  uiState.shopQty[k] = 1;
  shopRefresh();
  toast(`Bought ${n} × ${it.n}.`);
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
});
