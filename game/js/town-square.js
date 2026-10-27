'use strict';
/* ================= COPPERLEAF'S SQUARE: THINGS TO DO (hub track HB-10d) =================
   The fountain's coin: a tap on the fountain asks whether to toss one (its price in Scrap, once each time you come
   home), then shows how it went (logic/fountain-wish.js has the rules: rules.json square.wish). The notice board: the
   town's news (your last three runs, from meta.history), the favours the hub's folk asked of you (relations.json,
   RL-S2), the fountain's last coin; daily seeds and friends' teams are pinned up as coming (the roguelite track's
   RL-15). Nothing here is sent anywhere: the debug log keeps the outcome's id only. Hub sheets only. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, render, toast } from './hooks.js';
import { PEOPLE, RELATIONS, RULES, SPECIES } from './game-data.js';
import { wishCan, wishSaid, wishToss } from './logic/fountain-wish.js';
import { escapeHtml, save, saveData } from './game-state.js';
import { soundEffect, soundEffectAt } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  FAVOUR_WORDS: [() => FAVOUR_WORDS],
  LOST_TO: [() => LOST_TO],
  fountainWishOpen: [() => fountainWishOpen, v => (fountainWishOpen = v)],
  fountainWishToss: [() => fountainWishToss, v => (fountainWishToss = v)],
  townBoardOpen: [() => townBoardOpen, v => (townBoardOpen = v)],
  townNewsLine: [() => townNewsLine, v => (townNewsLine = v)],
});
/* eslint-enable no-func-assign */
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
