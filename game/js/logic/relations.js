// @ts-check
'use strict';
/* ================= THE HUB'S FOLK AND YOU (roguelite track RL-S2) =================
   Points with each hub person, kept as saveData.meta.rel (who -> points): a gift of Beans gives relations.json
   gift.points (one gift a person each time you are home from a run: meta.gifted holds meta.runs at the last one), a
   favour done gives gift.favour (the script command `rel`). A person's level is how many of their levels' `at` the
   points reach. While you hold a level, its `fx` rows join every run's effects (effects.js fxOfRun, from run.rel, the
   levels as the run took off) and its `items` and `pyramids` go into the bag at each takeoff (relTakeoff); its
   `wardrobe` piece is given once, when the level is reached (the page's part). The story reads the level as
   `rel:<who>`, the Beans as `beans`, a gift given since the last run as `gifted:<who>` (conditions.js). The numbers
   are the owner's (2026-10-26). Logic only: no DOM, no Date, no Math.random (tools/test/relations.test.mjs). */
/** @import { Meta, SaveData } from '../../types/save-data' */
/** @import { FxRow, RelationsData, RelationLevel } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  relAdd: [() => relAdd, v => (relAdd = v)],
  // @ts-expect-error -- replaced on purpose
  relFavoursPay: [() => relFavoursPay, v => (relFavoursPay = v)],
  relFxRows: [() => relFxRows],
  // @ts-expect-error -- replaced on purpose
  relGift: [() => relGift, v => (relGift = v)],
  // @ts-expect-error -- replaced on purpose
  relGiftBlock: [() => relGiftBlock, v => (relGiftBlock = v)],
  relHeld: [() => relHeld],
  relLevel: [() => relLevel],
  relLevels: [() => relLevels],
  relReached: [() => relReached],
  // @ts-expect-error -- replaced on purpose
  relTakeoff: [() => relTakeoff, v => (relTakeoff = v)],
  // @ts-expect-error -- replaced on purpose
  runBeans: [() => runBeans, v => (runBeans = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the level the points reach in a person's levels (0: none yet) @param {number} points
 * @param {{ levels: RelationLevel[] } | undefined} P */
export const relLevel = (points, P) => (P ? P.levels.filter(L => (points || 0) >= L.at).length : 0);

/** every person's level from the meta @param {Meta} meta @param {RelationsData} RL @returns {Record<string, number>} */
export const relLevels = (meta, RL) =>
  Object.fromEntries(Object.entries(RL.people).map(([who, P]) => [who, relLevel((meta.rel || {})[who] || 0, P)]));

/** why a gift to `who` can't be given now ('' when it can): 'nobody' (not in relations.json), 'beans' (too few),
 * 'given' (already given one since the last run) @param {Meta} meta @param {string} who @param {RelationsData} RL */
export function relGiftBlock(meta, who, RL) {
  if (!RL.people[who]) return 'nobody';
  if ((meta.beans || 0) < RL.gift.cost) return 'beans';
  if (meta.gifted && meta.gifted[who] === meta.runs) return 'given';
  return '';
}

/** points for `who` (a favour, or a gift's), at most 9999; returns the levels before and after
 * @param {Meta} meta @param {string} who @param {number} n @param {RelationsData} RL */
export function relAdd(meta, who, n, RL) {
  const P = RL.people[who],
    rel = meta.rel || (meta.rel = {}),
    had = rel[who] || 0,
    from = relLevel(had, P);
  if (!P) return { from, to: from };
  rel[who] = Math.max(0, Math.min(9999, had + Math.floor(n)));
  return { from, to: relLevel(rel[who], P) };
}

/** give `who` a gift: its Beans paid, its points added, marked given until the next run. Returns the levels before
 * and after, or null when it can't be given (relGiftBlock) @param {Meta} meta @param {string} who
 * @param {RelationsData} RL */
export function relGift(meta, who, RL) {
  if (relGiftBlock(meta, who, RL)) return null;
  meta.beans -= RL.gift.cost;
  (meta.gifted || (meta.gifted = {}))[who] = meta.runs;
  return relAdd(meta, who, RL.gift.points, RL);
}

/** the levels a person reached from one level to another (their rows, lowest first) @param {string} who
 * @param {{ from: number, to: number }} step @param {RelationsData} RL @returns {RelationLevel[]} */
export const relReached = (who, step, RL) => (RL.people[who] ? RL.people[who].levels.slice(step.from, step.to) : []);

/** the rows of every level held, a person after another, each with what it gives
 * @param {Record<string, number>} levels @param {RelationsData} RL @returns {[string, RelationLevel][]} */
export const relHeld = (levels, RL) =>
  Object.entries(levels || {}).flatMap(([who, n]) =>
    RL.people[who] ? RL.people[who].levels.slice(0, n).map(L => /** @type {[string, RelationLevel]} */ ([who, L])) : []
  );

/** the effect rows a run gets from the levels it took off with (run.rel), each tagged `rel:<who>`
 * @param {{ rel?: Record<string, number> } | null | undefined} run @param {RelationsData} RL
 * @returns {(FxRow & { src: string })[]} */
export const relFxRows = (run, RL) =>
  run && run.rel && RL
    ? relHeld(run.rel, RL).flatMap(([who, L]) => (L.fx || []).map(f => ({ ...f, src: 'rel:' + who })))
    : [];

/** a run takes off: run.rel is every level held, and the levels' items and pyramids go into the bag. Returns what was
 * given @param {SaveData} s @param {RelationsData} RL */
export function relTakeoff(s, RL) {
  /** @type {{ items: Record<string, number>, pyramids: Record<string, number> }} */
  const got = { items: {}, pyramids: {} };
  if (!s.run || !s.meta) return got;
  s.run.rel = relLevels(s.meta, RL);
  for (const [, L] of relHeld(s.run.rel, RL))
    for (const kind of /** @type {const} */ (['items', 'pyramids']))
      for (const [k, n] of Object.entries(L[kind] || {})) {
        const bag = /** @type {Record<string, number>} */ (s[kind] || (s[kind] = {}));
        bag[k] = (bag[k] || 0) + n;
        got[kind][k] = (got[kind][k] || 0) + n;
      }
  return got;
}

/** Beans found (an event, a badge, a side area's leader; the script command `beans`): into meta.beans at once, and on a
 * run counted as its finds (run.beans, for the payout screen) @param {{ meta?: Meta, run?: any }} s @param {number} n
 * @param {any} [run] the run on (the save's) */
export function runBeans(s, n, run = s.run) {
  const k = Math.max(0, Math.floor(n || 0));
  if (!k || !s.meta) return;
  s.meta.beans = Math.min(1e12, (s.meta.beans || 0) + k);
  if (run) run.beans = Math.min(99, (run.beans || 0) + k);
}

/** the favours done on the run just ended: each person's relations.json `favour` whose quest is at `asked` (its ask
 * line, a banter line, moved it there) and whose `check` holds now (a condition, most often on the run just kept in
 * meta.history: `holds` reads it). Each is paid: the quest moves to `done`, the person gains its `points` (else
 * gift.favour) and the wardrobe piece of a level reached. Run on the way home, before the hub's lines are picked, so a
 * thank-you line (`when: quest:<id> = done`, once) is the person's first line. Returns what was paid
 * @param {{ meta?: Meta, story?: Record<string, any>, wardrobe?: any }} s
 * @param {(cond: string) => boolean} holds @param {RelationsData} RL
 * @returns {{ who: string, quest: string, points: number, from: number, to: number }[]} */
export function relFavoursPay(s, holds, RL) {
  /** @type {{ who: string, quest: string, points: number, from: number, to: number }[]} */
  const out = [];
  if (!s.meta || !RL) return out;
  const quests = (s.story || (s.story = {})).quests || (s.story.quests = {});
  for (const [who, P] of Object.entries(RL.people)) {
    const F = P.favour;
    if (!F || quests[F.quest] !== 'asked' || !holds(F.check)) continue;
    const points = F.points != null ? F.points : RL.gift.favour,
      step = relAdd(s.meta, who, points, RL);
    quests[F.quest] = 'done';
    for (const L of relReached(who, step, RL))
      if (L.wardrobe && s.wardrobe) (s.wardrobe.owned || (s.wardrobe.owned = {}))[L.wardrobe] = 1;
    out.push({ who, quest: F.quest, points, ...step });
  }
  return out;
}
