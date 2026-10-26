// @ts-check
'use strict';
/* ================= REWARD PICKS (roguelite track RL-12b) =================
   After a route trainer's (or the rival's) battle, and when an event says so, a pick of 1 of rules.json run.rewards.pick
   cards (rewards.json): items into the bag (a Protein Bar is a candy, the Shining Stone an evolution item: both are
   items), pyramids, or a move tutor (a move a Billie of the team can learn: its line's, above its level, or one of
   its types that some line learns). A paid reroll draws them again: run.rewards.reroll Moneys, times `grow` each time.
   - the cards come from the run's reward stream, rngFrom(run.seed, 'reward|' + n + '|' + rolls), n the picks made
     before (run.enc.rewardN); the pick is saved in run.enc.reward before it shows, so a reload shows the same;
   - a card is only drawn when it can be used: an evolution item when a Billie of the team evolves with it, a tutor
     when a Billie has a move to learn; a `held` card (RL-12c) when some held item (items.json `hold`) is held by
     nobody on the team: its item is drawn from those, and taking it gives it to a Billie (or into the bag);
   - none twice in one pick.
   RL-14: beating bots leaves a salvage pick in the same place (run.enc.reward, kind 'salvage'): two of their parts and
   a stack of Scrap (logic/factions.js salvageCards, from the run's salvage stream); a part goes into your parts
   (saveData.parts, kept whatever the run's end), Scrap into the meta's. A salvage pick is never rerolled.
   Logic only: no DOM, no Date, no Math.random (tools/test/rewards.test.mjs). */
/** @import { Run, Billy, RewardCard, RunReward } from '../../types/save-data' */
/** @typedef {{ kind: RewardCard['kind'], item?: string, pyramid?: string, n?: number, weight: number }} RewardRow */
/** @typedef {{ cards: Record<string, RewardRow>, rules: { pick: number, reroll: number, grow: number },
 *   team: Billy[], species: Record<string, any>, lines: Record<string, any>, moves: Record<string, any>,
 *   slots: number, items?: Record<string, { hold?: unknown[] }>, newUid?: () => string }} RewardData items (RL-12c):
 *   the held items' table; newUid (RL-14): a new part's uid (rules.js newUid: a run's own counter) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ITEMS, LINE_BY_ID, MOVES, REWARDS, RULES, SPECIES } from '../game-data.js';
import { rngFrom } from './rng.js';
import { newPart } from './fighters.js';
import { moveSlotCount, newUid } from './rules.js';
import { salvageCards, salvageParts } from './factions.js';
import { heldGive, heldIds } from './held.js';
import { encOf } from './run-enc.js';
/* eslint-disable no-func-assign */
expose({
  evoUsable: [() => evoUsable],
  rewardDataGame: [() => rewardDataGame],
  // @ts-expect-error -- replaced on purpose
  rewardDraw: [() => rewardDraw, v => (rewardDraw = v)],
  // @ts-expect-error -- replaced on purpose
  rewardOfferMake: [() => rewardOfferMake, v => (rewardOfferMake = v)],
  // @ts-expect-error -- replaced on purpose
  rewardReroll: [() => rewardReroll, v => (rewardReroll = v)],
  rewardRerollCost: [() => rewardRerollCost],
  // @ts-expect-error -- replaced on purpose
  rewardTake: [() => rewardTake, v => (rewardTake = v)],
  // @ts-expect-error -- replaced on purpose
  salvageOfferMake: [() => salvageOfferMake, v => (salvageOfferMake = v)],
  // @ts-expect-error -- replaced on purpose
  tutorMoves: [() => tutorMoves, v => (tutorMoves = v)],
  tutorWho: [() => tutorWho],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the moves a Billie may be taught: its line's above its level, then the moves of its types that some line learns,
 * none it knows, by id within each group @param {Billy} m @param {RewardData} D @returns {string[]} */
export function tutorMoves(m, D) {
  const S = m.kind === 'robot' ? null : D.species[m.sp],
    L = S && D.lines[S.line];
  if (!S || !L) return [];
  const known = new Set(m.moves),
    own = L.learn
      .filter((/** @type {any[]} */ [lv, mv]) => lv > m.lvl && D.moves[mv] && !known.has(mv))
      .map((/** @type {any[]} */ e) => e[1]),
    all = new Set();
  for (const l of Object.values(D.lines)) for (const [, mv] of l.learn || []) all.add(mv);
  const typed = [...all]
    .filter(mv => D.moves[mv] && S.types.includes(D.moves[mv].t) && !known.has(mv) && !own.includes(mv))
    .sort();
  return [...new Set(own)].sort().concat(typed);
}

/** the Billies of the team that can learn a move (tutorMoves has it) @param {string} move @param {RewardData} D */
export const tutorWho = (move, D) => D.team.filter(m => tutorMoves(m, D).includes(move));

/** whether a Billie of the team evolves with this item (its species' evolution is by item, that item)
 * @param {string} item @param {RewardData} D */
export const evoUsable = (item, D) =>
  D.team.some(m => {
    const S = m.kind === 'robot' ? null : D.species[m.sp],
      e = S && S.evo;
    return !!e && e.k === 'item' && (e.item || 'bell') === item;
  });

/**
 * Draw a pick's cards: by weight from `g`, none twice, only those that can be used (rewardDraw's rules above); a
 * tutor card gets its move drawn from the moves the team can learn. `kind` keeps to one kind (an event's "reward
 * tutor"); `n` cards (the rules' pick when not given).
 * @param {{ pick: (w: Record<string, number>) => string, int: (lo: number, hi: number) => number }} g
 * @param {RewardData} D @param {{ kind?: string, n?: number }} [o] @returns {RewardCard[]}
 */
export function rewardDraw(g, D, o = {}) {
  const n = o.n || D.rules.pick,
    tutors = [...new Set(D.team.flatMap(m => tutorMoves(m, D)))].sort(),
    helds = heldIds(D.items || {}).filter(k => !D.team.some(m => m.held === k)),
    ok = (/** @type {string} */ id) => {
      const R = D.cards[id];
      if (!(R.weight > 0) || (o.kind && R.kind !== o.kind)) return false;
      if (R.kind === 'held') return helds.length > 0;
      if (R.kind === 'evo') return !!R.item && evoUsable(R.item, D);
      if (R.kind === 'tutor') return tutors.length > 0;
      return true;
    };
  let left = Object.keys(D.cards).filter(ok).sort();
  const out = /** @type {RewardCard[]} */ ([]),
    taught = new Set(),
    given = new Set();
  while (out.length < n && left.length) {
    const id = g.pick(Object.fromEntries(left.map(k => [k, D.cards[k].weight]))),
      R = D.cards[id];
    if (R.kind === 'tutor') {
      const free = tutors.filter(mv => !taught.has(mv));
      if (!free.length) {
        left = left.filter(k => k !== id);
        continue;
      }
      const mv = free[g.int(0, free.length - 1)];
      taught.add(mv);
      out.push({ id, kind: 'tutor', move: mv });
      /* a tutor card may come again in the same pick, with another move, while the team has some */
      if (taught.size >= tutors.length || !o.kind) left = left.filter(k => k !== id);
      continue;
    }
    if (R.kind === 'held') {
      const free = helds.filter(k => !given.has(k)),
        item = free[g.int(0, free.length - 1)];
      given.add(item);
      out.push({ id, kind: 'held', item });
      /* like a tutor's: a pick of held items only (`kind`) may hold several, each another item */
      if (given.size >= helds.length || !o.kind) left = left.filter(k => k !== id);
      continue;
    }
    out.push({
      id,
      kind: R.kind,
      ...(R.item ? { item: R.item } : {}),
      ...(R.pyramid ? { item: 'coin_' + R.pyramid } : {}),
      ...(R.n && R.n > 1 ? { n: R.n } : {}),
    });
    left = left.filter(k => k !== id);
  }
  return out;
}

/** make the next pick: run.enc.reward is set (null when nothing can be offered) and the counter moves on; the caller
 * saves before showing it @param {Run} run @param {string} from who left it (a trainer's id, 'event:<id>')
 * @param {RewardData} D @param {{ kind?: string, n?: number }} [o] @returns {RunReward | null} */
export function rewardOfferMake(run, from, D, o = {}) {
  const e = encOf(run),
    cards = rewardDraw(rngFrom(run.seed, 'reward|' + e.rewardN + '|0'), D, o);
  e.rewardN++;
  e.reward = cards.length
    ? { cards, rolls: 0, from, ...(o.kind ? { kind: o.kind } : {}), ...(o.n ? { n: o.n } : {}) }
    : null;
  return e.reward;
}

/** RL-14: make a salvage pick after beating bots (in place of a reward pick): run.enc.reward is set, from the run's
 * salvage stream (rngFrom(run.seed, 'salvage|' + its counter)), null when nothing can be offered
 * @param {Run} run @param {string} from who left it (a trainer's id, 'wild') @param {any[]} bots the robots beaten
 * @param {import('../../types/game-data').Faction['salvage']} S the faction's salvage rules @returns {RunReward | null} */
export function salvageOfferMake(run, from, bots, S) {
  const e = encOf(run),
    cards = salvageCards(rngFrom(run.seed, 'salvage|' + e.rewardN), salvageParts(bots), bots.length, S);
  e.rewardN++;
  e.reward = cards.length ? { cards, rolls: 0, from, kind: 'salvage' } : null;
  return e.reward;
}

/** what the next reroll costs (Moneys) @param {RunReward} R @param {{ reroll: number, grow: number }} rules */
export const rewardRerollCost = (R, rules) => Math.round(rules.reroll * Math.pow(rules.grow, R.rolls));

/** reroll the pick: pays its cost from `s.se` and draws again from the next roll's stream; '' when done, else why not
 * ('none': no pick, 'money': not enough) @param {Run} run @param {{ se: number }} s @param {RewardData} D */
export function rewardReroll(run, s, D) {
  const R = run.enc && run.enc.reward;
  /* RL-14: a salvage pick is what the bots left: never drawn again */
  if (!R || R.kind === 'salvage') return 'none';
  const cost = rewardRerollCost(R, D.rules);
  if (s.se < cost) return 'money';
  s.se -= cost;
  R.rolls++;
  const cards = rewardDraw(rngFrom(run.seed, 'reward|' + (encOf(run).rewardN - 1) + '|' + R.rolls), D, {
    kind: R.kind,
    n: R.n,
  });
  if (cards.length) R.cards = cards;
  return '';
}

/**
 * Take a card of the pick (or none: `k` null): an item (or pyramids) into the bag (a held item, RL-12c: then given to
 * the Billie `uid` when one is named, the one it held going back to the bag); a tutor's move to the Billie
 * `uid` (in place of `forget` when its moves are full). The pick is cleared once answered. '' when done, else why not
 * ('none': no pick or card, 'who': that Billie can't learn it, 'full': its moves are full and none to forget given).
 * @param {Run} run @param {{ items: Record<string, number>, pyramids: Record<string, number> }} s
 * @param {number | null} k @param {RewardData} D @param {{ uid?: string, forget?: string }} [o]
 */
export function rewardTake(run, s, k, D, o = {}) {
  const R = run.enc && run.enc.reward;
  if (!R) return 'none';
  if (k == null) {
    /** @type {any} */ (run.enc).reward = null;
    return '';
  }
  const c = R.cards[k];
  if (!c) return 'none';
  if (c.kind === 'tutor') {
    const m = D.team.find(b => b.uid === o.uid);
    if (!m || !c.move || !tutorMoves(m, D).includes(c.move)) return 'who';
    if (m.moves.length >= D.slots) {
      const at = o.forget ? m.moves.indexOf(o.forget) : -1;
      if (at < 0) return 'full';
      m.moves[at] = c.move;
    } else m.moves.push(c.move);
  } else if (c.kind === 'part') {
    /* RL-14: a bot's part into your parts (phase 17's inventory, kept whatever the run's end) */
    const P = /** @type {any} */ (s);
    if (!c.item || !D.newUid) return 'none';
    (P.parts || (P.parts = [])).push(newPart(c.item, D.newUid()));
  } else if (c.kind === 'scrap') {
    /* RL-14: Scrap goes home with the meta's, kept whatever the run's end */
    const P = /** @type {any} */ (s);
    if (P.meta) P.meta.scrap = (P.meta.scrap || 0) + (c.n || 1);
  } else if (c.item && c.item.startsWith('coin_')) {
    const p = c.item.slice(5);
    s.pyramids[p] = (s.pyramids[p] || 0) + (c.n || 1);
  } else if (c.item) {
    s.items[c.item] = (s.items[c.item] || 0) + (c.n || 1);
    const m = c.kind === 'held' && o.uid ? D.team.find(b => b.uid === o.uid) : null;
    if (m) heldGive(s, m, c.item, D.items || {});
  }
  /** @type {any} */ (run.enc).reward = null;
  return '';
}

/** the game's data for a pick, with this team (the page's and the run sim's) @param {Billy[]} team @returns {RewardData} */
export const rewardDataGame = team => ({
  cards: /** @type {any} */ (REWARDS),
  rules: RULES.run.rewards,
  team,
  species: SPECIES,
  lines: LINE_BY_ID,
  moves: MOVES,
  slots: moveSlotCount(),
  items: ITEMS,
  newUid,
});
