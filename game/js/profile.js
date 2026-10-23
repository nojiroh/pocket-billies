'use strict';
/* ================= TRAINER CARD ================= */
/* UI-5: the Trainer card (the profile screen), moved from ui.js as it was */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { plateVars } from './hooks.js';
import { clamp } from './util.js';
import { COINS, DEX_ORDER, ITEMS, LOCATIONS, TRAINERS } from './game-data.js';
import { billyName, dexCaught, dexSeen, findBilly, formatNumber, metresToKm, plural } from './logic/rules.js';
import { escapeHtml, saveData } from './game-state.js';
import { coinHTML, eggHTML, moneyHTML, uiIconHTML } from './art.js';
import { cleanTrainer, personHTML } from './person-art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { itemIcon } from './battle.js';
import { friendsHTML } from './friends.js';
import { progressBarHTML } from './ui-bits.js';
/* eslint-disable no-func-assign */
expose({
  badgeSlots: [() => badgeSlots, v => (badgeSlots = v)],
  renderProfile: [() => renderProfile, v => (renderProfile = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* ---------- trainer card ---------- */
function badgeSlots() {
  const own = Object.values(TRAINERS).filter(T => T.seat),
    tot = clamp(
      Math.max(own.length, ...own.map(T => +((/of (\d+)/.exec(T.seat.title || '') || [])[1] || 0))),
      own.length,
      12
    );
  const known = own.map(T => ({
    name: String(T.seat.title || 'Badge').split(' · ')[0],
    leader: T.name,
    coin: COINS[T.seat.coin] ? T.seat.coin : 'pyramid',
    got: saveData.seats.includes(T.seat.id),
  }));
  return {
    got: known.filter(b => b.got).length,
    tot,
    html:
      known
        .map(b =>
          b.got
            ? `<li class="bdg got"><span class="bdg-m" title="${escapeHtml(b.name)}, from ${escapeHtml(b.leader)}">${coinHTML(b.coin, 30, 32)}</span><small>${escapeHtml(b.name.replace(/ Badge$/, ''))}</small></li>`
            : `<li class="bdg"><span class="bdg-m" title="Beat ${escapeHtml(b.leader)} to earn it">?</span><small>${escapeHtml(b.leader.replace(/^Leader /, ''))}</small></li>`
        )
        .join('') +
      Array.from(
        { length: tot - known.length },
        () => '<li class="bdg none"><span class="bdg-m"></span><small>???</small></li>'
      ).join(''),
  };
}
export function renderProfile() {
  const name = cleanTrainer(saveData.avatar, saveData.gender).name,
    seen = DEX_ORDER.filter(dexSeen).length,
    got = DEX_ORDER.filter(dexCaught).length,
    places = LOCATIONS.filter((r, i) => saveData.visited[i]).length,
    bd = badgeSlots(),
    bud = findBilly(saveData.buddy);
  const beat = Object.keys(saveData.flags).filter(k => TRAINERS[k] && saveData.flags[k]).length,
    since = saveData.since
      ? new Date(saveData.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
  const tile = (ic, k, v, sub, p) =>
    `<div class="pf-tile k-card"><span class="pf-k">${ic}${k}</span><b class="tnum">${v}</b>${sub ? `<small>${sub}</small>` : ''}${p != null ? progressBarHTML(p, 'gold') : ''}</div>`;
  const items = Object.keys(ITEMS).filter(k => saveData.items[k] > 0);
  return `<header class="bar"><div><div class="sub">Your profile</div><h1 class="where">Trainer</h1></div><button class="pb small" data-a="tab" data-t="ledger">${uiIconHTML('ledger', 16)} Guide</button><button class="pb small quiet" data-a="settings">${uiIconHTML('gear', 16)} Settings</button></header>
 <div class="pf-top"><section class="tcard k-panel">
  <div class="tc-band"><span>Trainer card</span><span class="tnum">ID No. ${String(saveData.tid || 0).padStart(5, '0')}</span></div>
  <div class="tc-body"><div class="tc-photo k-card"><div class="tc-portrait">${personHTML('me', 92)}</div><button class="pb small" data-a="customize">Edit look</button></div>
   <div class="tc-info"><h2 class="tc-name">${escapeHtml(name)}</h2><dl class="tc-dl"><div><dt>Moneys</dt><dd class="tnum">${moneyHTML(saveData.se, 16)}</dd></div><div><dt>Now in</dt><dd>${escapeHtml(LOCATIONS[saveData.trip.node].name)}</dd></div>${since ? `<div><dt>Started</dt><dd>${escapeHtml(since)}</dd></div>` : ''}<div><dt>Buddy</dt><dd>${bud ? escapeHtml(billyName(bud)) : 'None yet'}</dd></div></dl></div></div>
  <div class="tc-badges"><div class="tc-bh"><span>Badges</span><b class="tnum">${bd.got} of ${bd.tot}</b></div><ol class="bdgs">${bd.html}</ol></div>
 </section>
 <section class="tpanel pf-stats"><div class="sec-h"><h2>Records</h2></div><div class="pf-grid">
  ${tile(uiIconHTML('run', 14), 'Distance walked', `${metresToKm((saveData.stats && saveData.stats.walked) || 0)} km`)}${tile(uiIconHTML('map', 14), 'Places visited', `${places}/${LOCATIONS.length}`, null, places / LOCATIONS.length)}
  ${tile(uiIconHTML('ledger', 14), 'Seen', `${seen}/${DEX_ORDER.length}`, null, seen / DEX_ORDER.length)}${tile(coinHTML('pyramid', 14), 'Caught', `${got}/${DEX_ORDER.length}`, null, got / DEX_ORDER.length)}
  ${tile(uiIconHTML('fight', 14), 'Trainers beaten', formatNumber(beat))}${tile(eggHTML(2, 12), 'Eggs hatched', formatNumber(saveData.hatched || 0), saveData.ranch.nursery.length ? `${plural(saveData.ranch.nursery.length, 'egg')} at the ranch` : 'No eggs right now')}
 </div></section></div>
 <div class="pf-row">${bud ? `<section class="tpanel pf-buddy"><div class="sec-h"><h2>Buddy</h2></div><button class="pf-bud k-card" data-a="mon" data-u="${bud.uid}"><span class="tm-spr" style="${plateVars(bud)}">${rigCanvasHTML(bud.sp, 72, { build: bud.build, coat: bud.coat })}</span><span class="pf-bt"><b>${escapeHtml(billyName(bud))}</b><span class="tnum">Lv ${bud.lvl}</span><small>Gets the full XP of every battle you win.</small></span></button></section>` : ''}
 <section class="tpanel pf-bag"><div class="sec-h"><h2>Bag</h2></div>
  <div class="pf-coins">${Object.keys(COINS)
    .map(
      k =>
        `<span class="pf-coin${saveData.coins[k] ? '' : ' none'}" title="${escapeHtml(COINS[k].n)}">${coinHTML(k, 22, 32)}<small>${escapeHtml(COINS[k].n.replace(/ Coins?$/, ''))}</small><b class="tnum">${formatNumber(saveData.coins[k] || 0)}</b></span>`
    )
    .join('')}</div>
  ${items.length ? `<ul class="pf-items">${items.map(k => `<li>${itemIcon(k, 24)}<span>${escapeHtml(ITEMS[k].n)}</span><b class="tnum">×${formatNumber(saveData.items[k])}</b></li>`).join('')}</ul>` : '<p class="note">No items yet.</p>'}
  <p class="note">Buy pyramids and items at a town shop.</p></section></div>${typeof friendsHTML === 'function' ? friendsHTML() : ''}`;
}
