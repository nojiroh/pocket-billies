'use strict';
/* ================= COPPERLEAF'S SQUARE: THINGS TO DO (hub track HB-10d) =================
   The fountain's coin: a tap on the fountain asks whether to toss one (its price in Scrap, once each time you come
   home), then shows how it went (logic/fountain-wish.js has the rules: rules.json square.wish). The notice board: the
   town's news (your last three runs, from meta.history), the favours the hub's folk asked of you (relations.json,
   RL-S2), the fountain's last coin; daily seeds and friends' teams are pinned up as coming (the roguelite track's
   RL-15). Nothing here is sent anywhere: the debug log keeps the outcome's id only. Hub sheets only.
   HB-10e: the festival on today (festivalToday: festivals.json by the ranch clock, logic/festival.js), its market at
   the square's middle stall (act `fest`), and the board's line for it and what is coming. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, provide, render, renderOverlay, toast } from './hooks.js';
import { FESTIVALS, ITEMS, PEOPLE, PYRAMIDS, RELATIONS, RULES, SPECIES } from './game-data.js';
import { formatNumber } from './logic/rules.js';
import { ranchNow } from './logic/ranch-clock.js';
import { wishCan, wishSaid, wishToss } from './logic/fountain-wish.js';
import { festBuy, festDate, festNext, festStock, festivalOn } from './logic/festival.js';
import { storyHolds } from './logic/script.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { pyramidHTML } from './art.js';
import { itemIcon } from './battle.js';
import { soundEffect, soundEffectAt } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  FAVOUR_WORDS: [() => FAVOUR_WORDS],
  LOST_TO: [() => LOST_TO],
  festBusy: [() => festBusy, v => (festBusy = v)],
  festCache: [() => festCache, v => (festCache = v)],
  festMarketHTML: [() => festMarketHTML, v => (festMarketHTML = v)],
  festSaid: [() => festSaid, v => (festSaid = v)],
  festWare: [() => festWare, v => (festWare = v)],
  festivalArrive: [() => festivalArrive, v => ((festivalArrive = v), provide({ festivalArrive }))],
  festivalBoardLines: [() => festivalBoardLines, v => (festivalBoardLines = v)],
  festivalForce: [() => festivalForce, v => setFestivalForce(v)],
  festivalMarketBuy: [() => festivalMarketBuy, v => (festivalMarketBuy = v)],
  festivalMarketOpen: [() => festivalMarketOpen, v => (festivalMarketOpen = v)],
  festivalToday: [() => festivalToday, v => ((festivalToday = v), provide({ festivalToday }))],
  fountainWishOpen: [() => fountainWishOpen, v => (fountainWishOpen = v)],
  fountainWishToss: [() => fountainWishToss, v => (fountainWishToss = v)],
  setFestivalForce: [() => setFestivalForce, v => (setFestivalForce = v)],
  squareDayNow: [() => squareDayNow, v => ((squareDayNow = v), provide({ squareDayNow }))],
  townBoardOpen: [() => townBoardOpen, v => (townBoardOpen = v)],
  townNewsLine: [() => townNewsLine, v => (townNewsLine = v)],
});
/* eslint-enable no-func-assign */
provide({ festivalArrive, festivalToday, squareDayNow });
/* to-module: end */
/** tap the square's fountain: toss a coin, if you can @param {{ x: number, z: number }} [p] the fountain */
export function fountainWishOpen(p) {
  const s = saveData,
    R = RULES.square && RULES.square.wish;
  if (!R || !s.meta) return;
  if (s.run) {
    toast('The fountain burbles. Toss a coin when you’re home.');
    return;
  }
  const can = wishCan(s.meta, R),
    price = `<pb-coin kind="${R.cost.cur}" value="${R.cost.n}" label="Scrap"></pb-coin>`;
  if (can === 'done') {
    toast('You’ve tossed your coin. The fountain wants a new story first: come back after your next run.');
    return;
  }
  modal({
    title: 'Fountain',
    cls: 'wish-sheet',
    html:
      `<p>Toss a coin for luck? It costs ${price}, once each time you come home. Mostly it helps your next run a little. ` +
      `Now and then it doesn’t.</p>` +
      (can === 'poor' ? `<p class="note">You have ${s.meta[R.cost.cur] || 0} Scrap.</p>` : ''),
    btns: [
      ...(can === 'ok' ? [{ l: `Toss a coin (${R.cost.n} Scrap)`, f: () => fountainWishToss(p) }] : []),
      { l: 'Not now', c: 'quiet', f: closeModal },
    ],
  });
}

/* how a run ended, in the town's words (logic/run-history.js RunLostTo kinds) */
const LOST_TO = {
  wild: 'a wild Billie',
  route: 'a trainer on the road',
  event: 'something odd on the way',
  miniboss: 'a mini-boss',
  boss: 'the boss',
  rival: 'Blake',
  trainer: 'a trainer',
};
/* a favour's ask in plain words, by its check (relations.json favour.check: RL-S2 part B's three) */
const FAVOUR_WORDS = [
  [/^last:leaders >= (\d+)$/, n => `beat ${n === '1' ? 'a leader' : `${n} leaders`} on a run`],
  [/^last:row >= (\d+)$/, n => `reach row ${n} of a run’s map`],
  [/^lastteam:(\w+)$/, t => `bring a ${t} Billie home from a run`],
];

/** one run of the history in the town's words @param {any} e */
function townNewsLine(e) {
  const where = escapeHtml(e.region || 'the wild lands');
  if (e.end === 'won') return `<b>${where}</b>: won! The train came home gold.`;
  if (e.end === 'quit') return `<b>${where}</b>: came home early, at row ${e.row}.`;
  const by = e.by || {},
    who = by.bureau
      ? 'the Bureau'
      : by.kind === 'wild' && by.sp && SPECIES[by.sp]
        ? `a wild ${escapeHtml(SPECIES[by.sp].name)}`
        : LOST_TO[by.kind] || 'something';
  return `<b>${where}</b>: lost to ${who} at row ${e.row}.`;
}

/** tap the square's notice board */
export function townBoardOpen() {
  const s = saveData,
    M = s.meta;
  if (!M) return;
  const news = (M.history || []).slice(-3).reverse().map(townNewsLine),
    quests = (s.story && s.story.quests) || {},
    favours = Object.entries((RELATIONS && RELATIONS.people) || {})
      .filter(([, P]) => P.favour && quests[P.favour.quest] === 'asked')
      .map(([who, P]) => {
        const name = (PEOPLE[who] && PEOPLE[who].look && PEOPLE[who].look.name) || who,
          W = FAVOUR_WORDS.find(([re]) => re.test(P.favour.check)),
          ask = W ? W[1](P.favour.check.match(W[0])[1]) : 'a favour on your next run';
        return `<b>${escapeHtml(name)}</b> asks: ${escapeHtml(ask)}.`;
      }),
    R = RULES.square && RULES.square.wish,
    coin = R ? wishSaid(M, R) : null,
    pin = (/** @type {string} */ h, /** @type {string[]} */ L, /** @type {string} */ none) =>
      `<section class="tpanel"><div class="sec-h"><h2>${h}</h2></div>${
        L.length ? L.map(l => `<p>${l}</p>`).join('') : `<p class="note">${none}</p>`
      }</section>`;
  modal({
    title: 'Notice board',
    cls: 'town-board-sheet',
    html:
      pin('Town news', news, 'Nothing yet. The town is waiting for your first run.') +
      pin('Favours', favours, 'Nobody has asked you for anything. Enjoy it.') +
      pin(
        'Fountain',
        coin ? [escapeHtml(coin)] : [],
        R && wishCan(M, R) === 'done'
          ? 'Your coin is in.'
          : 'No coin in yet since you came home. The fountain is listening.'
      ) +
      /* HB-10e: what is on and what is coming */
      pin('Festivals', festivalBoardLines(), 'Nothing on the calendar. Suspiciously quiet.') +
      `<p class="note">Pinned at the bottom, curling: “Daily seeds and friends’ teams: coming soon.”</p>`,
    btns: [{ l: 'Close', c: 'quiet', f: closeModal }],
  });
}

function fountainWishToss(p) {
  const R = RULES.square.wish,
    r = wishToss(saveData.meta, R);
  if (!r) {
    closeModal();
    return;
  }
  save();
  if (typeof debugLog !== 'undefined') debugLog.add('hub', `fountain coin: ${r.out.id}`);
  if (typeof soundEffect === 'function') soundEffect('coin');
  if (p && typeof soundEffectAt === 'function') setTimeout(() => soundEffectAt('plop', p.x, p.z), 350);
  /* queued before the ask closes, so the result comes next (before any window waiting its turn) */
  modal({
    title: 'Fountain',
    cls: 'wish-sheet',
    html: `<p>${escapeHtml(r.say)}</p>`,
    btns: [{ l: 'OK', f: closeModal }],
  });
  closeModal();
  render();
}

/* ---------- HB-10e: festivals ---------- */
/** a festival forced on (the debug menu, the in-game test, island-shots.py --festival): { id, at } or null */
export let festivalForce = /** @type {{ id: string, at?: number } | null} */ (null);
/** @param {{ id: string, at?: number } | null} v */
function setFestivalForce(v) {
  festivalForce = v && typeof v.id === 'string' ? v : null;
  festCache = null;
}
let festCache = /** @type {{ s: any, key: string, on: any } | null} */ (null),
  festBusy = false;
/** the festival on in Copperleaf now for a save (logic/festival.js festivalOn), or null: none on a run, none while a
 * milestone's own condition is being read (it can't wait on a festival). The date is the ranch clock's
 * (logic/ranch-clock.js: a clock turned back stands still at the save's mark) on the phone's calendar. Kept until the
 * day, the runs or the last run change @param {any} [s] the save (the playing one unless given)
 * @returns {import('./logic/festival.js').FestOn | null} */
export function festivalToday(s = saveData) {
  if (!s || !s.meta || s.run || !FESTIVALS || festBusy) return null;
  if (festivalForce) {
    const F = FESTIVALS.festivals[festivalForce.id];
    return F ? { id: festivalForce.id, F, at: festivalForce.at ?? s.meta.runs ?? 0 } : null;
  }
  const now = s.ranch && RULES.ranch ? ranchNow(s, Date.now(), RULES.ranch).now : Date.now(),
    D = festDate(now, new Date(now).getTimezoneOffset()),
    H = s.meta.history || [],
    key = `${D.day}|${s.meta.runs}|${s.meta.wins}|${H.length}|${(H[H.length - 1] || {}).seed || ''}|${s.meta.chapter}`;
  if (festCache && festCache.s === s && festCache.key === key) return festCache.on;
  festBusy = true;
  let on = null;
  try {
    on = festivalOn(FESTIVALS, s.meta, D, c => storyHolds(c, s));
  } finally {
    festBusy = false;
  }
  festCache = { s, key, on };
  return on;
}
provide({ festivalToday });
/** the square's day now: the festival's own (more folk, out longer) or rules.json square.day */
function squareDayNow() {
  const on = festivalToday();
  return on && on.F.day ? on.F.day : RULES.square.day;
}
provide({ squareDayNow });

/** a ware of the festival market, as the sheet shows it @param {{ item?: string, coin?: string }} w */
function festWare(w) {
  if (w.coin && PYRAMIDS[w.coin])
    return { name: PYRAMIDS[w.coin].n, icon: pyramidHTML(w.coin, 36), d: 'A coin to throw' };
  const I = w.item ? ITEMS[w.item] : null;
  return I ? { name: I.n, icon: itemIcon(w.item, 36), d: I.d || '' } : { name: '?', icon: '', d: '' };
}
function festMarketHTML() {
  const on = festivalToday(),
    M = saveData.meta,
    cur = (FESTIVALS && FESTIVALS.cur) || 'scrap',
    have = /** @type {any} */ (M)[cur] || 0;
  if (!on) return '';
  const rows = festStock(on, M)
    .map(({ i, ware, left }) => {
      const W = festWare(ware),
        can = left > 0 && have >= ware.price;
      return `<div class="ware2 k-card${left ? '' : ' locked'}"><span class="w-ic">${W.icon}</span><span class="w-t"><b>${escapeHtml(W.name)}</b><small>${escapeHtml(W.d)}</small><small class="note">${left ? `${left} left this time` : 'Sold out'}</small></span><span class="w-buy"><button class="pb small ${can ? 'gold' : ''}" data-a="festbuy" data-i="${i}" ${can ? '' : 'disabled'}><pb-coin kind="${cur}" value="${ware.price}" label="Scrap"></pb-coin></button></span></div>`;
    })
    .join('');
  return `<p>${escapeHtml(on.F.about)}</p><p class="note">Into your bag for the next run. You have ${formatNumber(have)} Scrap.</p><div class="wares2">${rows}</div>`;
}
/** tap the square's middle stall: the festival market, on a festival or market day */
export function festivalMarketOpen() {
  if (saveData.run) {
    toast('The stall’s shutters are down. The market is for when you’re home.');
    return;
  }
  const on = festivalToday();
  if (!on) {
    toast('The middle stall’s keeper polishes an apple. “Come back on a market day, or for a festival.”');
    return;
  }
  modal({
    title: on.F.name,
    cls: 'shop-sheet fest-sheet',
    fest: 1,
    html: festMarketHTML(),
    btns: [{ l: 'Leave the stall', c: 'quiet', f: closeModal }],
  });
}
/** buy one of the festival market's wares @param {number} i its place in the stock */
function festivalMarketBuy(i) {
  const on = festivalToday();
  if (!on || !FESTIVALS) return;
  const r = festBuy(saveData, on, i, FESTIVALS.cur);
  if (r === 'poor') toast('Not enough Scrap for that one.');
  else if (r === 'gone') toast('Sold out. Maybe next time.');
  else {
    save();
    if (typeof soundEffect === 'function') soundEffect('buy');
    if (typeof debugLog !== 'undefined') debugLog.add('hub', `festival market: ${on.id} ware ${i}`);
    toast(`Bought ${festWare(on.F.stock[i]).name}. It’s in your bag for the next run.`);
  }
  const M = /** @type {any} */ (uiState.modal);
  if (M && M.fest) {
    M.html = festMarketHTML();
    renderOverlay();
  }
}
document.addEventListener('click', ev => {
  const el = /** @type {HTMLElement | null} */ (ev.target instanceof Element ? ev.target.closest('[data-a]') : null);
  if (el && el.dataset.a === 'festbuy') festivalMarketBuy(+(el.dataset.i || 0));
});

let festSaid = '';
/** a scene with the square's middle stall is ready: a festival on that hasn't been said this session is said
 * @param {any} sc the scene */
function festivalArrive(sc) {
  if (!sc || !(sc.props || []).some((/** @type {any} */ p) => p.act === 'fest')) return;
  const on = festivalToday(),
    key = on ? `${on.id}@${on.at}` : '';
  if (!on || key === festSaid) return;
  festSaid = key;
  toast(`${on.F.name}! ${on.F.about}`);
  if (typeof debugLog !== 'undefined') debugLog.add('hub', `festival: ${key}`);
}
/** the notice board's festival lines: what is on now, and what is coming @returns {string[]} */
function festivalBoardLines() {
  const s = saveData,
    on = festivalToday();
  if (!s || !s.meta || !FESTIVALS) return [];
  const L = on ? [`<b>Today: ${escapeHtml(on.F.name)}!</b> ${escapeHtml(on.F.about)} The middle stall has wares.`] : [];
  const now = s.ranch && RULES.ranch ? ranchNow(s, Date.now(), RULES.ranch).now : Date.now(),
    D = festDate(now, new Date(now).getTimezoneOffset());
  for (const n of festNext(FESTIVALS, s.meta, D).slice(0, 3))
    if (!on || n.id !== on.id)
      L.push(
        n.days != null
          ? `<b>${escapeHtml(n.F.name)}</b> in ${n.days === 1 ? 'a day' : `${n.days} days`}.`
          : `<b>${escapeHtml(n.F.name)}</b> ${n.runs === 1 ? 'after your next run' : `in ${n.runs} runs`}.`
      );
  return L;
}
