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
   RS-2 (residents track): a resident's favour (quests.json favours) is a quest of theirs, offered by them in one town
   (favourAt, from the run's own stream) where it can be finished and handed in, as a town's offer can; it is held over
   the cap and handed in at a notice board for their invite (logic/residents.js) in place of the reward pick.
   Logic only: no DOM, no Date, no Math.random (tools/test/run-quests.test.mjs). */
/** @import { Run, RunMap, RunQuest, RunQuests, SaveData } from '../../types/save-data' */
/** @import { QuestFavour, QuestKind, QuestsData, Resident } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { residentDrawn, residentFirstTowns } from './residents.js';
import { runNext, runNodeSeed } from './run-map.js';
/* eslint-disable no-func-assign */
expose({
  QUEST_KINDS: [() => QUEST_KINDS],
  // @ts-expect-error -- replaced on purpose
  ahead: [() => ahead, v => (ahead = v)],
  // @ts-expect-error -- replaced on purpose
  favourAt: [() => favourAt, v => (favourAt = v)],
  // @ts-expect-error -- replaced on purpose
  favourHeld: [() => favourHeld, v => (favourHeld = v)],
  // @ts-expect-error -- replaced on purpose
  favourOffer: [() => favourOffer, v => (favourOffer = v)],
  // @ts-expect-error -- replaced on purpose
  favourTake: [() => favourTake, v => (favourTake = v)],
  // @ts-expect-error -- replaced on purpose
  favourTowns: [() => favourTowns, v => (favourTowns = v)],
  // @ts-expect-error -- replaced on purpose
  questArrive: [() => questArrive, v => (questArrive = v)],
  // @ts-expect-error -- replaced on purpose
  questCan: [() => questCan, v => (questCan = v)],
  // @ts-expect-error -- replaced on purpose
  questCatch: [() => questCatch, v => (questCatch = v)],
  // @ts-expect-error -- replaced on purpose
  questDataOf: [() => questDataOf, v => (questDataOf = v)],
  // @ts-expect-error -- replaced on purpose
  questFill: [() => questFill, v => (questFill = v)],
  // @ts-expect-error -- replaced on purpose
  questGoal: [() => questGoal, v => (questGoal = v)],
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
  questsHeld: [() => questsHeld, v => (questsHeld = v)],
  // @ts-expect-error -- replaced on purpose
  questsOf: [() => questsOf, v => (questsOf = v)],
  // @ts-expect-error -- replaced on purpose
  regionTypes: [() => regionTypes, v => (regionTypes = v)],
  // @ts-expect-error -- replaced on purpose
  residentPlan: [() => residentPlan, v => (residentPlan = v)],
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
/** @typedef {{ kind: QuestKind, text: string, goal: number, type?: string, res?: string }} QuestOffer */
/** @typedef {{ towns: number[], types: string[], most: number, can: Record<QuestKind, boolean> }} QuestCan */

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
 * what town i could offer: the later towns with a board, the region's types, the most route trainers on a way to a
 * board, and which kinds can be finished and handed in from there. Null when the town has no board or no board is
 * ahead @param {Run} run @param {number} i @param {QuestData} data @returns {QuestCan | null}
 */
export function questCan(run, i, data) {
  const map = run.map;
  if (!map || !map.nodes[i] || map.nodes[i].type !== 'town' || !data.boards.includes(i)) return null;
  const next = ahead(map, i),
    towns = data.boards.filter(j => j !== i && next.has(j));
  if (!towns.length) return null;
  const types = regionTypes(run, data),
    most = trainersAhead(map, i, data),
    T = data.quests.kinds.trainers,
    afterBoss = [...next].some(m => map.nodes[m].type === 'miniboss' && towns.some(j => ahead(map, m).has(j)));
  return {
    towns,
    types,
    most,
    can: { catch: types.length > 0, trainers: most >= T.goal[0], parcel: true, miniboss: afterBoss },
  };
}
/** a kind's goal and type from a stream: the goal in its range (a trainers quest's at most the trainers ahead), a
 * catch's type among the region's @param {ReturnType<typeof rngFrom>} g @param {QuestKind} kind @param {QuestCan} c
 * @param {QuestsData} Q */
export function questGoal(g, kind, c, Q) {
  const R = Q.kinds[kind],
    goal = g.int(R.goal[0], kind === 'trainers' ? Math.min(R.goal[1], c.most) : R.goal[1]),
    type = c.types[g.int(0, c.types.length - 1)];
  return { goal, type };
}
/**
 * Town i's quest offer, or null: none when the town has no board, its offer was taken, or nothing it could offer can
 * be finished and handed in on this run. The same run and town always offer the same (the node's 'quest' stream:
 * the kind, its text, its goal, its type, in that order)
 * @param {Run} run @param {number} i @param {QuestData} data @returns {QuestOffer | null}
 */
export function questOffer(run, i, data) {
  const Q = data.quests;
  if (run.quests && run.quests.took.includes(i)) return null;
  const c = questCan(run, i, data);
  if (!c) return null;
  const weights = Object.fromEntries(QUEST_KINDS.map(k => [k, c.can[k] ? Q.kinds[k].weight : 0]));
  if (!Object.values(weights).some(w => w > 0)) return null;
  const g = rngFrom(runNodeSeed(run.seed, i), 'quest'),
    kind = /** @type {QuestKind} */ (g.pick(weights)),
    texts = Q.texts.filter(t => t.kind === kind),
    text = texts[g.int(0, texts.length - 1)].id,
    { goal, type } = questGoal(g, kind, c, Q);
  return kind === 'catch' ? { kind, text, goal, type } : { kind, text, goal };
}
/** RS-2: the towns where a favour of this kind can be offered, finished and handed in, by map node
 * @param {Run} run @param {QuestKind} kind @param {QuestData} data @returns {number[]} */
export function favourTowns(run, kind, data) {
  const nodes = (run.map && run.map.nodes) || [];
  return nodes.flatMap((_, i) => {
    const c = questCan(run, i, data);
    return c && c.can[kind] ? [i] : [];
  });
}
/** RS-2: the one town a resident offers their favour in (-1: none can), drawn from the run's own stream
 * ('resident|town') among favourTowns @param {Run} run @param {QuestKind} kind @param {QuestData} data */
export function favourAt(run, kind, data) {
  const towns = favourTowns(run, kind, data);
  return towns.length ? towns[rngFrom(run.seed, 'resident|town').int(0, towns.length - 1)] : -1;
}
/** RS-2: the resident's favour held on this run (done or not), or null @param {Run | null | undefined} run */
export function favourHeld(run) {
  return (run && run.quests && run.quests.held.find(q => q.res)) || null;
}
/** RS-2: resident `id`'s favour offered in town i, or null: none once they are invited or their favour is held, or
 * when it can't be finished and handed in from there. Its goal and type from the node's 'favour' stream
 * @param {Run} run @param {number} i @param {string} id @param {QuestFavour} F @param {QuestData} data
 * @returns {QuestOffer | null} */
export function favourOffer(run, i, id, F, data) {
  if (!F.kind || run.invited || favourHeld(run)) return null;
  const c = questCan(run, i, data);
  if (!c || !c.can[F.kind]) return null;
  const { goal, type } = questGoal(rngFrom(runNodeSeed(run.seed, i), 'favour'), F.kind, c, data.quests);
  return F.kind === 'catch'
    ? { kind: F.kind, text: id, goal, type, res: id }
    : { kind: F.kind, text: id, goal, res: id };
}
/** RS-2: take a favour offered in town i: held over the cap, and the town's own offer stays open
 * @param {Run} run @param {number} i @param {QuestOffer} offer @returns {RunQuest | null} */
export function favourTake(run, i, offer) {
  if (!offer.res || favourHeld(run)) return null;
  const R = questsOf(run);
  /** @type {RunQuest} */
  const q = {
    id: 'q' + R.n,
    kind: offer.kind,
    text: offer.res,
    at: i,
    goal: offer.goal,
    n: 0,
    done: 0,
    res: offer.res,
  };
  if (offer.type) q.type = offer.type;
  R.n++;
  R.held.push(q);
  return q;
}
/** how many quests count towards the cap (RS-2: not a favour) @param {Run | null | undefined} run */
export function questsHeld(run) {
  return run && run.quests ? run.quests.held.filter(q => !q.res).length : 0;
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
  if (questsHeld(run) >= Q.held || R.took.includes(i)) return null;
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
/** a run's quest data from its scenes (a town's board: a `board` spot) and its trainers (the route trainers' places);
 * quest-board.js questData reads the same from the world put in @param {Run} run @param {any[]} scenes
 * @param {Record<string, any>} trainers @param {QuestsData} quests @param {QuestData['species']} species
 * @returns {QuestData} */
export function questDataOf(run, scenes, trainers, quests, species) {
  const at = /** @type {Record<number, number>} */ ({});
  for (const T of Object.values(trainers)) if (T && T.runFoe === 'route') at[T.runNode] = (at[T.runNode] || 0) + 1;
  const boards = ((run.map && run.map.nodes) || []).flatMap((n, i) =>
    n.type === 'town' && ((scenes[i] && scenes[i].spots) || []).some((/** @type {any} */ s) => s.kind === 'board')
      ? [i]
      : []
  );
  return { quests, species, boards, trainersAt: i => at[i] || 0 };
}
/** RS-2: who this run's resident is (logic/residents.js residentDrawn, invited or not) and the towns they stand in: the
 * free first one in every town of the first all-town row (every way walks through one), anyone else in the one town
 * their favour is offered in (favourAt; none when no town can, or they are met at an event only). Null with nobody
 * @param {SaveData} s @param {Record<string, Resident>} R @param {QuestData} data
 * @returns {{ id: string, towns: number[] } | null} */
export function residentPlan(s, R, data) {
  const run = s.run,
    id = run && run.map ? residentDrawn(s, R) : null;
  if (!run || !run.map || !id) return null;
  const F = data.quests.favours[id];
  if (!R[id].meet.where.includes('town') || !F) return { id, towns: [] };
  if (!F.kind) return { id, towns: residentFirstTowns(run.map) };
  const at = favourAt(run, F.kind, data);
  return { id, towns: at < 0 ? [] : [at] };
}
