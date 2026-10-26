// @ts-check
'use strict';
/* ================= CONDITIONS (Project Story S1) =================
   The small grammar the story's scripts, gates and `when` fields are written in (docs/SCRIPTS.md). A condition is
   parsed once into a tree and read against a plain story state (storyStateOf); it is never run as code.
     met_juniper            a story flag is set          !met_juniper, not met_juniper   it isn't
     rival0 = win           a story flag holds a word    beat:chad                      a trainer is beaten
     item:honey >= 3        items in the bag             coin:gold_pyramid > 0                  pyramids
     quest:ledger = asked   a quest's stage (also >=, <: in the quest's order of stages; `none` before it starts)
     visits:juniper >= 2    times you have talked to someone
     visited:copperleaf     a place you have been        billie:musk                    a Billie of that line caught
     robot                  you have a robot             badges >= 2                    badges won
     caught >= 15           kinds of Billie caught (the Index)
     unlock:shop_revive    an unlock is owned (RL-11)  runs >= 3, wins >= 1           runs ended, runs won (RL-11)
     type:Water >= 2       Billies of a type in the team (RL-12b)        money >= 200     Moneys on hand (RL-12b)
     team >= 2             Billies in the team (RL-12b)
     badge:Water           a badge of that type is won (RL-12b: meta.badges, or a leader's seat)
     opened:cut            a run's field move obstacle is open (RL-R2)
     last:lost, last:row <= 3      the last run (RL-S1: logic/run-history.js LAST_FACTS)
     lastby:boss, lastby:bureau    what ended the last run: its kind, a leader's or class's id, a Billie, the Bureau
     history:losses >= 2   over the runs kept (HISTORY_FACTS)   rematch >= 1   runs this foe ended (a leader's lines)
     resident:dottie       someone lives in Copperleaf  residents >= 3   how many do (RS-1: meta.residents)
   combined with `and`, `or`, `not` / `!` and parentheses (`and` binds tighter than `or`). A bare count term
   (`item:honey`, `visits:juniper`, `badges`) means more than 0. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { RELATIONS } from '../hooks.js';
import { historyFacts, historyRematch } from './run-history.js';
import { relLevels } from './relations.js';
/* eslint-disable no-func-assign */
expose({
  CONDITION_KINDS: [() => CONDITION_KINDS],
  OPS: [() => OPS],
  WORDS: [() => WORDS],
  // @ts-expect-error -- replaced on purpose
  badgeTypesOf: [() => badgeTypesOf, v => (badgeTypesOf = v)],
  // @ts-expect-error -- replaced on purpose
  compare: [() => compare, v => (compare = v)],
  // @ts-expect-error -- replaced on purpose
  conditionError: [() => conditionError, v => (conditionError = v)],
  // @ts-expect-error -- replaced on purpose
  conditionHolds: [() => conditionHolds, v => (conditionHolds = v)],
  // @ts-expect-error -- replaced on purpose
  conditionNames: [() => conditionNames, v => (conditionNames = v)],
  // @ts-expect-error -- replaced on purpose
  conditionProblem: [() => conditionProblem, v => (conditionProblem = v)],
  // @ts-expect-error -- replaced on purpose
  conditionTree: [() => conditionTree, v => (conditionTree = v)],
  // @ts-expect-error -- replaced on purpose
  didYouMean: [() => didYouMean, v => (didYouMean = v)],
  // @ts-expect-error -- replaced on purpose
  editDistance: [() => editDistance, v => (editDistance = v)],
  // @ts-expect-error -- replaced on purpose
  lastTeamOf: [() => lastTeamOf, v => (lastTeamOf = v)],
  // @ts-expect-error -- replaced on purpose
  parseCondition: [() => parseCondition, v => (parseCondition = v)],
  parsed: [() => parsed],
  // @ts-expect-error -- replaced on purpose
  storyStateOf: [() => storyStateOf, v => (storyStateOf = v)],
  // @ts-expect-error -- replaced on purpose
  teamTypes: [() => teamTypes, v => (teamTypes = v)],
  // @ts-expect-error -- replaced on purpose
  termValue: [() => termValue, v => (termValue = v)],
  // @ts-expect-error -- replaced on purpose
  tokens: [() => tokens, v => (tokens = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {'=' | '!=' | '>=' | '<=' | '>' | '<'} Op */
/** @typedef {{ t: 'term', kind: string, id: string, op: Op | null, val: string | number | null }} Term */
/** @typedef {Term | { t: 'and', a: Cond, b: Cond } | { t: 'or', a: Cond, b: Cond } | { t: 'not', a: Cond }} Cond */
/** @typedef {{ flags: Record<string, any>, beaten: Record<string, any>, items: Record<string, number>,
 *   pyramids: Record<string, number>, quests: Record<string, string>, visits: Record<string, number>,
 *   visited: Record<string, any>, lines: Record<string, any>, robots: number, badges: number, caught: number,
 *   unlocks: Record<string, any>, runs: number, wins: number, expedition?: number, questStages?: Record<string, string[]>,
 *   types?: Record<string, number>, money?: number, team?: number, badgeTypes?: Record<string, number>,
 *   opened?: Record<string, number>, dna?: number, genes?: number, spliced?: number,
 *   last?: Record<string, number>, lastby?: Record<string, number>,
 *   history?: Record<string, number>, rematch?: number, rel?: Record<string, number>, beans?: number,
 *   gifted?: Record<string, number>, chapter?: number, lastteam?: Record<string, number>, rival?: number,
 *   residents?: Record<string, number> }} StoryState */

/** each term kind: whether it takes an id after the colon, whether it is a count (compared as a number), and what it
 * reads, for the Studio's reference (Project Story S3) */
export const CONDITION_KINDS = {
  beat: { id: true, count: false, about: 'you beat this trainer: beat:chad' },
  item: { id: true, count: true, about: 'how many of an item you carry: item:honey >= 2' },
  coin: { id: true, count: true, about: 'how many of a coin you have: coin:gold_pyramid >= 3' },
  quest: { id: true, count: false, about: 'a quest’s stage, in the quest’s order: quest:lost_cat >= found' },
  visits: { id: true, count: true, about: 'times you have talked to someone: visits:juniper >= 2' },
  visited: { id: true, count: false, about: 'you have been to a place: visited:copperleaf' },
  billie: { id: true, count: false, about: 'a Billie of that line caught: billie:musk' },
  robot: { id: false, count: true, about: 'you have a robot' },
  badges: { id: false, count: true, about: 'badges won: badges >= 3' },
  caught: { id: false, count: true, about: 'kinds of Billie caught (the Index)' },
  unlock: { id: true, count: false, about: 'an unlock is owned (unlocks.json): unlock:ranch_2' },
  runs: { id: false, count: true, about: 'runs ended, won or lost: runs >= 3' },
  wins: { id: false, count: true, about: 'runs won: wins >= 1' },
  expedition: { id: false, count: true, about: 'the highest Expedition open (RL-13): expedition >= 2' },
  type: { id: true, count: true, about: 'Billies of a type in your team: type:Water, type:Fire >= 2' },
  money: { id: false, count: true, about: 'Moneys on hand: money >= 200' },
  team: { id: false, count: true, about: 'Billies in your team: team >= 2' },
  badge: { id: true, count: false, about: 'a badge of that type is won: badge:Water' },
  opened: { id: true, count: false, about: 'a run’s field move obstacle is open (RL-R2): opened:cut' },
  dna: { id: false, count: true, about: 'DNA on hand (SP-6): dna >= 10' },
  genes: { id: false, count: true, about: 'Genes in the Gene Bank’s library (SP-6): genes >= 1' },
  spliced: { id: false, count: true, about: 'spliced Billies in your team (SP-6): spliced >= 1' },
  last: {
    id: true,
    count: true,
    about:
      'the last run (RL-S1): last:won, last:lost, last:quit, last:row <= 3, last:days, last:perks, last:team, last:leaders, last:expedition',
  },
  lastby: {
    id: true,
    count: false,
    about:
      'what ended the last run: lastby:wild, route, event, miniboss, boss, bureau, a leader’s or class’s id, a Billie',
  },
  history: {
    id: true,
    count: true,
    about: 'over the runs kept (the last 20): history:runs, wins, losses, quits, streak, lstreak, bureau',
  },
  rematch: { id: false, count: true, about: 'in a leader’s or agent’s lines: runs this foe has ended: rematch >= 1' },
  rel: { id: true, count: true, about: 'your level with a hub person (RL-S2, relations.json): rel:kappi >= 2' },
  beans: { id: false, count: true, about: 'Beans on hand, the gift currency (RL-S2): beans >= 1' },
  gifted: { id: true, count: false, about: 'you gave them a gift since the last run (RL-S2): gifted:kappi' },
  lastteam: {
    id: true,
    count: true,
    about:
      'the team the last run ended with (RL-S2): Billies of a type, a line or a species: lastteam:Grass, lastteam:musk',
  },
  rival: {
    id: false,
    count: true,
    about: 'on a run, the meetings with Blake so far (RL-S2: before his battle, rival >= 1 means you met him already)',
  },
  chapter: {
    id: false,
    count: true,
    about: 'the story’s chapter (RL-S2: 1 at the start, moved on only by the command chapter n): chapter >= 2',
  },
  resident: { id: true, count: false, about: 'someone lives in Copperleaf (residents.json, RS-1): resident:dottie' },
  residents: { id: false, count: true, about: 'how many live in Copperleaf (RS-1): residents >= 3' },
};
export const OPS = ['>=', '<=', '!=', '==', '=', '>', '<'];
export const WORDS = new Set(['and', 'or', 'not']);

/** an error in a condition, with the column (from 0) it was found at @param {string} message @param {number} col */
export function conditionError(message, col) {
  return Object.assign(new Error(message), { name: 'ConditionError', col });
}

/** how many single-letter edits (a swap of two neighbours counts as one) turn a into b, for "did you mean"
 * @param {string} a @param {string} b */
export function editDistance(a, b) {
  /** @type {number[][]} */
  const d = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    d[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
/** the nearest of the names, if it is near enough to be a typo @param {string} w @param {Iterable<string>} names */
export function didYouMean(w, names) {
  let best = '',
    d = Infinity;
  for (const n of names) {
    const e = editDistance(w, n);
    if (e < d) [best, d] = [n, e];
  }
  return d <= Math.max(1, Math.floor(best.length / 3)) ? best : '';
}

/** @param {string} src @returns {{ k: string, v: string, col: number }[]} */
export function tokens(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      out.push({ k: c, v: c, col: i });
      i++;
      continue;
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (op) {
      out.push({ k: 'op', v: op === '==' ? '=' : op, col: i });
      i += op.length;
      continue;
    }
    if (c === '!') {
      out.push({ k: 'not', v: '!', col: i });
      i++;
      continue;
    }
    const m = /^[A-Za-z0-9_][\w.-]*(?::[\w.-]+)?/.exec(src.slice(i));
    if (!m) throw conditionError(`unexpected "${c}"`, i);
    const w = m[0];
    out.push({ k: WORDS.has(w) ? w : 'word', v: w, col: i });
    i += w.length;
  }
  return out;
}

/** reads a condition into its tree; throws a conditionError @param {string} src @returns {Cond} */
export function parseCondition(src) {
  const T = tokens(String(src));
  let p = 0;
  const peek = () => T[p],
    end = () => (T.length ? T[T.length - 1].col + T[T.length - 1].v.length : 0);
  const expect = (/** @type {string} */ what) => {
    const t = T[p];
    if (!t) throw conditionError(`${what} expected at the end`, end());
    return t;
  };
  /** @returns {Cond} */
  const or = () => {
    let a = and();
    while (peek() && peek().k === 'or') {
      p++;
      a = { t: 'or', a, b: and() };
    }
    return a;
  };
  /** @returns {Cond} */
  const and = () => {
    let a = not();
    while (peek() && peek().k === 'and') {
      p++;
      a = { t: 'and', a, b: not() };
    }
    return a;
  };
  /** @returns {Cond} */
  const not = () => {
    if (peek() && peek().k === 'not') {
      p++;
      return { t: 'not', a: not() };
    }
    return atom();
  };
  /** @returns {Cond} */
  const atom = () => {
    const t = expect('a flag or a term');
    if (t.k === '(') {
      p++;
      const a = or(),
        c = expect('")"');
      if (c.k !== ')') throw conditionError(`")" expected, found "${c.v}"`, c.col);
      p++;
      return a;
    }
    if (t.k !== 'word') throw conditionError(`a flag or a term expected, found "${t.v}"`, t.col);
    p++;
    const colon = t.v.indexOf(':');
    let kind = colon < 0 ? 'flag' : t.v.slice(0, colon),
      id = colon < 0 ? t.v : t.v.slice(colon + 1);
    if (colon < 0 && t.v in CONDITION_KINDS && !CONDITION_KINDS[t.v].id) [kind, id] = [t.v, ''];
    if (kind !== 'flag' && !(kind in CONDITION_KINDS)) {
      const near = didYouMean(kind, Object.keys(CONDITION_KINDS));
      throw conditionError(`unknown term "${kind}:"${near ? `, did you mean "${near}:"?` : ''}`, t.col);
    }
    if (kind !== 'flag' && CONDITION_KINDS[kind].id && !id)
      throw conditionError(`"${kind}:" needs a name after the colon`, t.col);
    if (kind !== 'flag' && !CONDITION_KINDS[kind].id && colon >= 0)
      throw conditionError(`"${kind}" takes no name (write "${kind} >= 1")`, t.col);
    /** @type {Term} */
    const term = { t: 'term', kind, id, op: null, val: null };
    if (peek() && peek().k === 'op') {
      const o = T[p++],
        v = expect('a value after ' + o.v);
      if (v.k !== 'word') throw conditionError(`a value expected after "${o.v}", found "${v.v}"`, v.col);
      p++;
      term.op = /** @type {Op} */ (o.v);
      const num = /^-?\d+(\.\d+)?$/.test(v.v);
      if (kind === 'flag' && !['=', '!='].includes(o.v) && !num)
        throw conditionError(`"${o.v}" compares numbers; a flag's word takes = or !=`, o.col);
      if (kind !== 'flag' && kind !== 'quest' && !CONDITION_KINDS[kind].count)
        throw conditionError(`"${kind}:" is yes or no; it takes no "${o.v}"`, o.col);
      if (kind !== 'flag' && kind !== 'quest' && !num)
        throw conditionError(`"${kind}" is a count: a number expected after "${o.v}"`, v.col);
      term.val = num ? +v.v : v.v;
    } else if (kind === 'quest') throw conditionError(`"quest:${id}" needs a stage (quest:${id} = <stage>)`, t.col);
    return term;
  };
  const tree = or();
  if (p < T.length) {
    const t = T[p];
    throw conditionError(`"and" or "or" expected before "${t.v}"`, t.col);
  }
  return tree;
}

/** @type {Map<string, Cond>} */
export const parsed = new Map();
/** a condition's tree, parsed once per text @param {string} src */
export function conditionTree(src) {
  let c = parsed.get(src);
  if (!c) parsed.set(src, (c = parseCondition(src)));
  return c;
}
/** null if the condition reads, else its error and column @param {string} src */
export function conditionProblem(src) {
  try {
    conditionTree(src);
    return null;
  } catch (e) {
    const err = /** @type {Error & { col?: number }} */ (e);
    if (err.name === 'ConditionError') return { message: err.message, col: err.col };
    throw e;
  }
}
/** every name a condition reads, by kind (the story checks use it) @param {Cond} c
 * @param {Record<string, Set<string>>} [out] */
export function conditionNames(c, out = {}) {
  if (c.t === 'term') (out[c.kind] || (out[c.kind] = new Set())).add(c.id);
  else if (c.t === 'not') conditionNames(c.a, out);
  else {
    conditionNames(c.a, out);
    conditionNames(c.b, out);
  }
  return out;
}

/** @param {any} a @param {Op} op @param {any} b */
export function compare(a, op, b) {
  switch (op) {
    case '=':
      return a === b;
    case '!=':
      return a !== b;
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '<':
      return a < b;
  }
}
/** @param {Term} c @param {StoryState} S */
export function termValue(c, S) {
  switch (c.kind) {
    case 'flag':
      return S.flags[c.id];
    case 'beat':
      return !!S.beaten[c.id];
    case 'item':
      return S.items[c.id] || 0;
    case 'coin':
      return S.pyramids[c.id] || 0;
    case 'visits':
      return S.visits[c.id] || 0;
    case 'visited':
      return !!S.visited[c.id];
    case 'billie':
      return !!S.lines[c.id];
    case 'robot':
      return S.robots;
    case 'badges':
      return S.badges;
    case 'caught':
      return S.caught;
    case 'unlock':
      return !!S.unlocks[c.id];
    case 'runs':
      return S.runs;
    case 'wins':
      return S.wins;
    case 'expedition':
      return S.expedition || 1;
    case 'type':
      return (S.types || {})[c.id.toLowerCase()] || 0;
    case 'money':
      return S.money || 0;
    case 'team':
      return S.team || 0;
    case 'badge':
      return !!(S.badgeTypes || {})[c.id.toLowerCase()];
    case 'resident':
      return !!(S.residents || {})[c.id];
    case 'residents':
      return Object.keys(S.residents || {}).length;
    case 'opened':
      return !!(S.opened || {})[c.id];
    case 'dna':
      return S.dna || 0;
    case 'genes':
      return S.genes || 0;
    case 'spliced':
      return S.spliced || 0;
    case 'last':
      return (S.last || {})[c.id] || 0;
    case 'lastby':
      return !!(S.lastby || {})[c.id];
    case 'history':
      return (S.history || {})[c.id] || 0;
    case 'rematch':
      return S.rematch || 0;
    case 'rel':
      return (S.rel || {})[c.id] || 0;
    case 'beans':
      return S.beans || 0;
    case 'gifted':
      return !!(S.gifted || {})[c.id];
    case 'chapter':
      return S.chapter || 1;
    case 'rival':
      return S.rival || 0;
    case 'lastteam':
      return (S.lastteam || {})[c.id] || (S.lastteam || {})[c.id.toLowerCase()] || 0;
  }
}
/** whether a condition holds for the state @param {Cond | string} c @param {StoryState} S @returns {boolean} */
export function conditionHolds(c, S) {
  if (typeof c === 'string') c = conditionTree(c);
  if (c.t === 'and') return conditionHolds(c.a, S) && conditionHolds(c.b, S);
  if (c.t === 'or') return conditionHolds(c.a, S) || conditionHolds(c.b, S);
  if (c.t === 'not') return !conditionHolds(c.a, S);
  if (c.kind === 'quest') {
    const at = S.quests[c.id] || 'none';
    if (c.op === '=' || c.op === '!=') return compare(at, c.op, String(c.val));
    /* the order of stages: the quest's own list, 'none' before the first */
    const order = ['none', ...((S.questStages || {})[c.id] || [])];
    const i = order.indexOf(at),
      j = order.indexOf(String(c.val));
    return i >= 0 && j >= 0 && compare(i, /** @type {Op} */ (c.op), j);
  }
  const v = termValue(c, S);
  if (c.op) return compare(c.kind === 'flag' && typeof c.val === 'number' ? +(v || 0) : v, c.op, c.val);
  return CONDITION_KINDS[c.kind] && CONDITION_KINDS[c.kind].count ? v > 0 : !!v;
}

/** the story state a save gives, for conditionHolds: the save's own objects where they fit (so a script's changes to
 * story flags, items and pyramids show at once), counts and lookups made fresh. RL-12b: `typesOf` gives a team
 * Billie's types (else its own `types`), `badgeTypes` a seat's, a leader's or a badge's type (meta.badges may hold
 * types, leader ids or seat ids, as a list or as keys). RL-S1: `foe` the leader's or class's id a `rematch` reads
 * @param {any} save @param {{ locations?: { id: string }[], questStages?: Record<string, string[]>,
 *   typesOf?: (m: any) => string[], badgeTypes?: Record<string, string>, foe?: string }} [o] */
export function storyStateOf(save, o = {}) {
  const story = save.story || (save.story = {}),
    visited = /** @type {Record<string, number>} */ ({}),
    lines = /** @type {Record<string, number>} */ ({});
  (o.locations || []).forEach((r, i) => {
    if (save.visited && save.visited[i]) visited[r.id] = 1;
  });
  for (const sp of Object.keys(save.caught || {})) {
    lines[sp] = 1;
    lines[sp.replace(/\d+$/, '')] = 1;
    /* RO-1: a regional form (trump_waterfront0) counts for its line (trump) */
    lines[sp.replace(/(?:_[a-z0-9]+)?\d+$/, '')] = 1;
  }
  const all = [...(save.team || []), ...(save.box || [])],
    /* RL-11: what lasts between runs (the same in a run and in the hub) */
    meta = save.meta || {},
    /* RL-S1: the runs kept (logic/run-history.js) */
    facts = historyFacts(meta.history);
  return {
    flags: story,
    beaten: save.flags || {},
    items: save.items || {},
    pyramids: save.pyramids || {},
    quests: story.quests || {},
    visits: story.talks || {},
    visited,
    lines,
    robots: all.filter(m => m && m.kind === 'robot').length,
    badges: (save.seats || []).length,
    caught: Object.keys(save.caught || {}).length,
    unlocks: meta.unlocks || {},
    runs: meta.runs || 0,
    wins: meta.wins || 0,
    expedition: meta.expedition || 1,
    questStages: o.questStages,
    types: teamTypes(save.team || [], o.typesOf),
    money: save.se || 0,
    team: (save.team || []).length,
    badgeTypes: badgeTypesOf(save, o.badgeTypes || {}),
    /* RL-R2: the run's side area's move, once its obstacle is open (logic/run-side.js) */
    opened:
      save.run && save.run.map && save.run.map.side && save.run.map.side.open ? { [save.run.map.side.move]: 1 } : {},
    /* SP-6: DNA, the Gene library and the team's splices (a Billie with a graft) */
    dna: meta.dna || 0,
    genes: (meta.genes || []).length,
    spliced: (save.team || []).filter(m => m && m.graft && Object.keys(m.graft).length).length,
    last: facts.last,
    lastby: facts.lastby,
    history: facts.history,
    rematch: historyRematch(meta.history, o.foe),
    /* RL-S2: the hub folk's levels (relations.json, through the hooks: none without game data), the Beans, the gifts
       given since the last run */
    rel: RELATIONS && meta.rel ? relLevels(meta, RELATIONS) : {},
    beans: meta.beans || 0,
    chapter: meta.chapter || 1,
    lastteam: lastTeamOf(meta.history, o.typesOf),
    /* RL-S2 part B: this run's meetings with Blake (logic/rival.js run.rival) */
    rival: save.run && save.run.rival ? save.run.rival.met || 0 : 0,
    gifted: Object.fromEntries(
      Object.entries(meta.gifted || {}).flatMap(([who, n]) => (n === (meta.runs || 0) ? [[who, 1]] : []))
    ),
    /* RS-1: who lives in Copperleaf (logic/residents.js) */
    residents: meta.residents || {},
  };
}

/** RL-12b: how many Billies of each type (lower case) the team holds, fainted ones too
 * @param {any[]} team @param {(m: any) => string[]} [typesOf] */
export function teamTypes(team, typesOf) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const m of team) {
    if (!m) continue;
    for (const t of new Set((typesOf ? typesOf(m) : m.types) || [])) {
      const k = String(t).toLowerCase();
      out[k] = (out[k] || 0) + 1;
    }
  }
  return out;
}
/** RL-S2: the team the last run kept (meta.history's newest entry, species ids) counted three ways: by type (lower
 * case, through `typesOf`), by line (the species id without its stage) and by species
 * @param {any[] | undefined} history @param {(m: any) => string[]} [typesOf] */
export function lastTeamOf(history, typesOf) {
  const e = Array.isArray(history) ? history[history.length - 1] : null,
    sps = e && Array.isArray(e.team) ? e.team.filter((/** @type {any} */ sp) => typeof sp === 'string') : [],
    out = typesOf
      ? teamTypes(
          sps.map((/** @type {string} */ sp) => ({ sp })),
          typesOf
        )
      : {};
  for (const sp of sps)
    for (const k of new Set([sp, sp.replace(/\d+$/, ''), sp.replace(/(?:_[a-z0-9]+)?\d+$/, '')]))
      out[k] = (out[k] || 0) + 1;
  return out;
}
/** RL-12b: the types of the badges won (lower case): meta.badges (RL-R2), then the leaders' seats
 * @param {any} save @param {Record<string, string>} typeOf a seat id, leader id or type name -> its type */
export function badgeTypesOf(save, typeOf) {
  const meta = save.meta || {},
    b = meta.badges,
    ids = [
      ...(Array.isArray(b) ? b : b && typeof b === 'object' ? Object.keys(b).filter(k => b[k]) : []),
      ...(save.seats || []),
    ];
  /** @type {Record<string, number>} */
  const out = {};
  for (const id of ids) {
    const t = typeOf[id] || id;
    if (typeof t === 'string' && t) out[t.toLowerCase()] = 1;
  }
  return out;
}
