// @ts-check
'use strict';
/* ================= A RUN'S QUESTS (towns track TW-3) =================
   Each run town's quest giver offers one quest (quests.json), drawn from the town's own stream ('quest'), and only one
   that can be finished and handed in on this run: a town with a notice board must be reachable ahead (and after the
   mini-boss, for a mini-boss quest; with enough route trainers on the way, for a trainers quest). At most `held` are
   held. Kinds (the owner, 2026-10-24):
   - catch: catch a Billie of a type from the run's region (its dex);
   - trainers: beat n route trainers (counted from when it was taken);
   - parcel: carry a parcel to a later town (done on walking into one);
   - miniboss: beat the next mini-boss with nobody fainting (dropped when one does).
   A done quest is handed in at the notice board of any town but its own, for a reward pick (logic/rewards.js). What is
   held is run.quests; it ends with the run.
   Logic only: no DOM, no Date, no Math.random (tools/test/run-quests.test.mjs). */
/** @import { Run, RunMap, RunQuest, RunQuests } from '../../types/save-data' */
/** @import { QuestKind, QuestsData } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { runNext, runNodeSeed } from './run-map.js';
/* eslint-disable no-func-assign */
expose({
  QUEST_KINDS: [() => QUEST_KINDS],
  // @ts-expect-error -- replaced on purpose
  ahead: [() => ahead, v => (ahead = v)],
  // @ts-expect-error -- replaced on purpose
  questArrive: [() => questArrive, v => (questArrive = v)],
  // @ts-expect-error -- replaced on purpose
  questCatch: [() => questCatch, v => (questCatch = v)],
  // @ts-expect-error -- replaced on purpose
  questFill: [() => questFill, v => (questFill = v)],
  // @ts-expect-error -- replaced on purpose
  questOffer: [() => questOffer, v => (questOffer = v)],
  // @ts-expect-error -- replaced on purpose
  questPay: [() => questPay, v => (questPay = v)],
  // @ts-expect-error -- replaced on purpose
  questPayable: [() => questPayable, v => (questPayable = v)],
  // @ts-expect-error -- replaced on purpose
  questTake: [() => questTake, v => (questTake = v)],
  // @ts-expect-error -- replaced on purpose
  questWin: [() => questWin, v => (questWin = v)],
  // @ts-expect-error -- replaced on purpose
  questsOf: [() => questsOf, v => (questsOf = v)],
  // @ts-expect-error -- replaced on purpose
  regionTypes: [() => regionTypes, v => (regionTypes = v)],
  step: [() => step],
  // @ts-expect-error -- replaced on purpose
  trainersAhead: [() => trainersAhead, v => (trainersAhead = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the kinds, in the order their weights are drawn @type {QuestKind[]} */
export const QUEST_KINDS = ['catch', 'trainers', 'parcel', 'miniboss'];

/** a run's quests, made the first time they are asked for @param {Run} run @returns {RunQuests} */
export function questsOf(run) {
  if (!run.quests) run.quests = { held: [], took: [], n: 0, paid: 0 };
  return run.quests;
}

/**
 * @typedef {{ quests: QuestsData, species: Record<string, { types?: string[] }>, boards: number[],
 *   trainersAt: (i: number) => number }} QuestData
 * boards: the map nodes whose town has a notice board; trainersAt: how many route trainers a map node has
 */
/** @typedef {{ kind: QuestKind, text: string, goal: number, type?: string }} QuestOffer */

/** the most route trainers on a way from node i's next places to a town with a board (-1: no such way). The map runs
 * row by row, so the links never loop @param {RunMap} map @param {number} i @param {QuestData} data */
export function trainersAhead(map, i, data) {
  const boards = new Set(data.boards),
    /** @type {Map<number, number>} */
    best = new Map();
  /** @param {number} j @returns {number} */
  const from = j => {
    const had = best.get(j);
    if (had !== undefined) return had;
    let on = boards.has(j) ? 0 : -1;
    for (const k of runNext(map, j)) on = Math.max(on, from(k));
    const v = on < 0 ? -1 : on + Math.max(0, data.trainersAt(j));
    best.set(j, v);
    return v;
  };
  return Math.max(-1, ...runNext(map, i).map(from));
}
/** the nodes reachable ahead of node i (not i) @param {RunMap} map @param {number} i @returns {Set<number>} */
export function ahead(map, i) {
  const seen = new Set(),
    todo = runNext(map, i);
  while (todo.length) {
    const j = /** @type {number} */ (todo.pop());
    if (seen.has(j)) continue;
    seen.add(j);
    todo.push(...runNext(map, j));
  }
  return seen;
}
/** the types of Billie the run's region has (its dex), sorted @param {Run} run @param {QuestData} data */
export function regionTypes(run, data) {
  const out = new Set();
  for (const sp of (run.region && run.region.dex) || [])
    for (const t of (data.species[sp] && data.species[sp].types) || []) if (t !== 'None') out.add(t);
  return [...out].sort();
}

/**
 * Town i's quest offer, or null: none when the town has no board, its offer was taken, or nothing it could offer can
 * be finished and handed in on this run. The same run and town always offer the same (the node's 'quest' stream:
 * the kind, its text, its goal, its type, in that order)
 * @param {Run} run @param {number} i @param {QuestData} data @returns {QuestOffer | null}
 */
export function questOffer(run, i, data) {
  const map = run.map,
    Q = data.quests;
  if (!map || !map.nodes[i] || map.nodes[i].type !== 'town' || !data.boards.includes(i)) return null;
  if (run.quests && run.quests.took.includes(i)) return null;
  const next = ahead(map, i),
    towns = data.boards.filter(j => j !== i && next.has(j)),
    types = regionTypes(run, data),
    most = trainersAhead(map, i, data),
    T = Q.kinds.trainers,
    afterBoss = [...next].some(m => map.nodes[m].type === 'miniboss' && towns.some(j => ahead(map, m).has(j)));
  if (!towns.length) return null;
  /** @type {Record<QuestKind, boolean>} */
  const can = { catch: types.length > 0, trainers: most >= T.goal[0], parcel: true, miniboss: afterBoss },
    weights = Object.fromEntries(QUEST_KINDS.map(k => [k, can[k] ? Q.kinds[k].weight : 0]));
  if (!Object.values(weights).some(w => w > 0)) return null;
  const g = rngFrom(runNodeSeed(run.seed, i), 'quest'),
    kind = /** @type {QuestKind} */ (g.pick(weights)),
    texts = Q.texts.filter(t => t.kind === kind),
    text = texts[g.int(0, texts.length - 1)].id,
    R = Q.kinds[kind],
    goal = g.int(R.goal[0], kind === 'trainers' ? Math.min(R.goal[1], most) : R.goal[1]),
    type = types[g.int(0, types.length - 1)];
  return kind === 'catch' ? { kind, text, goal, type } : { kind, text, goal };
}
/** a quest line with its blanks filled ({type}, {n}, {title}) @param {string} line
 * @param {{ kind: QuestKind, goal: number, type?: string }} q @param {QuestsData} Q */
export function questFill(line, q, Q) {
  const fill = (/** @type {string} */ s) => s.replace(/\{type\}/g, q.type || '').replace(/\{n\}/g, String(q.goal));
  return fill(line).replace(/\{title\}/g, fill(Q.kinds[q.kind].title));
}
/** take town i's offer: false when `held` are held already @param {Run} run @param {number} i
 * @param {QuestOffer} offer @param {QuestsData} Q @returns {RunQuest | null} */
export function questTake(run, i, offer, Q) {
  const R = questsOf(run);
  if (R.held.length >= Q.held || R.took.includes(i)) return null;
  /** @type {RunQuest} */
  const q = { id: 'q' + R.n, kind: offer.kind, text: offer.text, at: i, goal: offer.goal, n: 0, done: 0 };
  if (offer.type) q.type = offer.type;
  R.n++;
  R.took.push(i);
  R.held.push(q);
  return q;
}
/** one more towards a quest; done at its goal @param {RunQuest} q */
export const step = q => {
  q.n = Math.min(q.goal, q.n + 1);
  if (q.n >= q.goal) q.done = 1;
};
/** a Billie of these types caught: the catch quests for one of them are done; returns the quests done
 * @param {Run | null | undefined} run @param {string[]} types @returns {RunQuest[]} */
export function questCatch(run, types) {
  if (!run || !run.quests) return [];
  const got = run.quests.held.filter(q => q.kind === 'catch' && !q.done && types.includes(q.type || ''));
  got.forEach(step);
  return got;
}
/** a run trainer beaten (its runFoe): a route trainer counts towards the trainers quests; the mini-boss settles the
 * mini-boss quests, done when nobody fainted, dropped when someone did. Returns what was done and what failed
 * @param {Run | null | undefined} run @param {string | undefined} foe @param {boolean} fainted
 * @returns {{ done: RunQuest[], failed: RunQuest[] }} */
export function questWin(run, foe, fainted) {
  /** @type {{ done: RunQuest[], failed: RunQuest[] }} */
  const out = { done: [], failed: [] };
  if (!run || !run.quests) return out;
  const R = run.quests;
  if (foe === 'route')
    for (const q of R.held.filter(q => q.kind === 'trainers' && !q.done)) {
      step(q);
      if (q.done) out.done.push(q);
    }
  if (foe === 'miniboss') {
    const now = R.held.filter(q => q.kind === 'miniboss' && !q.done);
    if (fainted) {
      out.failed = now;
      R.held = R.held.filter(q => !now.includes(q));
    } else {
      now.forEach(step);
      out.done = now;
    }
  }
  return out;
}
/** walking into map node i: a town on a later row than a parcel's own delivers it; returns the quests done
 * @param {Run | null | undefined} run @param {number} i @returns {RunQuest[]} */
export function questArrive(run, i) {
  if (!run || !run.quests || !run.map || !run.map.nodes[i] || run.map.nodes[i].type !== 'town') return [];
  const map = run.map,
    got = run.quests.held.filter(
      q => q.kind === 'parcel' && !q.done && map.nodes[q.at] && map.nodes[i].row > map.nodes[q.at].row
    );
  got.forEach(step);
  return got;
}
/** the done quests town i's board takes (any town's but their own) @param {Run | null | undefined} run
 * @param {number} i @returns {RunQuest[]} */
export function questPayable(run, i) {
  return run && run.quests ? run.quests.held.filter(q => q.done && q.at !== i) : [];
}
/** hand a done quest in: it goes (before its reward pick is made, so a reload never pays it twice)
 * @param {Run} run @param {RunQuest} q @returns {boolean} */
export function questPay(run, q) {
  const R = questsOf(run);
  if (!q.done || !R.held.includes(q)) return false;
  R.held = R.held.filter(x => x !== q);
  R.paid++;
  return true;
}
